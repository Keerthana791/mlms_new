const Parse = require('../config/parse');
const { notify } = require('../utils/notify');

const toJSON = (obj) => ({ id: obj.id, ...obj.toJSON() });

// Helper to check if current user (Teacher) owns the course
async function assertTeacherOwnsCourse(courseId, user, tenantId) {
  const course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
  // Enforce tenant isolation for all roles
  if (course.get('tenantId') !== tenantId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  // Teachers must own the course
  if (user.get('role') === 'Teacher' && course.get('teacherId') !== user.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return course;
}

async function ensureCanViewAssignments(courseId, tenantId, user) {
  const role = user.get('role');
  if (role === 'Admin') return true;
  if (role === 'Teacher') {
    const course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
    if (course.get('tenantId') === tenantId && course.get('teacherId') === user.id) return true;
    const err = new Error('Forbidden'); err.status = 403; throw err;
  }
  if (role === 'Student') {
    const enrQ = new Parse.Query('Enrollment');
    enrQ.equalTo('tenantId', tenantId);
    enrQ.equalTo('studentId', user.id);
    enrQ.equalTo('courseId', courseId);
    enrQ.equalTo('status', 'active');
    const enr = await enrQ.first({ useMasterKey: true });
    if (!enr) { const err = new Error('Not enrolled'); err.status = 403; throw err; }
    return true;
  }
  const err = new Error('Forbidden'); err.status = 403; throw err;
}

// Create Assignment (supports optional file attachment)
const createAssignment = async (req, res) => {
  try {
    const { courseId, title, description, dueDate } = req.body || {};
    if (!courseId || !title) return res.status(400).json({ error: 'courseId and title are required' });

    await assertTeacherOwnsCourse(courseId, req.user, req.tenantId);

    // Optional file via multipart or base64 JSON
    let { fileBase64, fileName, fileType, contentType } = req.body || {};
    if (req.file && req.file.buffer) {
      fileName = fileName || req.file.originalname;
      contentType = contentType || req.file.mimetype;
      if (!fileType) {
        if (contentType === 'application/pdf') fileType = 'pdf';
        else if (contentType && contentType.startsWith('video/')) fileType = 'video';
        else if (contentType && contentType.startsWith('application/')) fileType = 'doc';
      }
      fileBase64 = req.file.buffer.toString('base64');
    }

    let file = null;
    if (fileBase64 && fileName) {
      file = new Parse.File(fileName, { base64: fileBase64 }, contentType);
      await file.save({ useMasterKey: true });
    }

    const Assignment = Parse.Object.extend('Assignment');
    const assignment = new Assignment();
    assignment.set('tenantId', req.tenantId);
    assignment.set('courseId', courseId);
    assignment.set('title', title);
    if (description !== undefined) assignment.set('description', description);
    if (dueDate) assignment.set('dueDate', new Date(dueDate));
    if (file) assignment.set('file', file);
    if (fileType) assignment.set('fileType', fileType);
    assignment.set('uploadedBy', req.user.id);

    const saved = await assignment.save(null, { useMasterKey: true });
    let courseTitle = 'Course';
    try {
      const course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
      if (course && course.get('tenantId') === req.tenantId) {
        courseTitle = course.get('title') || 'Course';
      }
    } catch (e) { /* ignore */ }

    // Notify enrolled students about new assignment
try {
  const enrQ = new Parse.Query('Enrollment');
  enrQ.equalTo('tenantId', req.tenantId);
  enrQ.equalTo('courseId', courseId);
  enrQ.equalTo('status', 'active');
  const enrollments = await enrQ.find({ useMasterKey: true });
  const studentIds = Array.from(new Set(enrollments.map(e => e.get('studentId'))));
  if (studentIds.length) {
    const exp = assignment.get('dueDate') ? new Date(assignment.get('dueDate')) : null;
    await notify({
      tenantId: req.tenantId,
      userIds: studentIds,
      type: 'ASSIGNMENT_POSTED',
      title: `New Assignment Posted: ${title}`,
      message: `New assignment "${title}" posted in course "${courseTitle}"`,
      data: { assignmentId: saved.id, courseId, courseTitle },
      expiresAt: exp,
      createdBy: req.user.id,
    });
  }
} catch (e) { /* swallow notification errors */ }

    res.status(201).json(toJSON(saved));
  } catch (err) {
    console.error('Create assignment error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to create assignment' });
  }
};

// Course-scoped create: POST /api/courses/:courseId/assignments
const createAssignmentForCourse = async (req, res) => {
  req.body = req.body || {};
  req.body.courseId = req.params.courseId;
  return createAssignment(req, res);
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

// Course-scoped list: GET /api/courses/:courseId/assignments with RBAC/enrollment
const listAssignmentsForCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    await ensureCanViewAssignments(courseId, req.tenantId, req.user);
    const query = new Parse.Query('Assignment');
    query.equalTo('tenantId', req.tenantId);
    query.equalTo('courseId', courseId);
    query.ascending('createdAt');
    const results = await query.find({ useMasterKey: true });
    res.json(results.map(toJSON));
  } catch (err) {
    console.error('List course assignments error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to list assignments' });
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

    await assertTeacherOwnsCourse(assignment.get('courseId'), req.user, req.tenantId);

    const { title, description, dueDate } = req.body || {};
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

    await assertTeacherOwnsCourse(assignment.get('courseId'), req.user, req.tenantId);

    await assignment.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete assignment error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to delete assignment' });
  }
};

module.exports = {
  createAssignment,
  createAssignmentForCourse,
  listAssignments,
  listAssignmentsForCourse,
  getAssignment,
  updateAssignment,
  deleteAssignment,
};