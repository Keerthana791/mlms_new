const Parse = require('../config/parse');

const toJSON = (obj) => ({ id: obj.id, ...obj.toJSON() });

// Helper: ensure teacher owns the course for an assignment
async function assertTeacherOwnsAssignment(assignmentId, user) {
  if (user.get('role') === 'Admin') return true;
  const assignment = await new Parse.Query('Assignment').get(assignmentId, { useMasterKey: true });
  const course = await new Parse.Query('Course').get(assignment.get('courseId'), { useMasterKey: true });
  if (user.get('role') === 'Teacher' && course.get('teacherId') !== user.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return true;
}

// Create a submission (Student)
const createSubmission = async (req, res) => {
  try {
    const { assignmentId, content } = req.body;
    if (!assignmentId || !content) return res.status(400).json({ error: 'assignmentId and content are required' });

    const Submission = Parse.Object.extend('Submission');
    const submission = new Submission();
    submission.set('assignmentId', assignmentId);
    submission.set('studentId', req.user.id);
    submission.set('content', content);
    submission.set('status', 'submitted');
    submission.set('tenantId', req.tenantId);

    const saved = await submission.save(null, { useMasterKey: true });
    res.status(201).json(toJSON(saved));
  } catch (err) {
    console.error('Create submission error:', err);
    res.status(500).json({ error: 'Failed to create submission' });
  }
};

// List submissions (tenant scoped)
// Students: only their own
// Teacher/Admin: all within tenant; optional filter by assignmentId
const listSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.query;
    const query = new Parse.Query('Submission');
    query.equalTo('tenantId', req.tenantId);
    if (assignmentId) query.equalTo('assignmentId', assignmentId);

    const role = req.user.get('role');
    if (role === 'Student') {
      query.equalTo('studentId', req.user.id);
    }

    const results = await query.find({ useMasterKey: true });
    res.json(results.map(toJSON));
  } catch (err) {
    console.error('List submissions error:', err);
    res.status(500).json({ error: 'Failed to list submissions' });
  }
};

// Get a submission by id (tenant scoped, student can access own, teacher/admin any in tenant)
const getSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const submission = await new Parse.Query('Submission').get(id, { useMasterKey: true });
    if (submission.get('tenantId') !== req.tenantId) return res.status(404).json({ error: 'Not found' });

    const role = req.user.get('role');
    if (role === 'Student' && submission.get('studentId') !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(toJSON(submission));
  } catch (err) {
    console.error('Get submission error:', err);
    res.status(404).json({ error: 'Submission not found' });
  }
};

// Grade a submission (Admin or Teacher owning assignment's course)
const gradeSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { grade } = req.body;
    if (grade === undefined) return res.status(400).json({ error: 'grade is required' });

    const submission = await new Parse.Query('Submission').get(id, { useMasterKey: true });
    if (submission.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    await assertTeacherOwnsAssignment(submission.get('assignmentId'), req.user);

    submission.set('grade', grade);
    submission.set('status', 'graded');
    const saved = await submission.save(null, { useMasterKey: true });
    res.json(toJSON(saved));
  } catch (err) {
    console.error('Grade submission error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to grade submission' });
  }
};

// Delete own submission before graded (Student)
const deleteSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const submission = await new Parse.Query('Submission').get(id, { useMasterKey: true });
    if (submission.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    const role = req.user.get('role');
    if (role === 'Student') {
      if (submission.get('studentId') !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
      if (submission.get('status') === 'graded') return res.status(400).json({ error: 'Cannot delete graded submission' });
    } else if (!['Admin', 'Teacher'].includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await submission.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete submission error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to delete submission' });
  }
};

module.exports = {
  createSubmission,
  listSubmissions,
  getSubmission,
  gradeSubmission,
  deleteSubmission,
};