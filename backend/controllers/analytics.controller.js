const Parse = require('../config/parse');
const { trackEvent } = require('../utils/analytics');
const { rollupDaily } = require('../utils/analyticsRollup');

function toISTDayString(date) {
  const IST_OFFSET_MIN = 330; // +05:30
  const d = date instanceof Date ? date : new Date(date);
  const utcMs = d.getTime();
  const istMs = utcMs + IST_OFFSET_MIN * 60000;
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// POST /api/analytics/events
// Body: { event, entityType?, entityId?, payload?, ts? }
async function postEvent(req, res) {
  try {
    const { event, entityType, entityId, payload, ts } = req.body || {};
    if (!event) return res.status(400).json({ error: 'event is required' });

    const ok = await trackEvent({
      tenantId: req.tenantId,
      userId: req.user.id,
      role: req.user.get('role'),
      event,
      entityType,
      entityId,
      payload,
      ts: ts ? new Date(ts) : undefined,
    });
    if (!ok) return res.status(500).json({ error: 'Failed to record event' });
    res.json({ success: true });
  } catch (err) {
    console.error('postEvent error:', err);
    res.status(500).json({ error: 'Failed to record event' });
  }
}

// GET /api/analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns counts by event, and by day, tenant-scoped
async function getOverview(req, res) {
  try {
    const { from, to } = req.query || {};
    const start = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = to ? new Date(to) : new Date();

    const dayStart = new Date(start);
    const dayEnd = new Date(end);

    const q = new Parse.Query('AnalyticsDaily');
    q.equalTo('tenantId', req.tenantId);
    q.greaterThanOrEqualTo('day', dayStart);
    // Parse mock lacks lessThanOrEqualTo; use lessThan with +1ms to include end
    const dayEndInclusive = new Date(dayEnd.getTime() + 1);
    q.lessThan('day', dayEndInclusive);

    const docs = await q.find({ useMasterKey: true });

    const byEvent = {};
    const byDay = {};
    for (const d of docs) {
      const dayDate = d.get('day');
      const day = toISTDayString(dayDate);
      const totals = d.get('totalsByEvent') || {};
      if (!byDay[day]) byDay[day] = {};
      for (const [ev, cnt] of Object.entries(totals)) {
        byDay[day][ev] = (byDay[day][ev] || 0) + (cnt || 0);
        byEvent[ev] = (byEvent[ev] || 0) + (cnt || 0);
      }
    }

    res.json({ range: { from: start.toISOString(), to: end.toISOString() }, totals: byEvent, byDay });
  } catch (err) {
    console.error('getOverview error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
}

async function postRollup(req, res) {
  try {
    const { from, to } = req.body || {};
    const updatedDays = await rollupDaily({ tenantId: req.tenantId, from, to });
    res.json({ updatedDays });
  } catch (err) {
    console.error('postRollup error:', err);
    res.status(500).json({ error: 'Failed to run rollup' });
  }
}

async function adminDashboardSummary(req, res) {
  try {
    const tenantId = req.tenantId;

    // Users by role
    // Build two independent queries (mock lacks clone)
    const teacherQ = new Parse.Query('_User');
    teacherQ.equalTo('tenantId', tenantId);
    teacherQ.equalTo('role', 'Teacher');
    const studentQ = new Parse.Query('_User');
    studentQ.equalTo('tenantId', tenantId);
    studentQ.equalTo('role', 'Student');
    const [teachers, students] = await Promise.all([
      teacherQ.count({ useMasterKey: true }),
      studentQ.count({ useMasterKey: true }),
    ]);

    // Courses
    const courseQ = new Parse.Query('Course');
    courseQ.equalTo('tenantId', tenantId);
    const totalCourses = await courseQ.count({ useMasterKey: true });

    // Enrollments (active)
    const enrQ = new Parse.Query('Enrollment');
    enrQ.equalTo('tenantId', tenantId);
    enrQ.equalTo('status', 'active');
    const totalEnrollments = await enrQ.count({ useMasterKey: true });

    // Performance aggregates (quick, overall)
    // Quiz attempts (submitted)
    const qaQ = new Parse.Query('QuizAttempt');
    qaQ.equalTo('tenantId', tenantId);
    qaQ.equalTo('status', 'submitted');
    qaQ.limit(10000);
    const attempts = await qaQ.find({ useMasterKey: true });
    let quizScoreSum = 0, quizSubmittedCount = attempts.length;
    for (const a of attempts) quizScoreSum += Number(a.get('score') || 0);
    const quizAvgScore = quizSubmittedCount ? (quizScoreSum / quizSubmittedCount) : 0;

    // Assignment submissions (graded)
    const subQ = new Parse.Query('Submission');
    subQ.equalTo('tenantId', tenantId);
    subQ.equalTo('status', 'graded');
    subQ.limit(10000);
    const graded = await subQ.find({ useMasterKey: true });
    let assignSum = 0, assignmentGradedCount = graded.length;
    for (const s of graded) assignSum += Number(s.get('grade') || 0);
    const assignmentAvgGrade = assignmentGradedCount ? (assignSum / assignmentGradedCount) : 0;

    // Optional tiles: new enrollments last 7 days
    const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const enr7Q = new Parse.Query('Enrollment');
    enr7Q.equalTo('tenantId', tenantId);
    enr7Q.equalTo('status', 'active');
    enr7Q.greaterThanOrEqualTo('createdAt', last7);
    const newEnrollments7d = await enr7Q.count({ useMasterKey: true });

    res.json({
      users: { total: teachers + students, byRole: { Teacher: teachers, Student: students } },
      totalCourses,
      totalEnrollments,
      performance: {
        quiz: { avgScore: quizAvgScore, submittedCount: quizSubmittedCount },
        assignment: { avgGrade: assignmentAvgGrade, gradedCount: assignmentGradedCount },
      },
      optional: { newEnrollments7d },
    });
  } catch (err) {
    console.error('adminDashboardSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch admin dashboard summary' });
  }
}

async function teacherDashboardSummary(req, res) {
  try {
    const tenantId = req.tenantId;
    const teacherId = req.user.id;

    // My courses
    const coursesQ = new Parse.Query('Course');
    coursesQ.equalTo('tenantId', tenantId);
    coursesQ.equalTo('teacherId', teacherId);
    coursesQ.limit(1000);
    const courses = await coursesQ.find({ useMasterKey: true });
    const courseIds = courses.map(c => c.id);

    // Enrollments per course (active)
    const enrQ = new Parse.Query('Enrollment');
    enrQ.equalTo('tenantId', tenantId);
    enrQ.equalTo('status', 'active');
    enrQ.containedIn('courseId', courseIds);
    enrQ.limit(10000);
    const enrollments = await enrQ.find({ useMasterKey: true });
    const enrolledByCourse = {};
    for (const e of enrollments) {
      const cid = e.get('courseId');
      enrolledByCourse[cid] = (enrolledByCourse[cid] || 0) + 1;
    }

    // Quiz performance per course (submitted attempts)
    const qaQ = new Parse.Query('QuizAttempt');
    qaQ.equalTo('tenantId', tenantId);
    qaQ.equalTo('status', 'submitted');
    qaQ.limit(10000);
    const attempts = await qaQ.find({ useMasterKey: true });
    // Need quiz->courseId map
    const quizIds = Array.from(new Set(attempts.map(a => a.get('quizId')).filter(Boolean)));
    let quizCourseMap = new Map();
    if (quizIds.length) {
      const quizQ = new Parse.Query('Quiz');
      quizQ.equalTo('tenantId', tenantId);
      quizQ.containedIn('objectId', quizIds);
      quizQ.limit(10000);
      const quizzes = await quizQ.find({ useMasterKey: true });
      quizzes.forEach(q => quizCourseMap.set(q.id, q.get('courseId')));
    }
    const quizPerfByCourse = {};
    for (const a of attempts) {
      const cid = quizCourseMap.get(a.get('quizId'));
      if (!cid || !courseIds.includes(cid)) continue;
      const score = Number(a.get('score') || 0);
      const obj = (quizPerfByCourse[cid] = quizPerfByCourse[cid] || { sum: 0, count: 0 });
      obj.sum += score; obj.count += 1;
    }

    // Assignment performance per course (graded submissions)
    const subQ = new Parse.Query('Submission');
    subQ.equalTo('tenantId', tenantId);
    subQ.equalTo('status', 'graded');
    subQ.limit(10000);
    const graded = await subQ.find({ useMasterKey: true });
    // Need assignment->courseId map
    const assignmentIds = Array.from(new Set(graded.map(g => g.get('assignmentId')).filter(Boolean)));
    let asgCourseMap = new Map();
    if (assignmentIds.length) {
      const asgQ = new Parse.Query('Assignment');
      asgQ.equalTo('tenantId', tenantId);
      asgQ.containedIn('objectId', assignmentIds);
      asgQ.limit(10000);
      const asgs = await asgQ.find({ useMasterKey: true });
      asgs.forEach(a => asgCourseMap.set(a.id, a.get('courseId')));
    }
    const asgPerfByCourse = {};
    for (const s of graded) {
      const cid = asgCourseMap.get(s.get('assignmentId'));
      if (!cid || !courseIds.includes(cid)) continue;
      const grade = Number(s.get('grade') || 0);
      const obj = (asgPerfByCourse[cid] = asgPerfByCourse[cid] || { sum: 0, count: 0 });
      obj.sum += grade; obj.count += 1;
    }

    // Pack courses
    const myCourses = courses.map(c => ({ id: c.id, title: c.get('title') || '' }));
    const courseSummary = myCourses.map(c => ({
      courseId: c.id,
      title: c.title,
      enrolled: enrolledByCourse[c.id] || 0,
      quizAvgScore: (quizPerfByCourse[c.id] && quizPerfByCourse[c.id].count) ? (quizPerfByCourse[c.id].sum / quizPerfByCourse[c.id].count) : 0,
      assignmentAvgGrade: (asgPerfByCourse[c.id] && asgPerfByCourse[c.id].count) ? (asgPerfByCourse[c.id].sum / asgPerfByCourse[c.id].count) : 0,
    }));

    // Optional: recent submissions (latest 5)
    const recentSubQ = new Parse.Query('Submission');
    recentSubQ.equalTo('tenantId', tenantId);
    recentSubQ.containedIn('assignmentId', assignmentIds);
    recentSubQ.descending('createdAt');
    recentSubQ.limit(5);
    const recentSubs = await recentSubQ.find({ useMasterKey: true });

    res.json({ myCourses: myCourses.length, courseSummary, recentSubmissions: recentSubs.map(s => ({ id: s.id, ...s.toJSON() })) });
  } catch (err) {
    console.error('teacherDashboardSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch teacher dashboard summary' });
  }
}

async function studentDashboardSummary(req, res) {
  try {
    const tenantId = req.tenantId;
    const studentId = req.user.id;

    // My courses via enrollments
    const enrQ = new Parse.Query('Enrollment');
    enrQ.equalTo('tenantId', tenantId);
    enrQ.equalTo('studentId', studentId);
    enrQ.equalTo('status', 'active');
    enrQ.limit(1000);
    const enrollments = await enrQ.find({ useMasterKey: true });
    const courseIds = Array.from(new Set(enrollments.map(e => e.get('courseId'))));

    // Course titles
    let courses = [];
    if (courseIds.length) {
      const cQ = new Parse.Query('Course');
      cQ.equalTo('tenantId', tenantId);
      cQ.containedIn('objectId', courseIds);
      cQ.limit(1000);
      courses = await cQ.find({ useMasterKey: true });
    }
    const courseTitle = new Map(courses.map(c => [c.id, c.get('title') || '']));

    // Quiz attempts by this student
    const qaQ = new Parse.Query('QuizAttempt');
    qaQ.equalTo('tenantId', tenantId);
    qaQ.equalTo('studentId', studentId);
    qaQ.equalTo('status', 'submitted');
    qaQ.limit(10000);
    const attempts = await qaQ.find({ useMasterKey: true });
    const quizIds = Array.from(new Set(attempts.map(a => a.get('quizId')).filter(Boolean)));
    let quizCourseMap = new Map();
    if (quizIds.length) {
      const quizQ = new Parse.Query('Quiz');
      quizQ.equalTo('tenantId', tenantId);
      quizQ.containedIn('objectId', quizIds);
      quizQ.limit(10000);
      const quizzes = await quizQ.find({ useMasterKey: true });
      quizzes.forEach(q => quizCourseMap.set(q.id, q.get('courseId')));
    }

    const quizPerfByCourse = {};
    for (const a of attempts) {
      const cid = quizCourseMap.get(a.get('quizId'));
      if (!cid) continue;
      const score = Number(a.get('score') || 0);
      const obj = (quizPerfByCourse[cid] = quizPerfByCourse[cid] || { sum: 0, count: 0 });
      obj.sum += score; obj.count += 1;
    }

    // Assignment grades by this student
    const subQ = new Parse.Query('Submission');
    subQ.equalTo('tenantId', tenantId);
    subQ.equalTo('studentId', studentId);
    subQ.equalTo('status', 'graded');
    subQ.limit(10000);
    const graded = await subQ.find({ useMasterKey: true });

    const assignmentIds = Array.from(new Set(graded.map(g => g.get('assignmentId')).filter(Boolean)));
    let asgCourseMap = new Map();
    if (assignmentIds.length) {
      const asgQ = new Parse.Query('Assignment');
      asgQ.equalTo('tenantId', tenantId);
      asgQ.containedIn('objectId', assignmentIds);
      asgQ.limit(10000);
      const asgs = await asgQ.find({ useMasterKey: true });
      asgs.forEach(a => asgCourseMap.set(a.id, a.get('courseId')));
    }

    const asgPerfByCourse = {};
    for (const s of graded) {
      const cid = asgCourseMap.get(s.get('assignmentId'));
      if (!cid) continue;
      const grade = Number(s.get('grade') || 0);
      const obj = (asgPerfByCourse[cid] = asgPerfByCourse[cid] || { sum: 0, count: 0 });
      obj.sum += grade; obj.count += 1;
    }

    // Video completion per course
    // 1) Load all video materials for enrolled courses
    let videoMaterials = [];
    if (courseIds.length) {
      const mQ = new Parse.Query('CourseMaterial');
      mQ.equalTo('tenantId', tenantId);
      mQ.containedIn('courseId', courseIds);
      mQ.equalTo('fileType', 'video');
      mQ.limit(10000);
      videoMaterials = await mQ.find({ useMasterKey: true });
    }
    const videoIds = videoMaterials.map(m => m.id);
    const videosByCourse = new Map();
    for (const m of videoMaterials) {
      const cid = m.get('courseId');
      const arr = videosByCourse.get(cid) || [];
      arr.push(m.id);
      videosByCourse.set(cid, arr);
    }

    // 2) Find completed materials for this student via AnalyticsEvent 'material.complete'
    let completedSet = new Set();
    if (videoIds.length) {
      const evQ = new Parse.Query('AnalyticsEvent');
      evQ.equalTo('tenantId', tenantId);
      evQ.equalTo('userId', studentId);
      evQ.equalTo('event', 'material.complete');
      evQ.containedIn('entityId', videoIds);
      evQ.limit(10000);
      const evs = await evQ.find({ useMasterKey: true });
      completedSet = new Set(evs.map(e => e.get('entityId')).filter(Boolean));
    }

    // Build summary per course
    const courseSummary = courseIds.map(cid => {
      const vids = videosByCourse.get(cid) || [];
      const totalVideos = vids.length;
      let videosCompleted = 0;
      if (totalVideos) {
        for (const vid of vids) if (completedSet.has(vid)) videosCompleted += 1;
      }
      const allVideosWatched = totalVideos > 0 && videosCompleted === totalVideos;
      return {
        courseId: cid,
        title: courseTitle.get(cid) || '',
        quizAvgScore: (quizPerfByCourse[cid] && quizPerfByCourse[cid].count) ? (quizPerfByCourse[cid].sum / quizPerfByCourse[cid].count) : 0,
        assignmentAvgGrade: (asgPerfByCourse[cid] && asgPerfByCourse[cid].count) ? (asgPerfByCourse[cid].sum / asgPerfByCourse[cid].count) : 0,
        totalVideos,
        videosCompleted,
        allVideosWatched,
      };
    });

    res.json({ myCourses: courseSummary.length, courseSummary });
  } catch (err) {
    console.error('studentDashboardSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch student dashboard summary' });
  }
}

module.exports = { postEvent, getOverview, postRollup, adminDashboardSummary, teacherDashboardSummary, studentDashboardSummary };
