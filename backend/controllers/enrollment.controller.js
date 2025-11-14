const Parse = require('../config/parse');
const { notify } = require('../utils/notify');

const toJSON = (obj) => ({ id: obj.id, ...obj.toJSON() });

const createSelfEnrollment = async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    let course;
    try {
      course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
    } catch (e) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!course || course.get('tenantId') !== req.tenantId) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const q = new Parse.Query('Enrollment');
    q.equalTo('tenantId', req.tenantId);
    q.equalTo('courseId', courseId);
    q.equalTo('studentId', req.user.id);
    q.equalTo('status', 'active');
    const existing = await q.first({ useMasterKey: true });
    if (existing) {
      const data = toJSON(existing);
      return res.status(200).json({ ...data, alreadyEnrolled: true });
    }

    const Enrollment = Parse.Object.extend('Enrollment');
    const enr = new Enrollment();
    enr.set('tenantId', req.tenantId);
    enr.set('courseId', courseId);
    enr.set('studentId', req.user.id);
    enr.set('status', 'active');
    const saved = await enr.save(null, { useMasterKey: true });

    // Notify student: COURSE_ENROLLMENT_APPROVED (self-enrollment is auto-approved)
    try {
      await notify({
        tenantId: req.tenantId,
        userIds: [req.user.id],
        type: 'COURSE_ENROLLMENT_APPROVED',
        title: 'Enrollment Approved',
        message: 'Your course enrollment was approved',
        data: { courseId },
        createdBy: req.user.id,
      });
    } catch (e) { /* swallow notification errors */ }

    res.status(201).json(toJSON(saved));
  } catch (err) {
    console.error('Create self enrollment error:', err);
    res.status(500).json({ error: 'Failed to enroll' });
  }
};

const listSelfEnrollments = async (req, res) => {
  try {
    const q = new Parse.Query('Enrollment');
    q.equalTo('tenantId', req.tenantId);
    q.equalTo('studentId', req.user.id);
    q.equalTo('status', 'active');
    const results = await q.find({ useMasterKey: true });
    res.json(results.map(toJSON));
  } catch (err) {
    console.error('List self enrollments error:', err);
    res.status(500).json({ error: 'Failed to list enrollments' });
  }
};

const deleteSelfEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId) return res.status(400).json({ error: 'courseId is required' });

    const q = new Parse.Query('Enrollment');
    q.equalTo('tenantId', req.tenantId);
    q.equalTo('courseId', courseId);
    q.equalTo('studentId', req.user.id);
    q.equalTo('status', 'active');
    const enr = await q.first({ useMasterKey: true });
    if (!enr) return res.status(404).json({ error: 'Enrollment not found' });

    await enr.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete self enrollment error:', err);
    res.status(500).json({ error: 'Failed to unenroll' });
  }
};

const listCourseEnrollments = async (req, res) => {
  try {
    const courseId = req.params.id;
if (!courseId) return res.status(400).json({ error: 'courseId is required' });
    // Load course and verify tenant
    let course;
    try {
      course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
    } catch (e) {
      return res.status(404).json({ error: 'Course not found' });
    }
    if (!course || course.get('tenantId') !== req.tenantId) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const role = req.user.get('role');
    const isAdmin = role === 'Admin';
    const isOwnerTeacher = role === 'Teacher' && course.get('teacherId') === req.user.id;
    if (!isAdmin && !isOwnerTeacher) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Find enrollments for this course
    const enrQ = new Parse.Query('Enrollment');
    enrQ.equalTo('tenantId', req.tenantId);
    enrQ.equalTo('courseId', courseId);
    enrQ.equalTo('status', 'active');
    const enrollments = await enrQ.find({ useMasterKey: true });

    const studentIds = Array.from(
      new Set(enrollments.map((e) => e.get('studentId')).filter(Boolean))
    );

    let studentsById = {};
    if (studentIds.length > 0) {
      const userQ = new Parse.Query(Parse.User);
      userQ.equalTo('tenantId', req.tenantId);
      userQ.containedIn('objectId', studentIds);
      const students = await userQ.find({ useMasterKey: true });
      studentsById = Object.fromEntries(
        students.map((u) => [
          u.id,
          { id: u.id, username: u.get('username'), role: u.get('role') },
        ])
      );
    }

    const result = enrollments.map((e) => ({
      id: e.id,
      courseId,
      studentId: e.get('studentId'),
      status: e.get('status'),
      student: studentsById[e.get('studentId')] || null,
    }));

    res.json(result);
  } catch (err) {
    console.error('List course enrollments error:', err);
    res.status(500).json({ error: 'Failed to list enrollments' });
  }
};

module.exports = {
  createSelfEnrollment,
  listSelfEnrollments,
  deleteSelfEnrollment,
  listCourseEnrollments,
};