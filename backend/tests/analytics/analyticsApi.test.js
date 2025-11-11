const request = require('supertest');

// Ensure server does not start listener in tests
process.env.NODE_ENV = 'test';

// Mocks
jest.mock('../../config/parse', () => require('../mocks/parseMock'));

// Auth middleware mock that reads role and user from headers for flexibility
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const Parse = require('../../config/parse');
    const role = req.headers['x-test-role'] || 'Student';
    const userId = req.headers['x-test-user-id'] || 'u_student_1';
    const tenantId = req.headers['x-tenant-id'] || 't1';
    // Create or reuse a fake user object
    const user = Parse.__create('User', { tenantId, role, usernameOnTenant: userId, username: `${tenantId}:${userId}` });
    user.id = userId;
    req.user = user;
    req.sessionToken = 'sess';
    req.tenantId = tenantId;
    next();
  },
  requireRole: (roles) => (req, res, next) => roles.includes(req.user.get('role')) ? next() : res.status(403).json({ error: 'Forbidden' }),
}));

const app = require('../../server');
const Parse = require('../../config/parse');

describe('Analytics API', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  function createObj(className, fields) {
    const Cls = Parse.Object.extend(className);
    const obj = new Cls();
    Object.entries(fields || {}).forEach(([k, v]) => obj.set(k, v));
    return obj.save();
  }

  test('POST /api/analytics/events records an event', async () => {
    const res = await request(app)
      .post('/api/analytics/events')
      .set('x-tenant-id', 't1')
      .set('x-test-role', 'Student')
      .set('x-test-user-id', 'stud1')
      .send({
        event: 'user.login',
        entityType: 'session',
        entityId: 's1',
        payload: { foo: 'bar' },
      });

    expect(res.status).toBe(200);

    const q = new Parse.Query('AnalyticsEvent');
    q.equalTo('tenantId', 't1');
    q.equalTo('userId', 'stud1');
    q.equalTo('event', 'user.login');
    const evt = await q.first();
    expect(evt).toBeTruthy();
    expect(evt.get('payload')?.foo).toBe('bar');
  });

  test('Rollup creates AnalyticsDaily and overview reads from it', async () => {
    // Seed two events on same day
    const now = new Date();
    await createObj('AnalyticsEvent', { tenantId: 't1', userId: 'u1', event: 'A', ts: now, day: now });
    await createObj('AnalyticsEvent', { tenantId: 't1', userId: 'u2', event: 'B', ts: now, day: now });

    // Run rollup (Admin)
    const rollup = await request(app)
      .post('/api/analytics/rollup')
      .set('x-tenant-id', 't1')
      .set('x-test-role', 'Admin')
      .send({});
    expect([200, 201]).toContain(rollup.status);
    expect(typeof rollup.body.updatedDays).toBe('number');

    // Verify AnalyticsDaily doc exists
    const dQ = new Parse.Query('AnalyticsDaily');
    dQ.equalTo('tenantId', 't1');
    const doc = await dQ.first();
    expect(doc).toBeTruthy();
    const totals = doc.get('totalsByEvent') || {};
    expect(totals.A).toBe(1);
    expect(totals.B).toBe(1);

    // GET overview (Admin/Teacher)
    const ov = await request(app)
      .get('/api/analytics/overview')
      .set('x-tenant-id', 't1')
      .set('x-test-role', 'Admin')
      .send();
    expect(ov.status).toBe(200);
    expect(ov.body.totals.A).toBe(1);
    expect(ov.body.totals.B).toBe(1);
  });

  test('Admin dashboard summary returns totals and performance tiles', async () => {
    // Seed users
    await createObj('User', { tenantId: 't1', role: 'Teacher' });
    await createObj('User', { tenantId: 't1', role: 'Student' });

    // Seed course and enrollments
    const course = await createObj('Course', { tenantId: 't1', teacherId: 'teach1', title: 'C1' });
    await createObj('Enrollment', { tenantId: 't1', courseId: course.id, studentId: 's1', status: 'active' });

    // Seed quiz attempt (submitted)
    const quiz = await createObj('Quiz', { tenantId: 't1', courseId: course.id, title: 'Q1', totalPoints: 10 });
    await createObj('QuizAttempt', { tenantId: 't1', quizId: quiz.id, studentId: 's1', status: 'submitted', score: 7 });

    // Seed graded submission
    const asg = await createObj('Assignment', { tenantId: 't1', courseId: course.id, title: 'A1' });
    await createObj('Submission', { tenantId: 't1', assignmentId: asg.id, studentId: 's1', status: 'graded', grade: 8 });

    const res = await request(app)
      .get('/api/analytics/admin/summary')
      .set('x-tenant-id', 't1')
      .set('x-test-role', 'Admin')
      .send();

    expect(res.status).toBe(200);
    expect(res.body.users).toBeTruthy();
    expect(typeof res.body.totalCourses).toBe('number');
    expect(typeof res.body.totalEnrollments).toBe('number');
    expect(res.body.performance).toBeTruthy();
  });

  test('Teacher dashboard summary shows my courses with enrollment and averages', async () => {
    // Seed teacher and course
    const course = await createObj('Course', { tenantId: 't1', teacherId: 'teach1', title: 'C1' });
    await createObj('Enrollment', { tenantId: 't1', courseId: course.id, studentId: 's1', status: 'active' });
    // Quiz + Attempt
    const quiz = await createObj('Quiz', { tenantId: 't1', courseId: course.id, title: 'Q1', totalPoints: 10 });
    await createObj('QuizAttempt', { tenantId: 't1', quizId: quiz.id, studentId: 's1', status: 'submitted', score: 9 });
    // Assignment + graded submission
    const asg = await createObj('Assignment', { tenantId: 't1', courseId: course.id, title: 'A1' });
    await createObj('Submission', { tenantId: 't1', assignmentId: asg.id, studentId: 's1', status: 'graded', grade: 6 });

    const res = await request(app)
      .get('/api/analytics/teacher/summary')
      .set('x-tenant-id', 't1')
      .set('x-test-role', 'Teacher')
      .set('x-test-user-id', 'teach1')
      .send();

    expect(res.status).toBe(200);
    expect(typeof res.body.myCourses).toBe('number');
    expect(Array.isArray(res.body.courseSummary)).toBe(true);
    const item = res.body.courseSummary[0];
    expect(item.courseId).toBe(course.id);
    expect(typeof item.enrolled).toBe('number');
    expect(typeof item.quizAvgScore).toBe('number');
    expect(typeof item.assignmentAvgGrade).toBe('number');
  });

  test('Student dashboard summary reports video completion per course', async () => {
    // Enroll student
    const course = await createObj('Course', { tenantId: 't1', teacherId: 'teach1', title: 'C1' });
    await createObj('Enrollment', { tenantId: 't1', courseId: course.id, studentId: 'stud1', status: 'active' });

    // Course materials: two videos
    const m1 = await createObj('CourseMaterial', { tenantId: 't1', courseId: course.id, title: 'V1', fileType: 'video' });
    const m2 = await createObj('CourseMaterial', { tenantId: 't1', courseId: course.id, title: 'V2', fileType: 'video' });

    // AnalyticsEvent for completion of only first video by this student
    await createObj('AnalyticsEvent', { tenantId: 't1', userId: 'stud1', event: 'material.complete', entityType: 'material', entityId: m1.id });

    const res = await request(app)
      .get('/api/analytics/me/summary')
      .set('x-tenant-id', 't1')
      .set('x-test-role', 'Student')
      .set('x-test-user-id', 'stud1')
      .send();

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.courseSummary)).toBe(true);
    const row = res.body.courseSummary.find(c => c.courseId === course.id);
    expect(row).toBeTruthy();
    expect(row.totalVideos).toBe(2);
    expect(row.videosCompleted).toBe(1);
    expect(row.allVideosWatched).toBe(false);
  });
});