const Parse = require('../config/parse');

const toJSON = (obj) => ({ id: obj.id, ...obj.toJSON() });

// Helper to check if current user (Teacher) owns the course
async function assertTeacherOwnsCourse(courseId, user) {
  const course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
  if (user.get('role') === 'Teacher' && course.get('teacherId') !== user.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return course;
}

// Create Assignment
const createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, dueDate } = req.body;
    if (!courseId || !title) return res.status(400).json({ error: 'courseId and title are required' });

    // Ensure teacher owns the course (or Admin)
    await assertTeacherOwnsCourse(courseId, req.user);

    const Assignment = Parse.Object.extend('Assignment');
    const assignment = new Assignment();
    assignment.set('courseId', courseId);
    assignment.set('title', title);
    if (description !== undefined) assignment.set('description', description);
    if (dueDate) assignment.set('dueDate', new Date(dueDate));
    assignment.set('tenantId', req.tenantId);

    const saved = await assignment.save(null, { useMasterKey: true });
    res.status(201).json(toJSON(saved));
  } catch (err) {
    console.error('Create assignment error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to create assignment' });
  }
};

// List Assignments (tenant scoped, optional filter by courseId)
const listAssignments = async (req, res) => {
  try {
    const { courseId } = req.query;
    const query = new Parse.Query('Assignment');
    query.equalTo('tenantId', req.tenantId);
    if (courseId) query.equalTo('courseId', courseId);
    const results = await query.find({ useMasterKey: true });
    res.json(results.map(toJSON));
  } catch (err) {
    console.error('List assignments error:', err);
    res.status(500).json({ error: 'Failed to list assignments' });
  }
};

// Get Assignment
const getAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await new Parse.Query('Assignment').get(id, { useMasterKey: true });
    if (assignment.get('tenantId') !== req.tenantId) return res.status(404).json({ error: 'Not found' });
    res.json(toJSON(assignment));
  } catch (err) {
    console.error('Get assignment error:', err);
    res.status(404).json({ error: 'Assignment not found' });
  }
};

// Update Assignment (Admin or Teacher who owns the course)
const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await new Parse.Query('Assignment').get(id, { useMasterKey: true });
    if (assignment.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    // Ensure ownership
    await assertTeacherOwnsCourse(assignment.get('courseId'), req.user);

    const { title, description, dueDate } = req.body;
    if (title !== undefined) assignment.set('title', title);
    if (description !== undefined) assignment.set('description', description);
    if (dueDate !== undefined) assignment.set('dueDate', new Date(dueDate));

    const saved = await assignment.save(null, { useMasterKey: true });
    res.json(toJSON(saved));
  } catch (err) {
    console.error('Update assignment error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to update assignment' });
  }
};

// Delete Assignment (Admin or Teacher who owns the course)
const deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await new Parse.Query('Assignment').get(id, { useMasterKey: true });
    if (assignment.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    await assertTeacherOwnsCourse(assignment.get('courseId'), req.user);

    await assignment.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete assignment error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to delete assignment' });
  }
};

module.exports = {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
};