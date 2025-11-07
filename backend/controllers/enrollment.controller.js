const Parse = require('../config/parse');

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

module.exports = {
  createSelfEnrollment,
  listSelfEnrollments,
  deleteSelfEnrollment,
};