const Parse = require('../config/parse');
const { notify } = require('../utils/notify');

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

// Create a submission (Student) with optional file attachment
const createSubmission = async (req, res) => {
  try {
    let { assignmentId, content, fileBase64, fileName, fileType, contentType } = req.body || {};
    if (!assignmentId && req.params?.assignmentId) assignmentId = req.params.assignmentId;
    if (!assignmentId) return res.status(400).json({ error: 'assignmentId is required' });
    if (!content && !req.file && !fileBase64) return res.status(400).json({ error: 'Either content or file is required' });

    // Ensure student is enrolled in the assignment's course (tenant scoped)
    const assignment = await new Parse.Query('Assignment').get(assignmentId, { useMasterKey: true });
    if (assignment.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });
    const enrQ = new Parse.Query('Enrollment');
    enrQ.equalTo('tenantId', req.tenantId);
    enrQ.equalTo('studentId', req.user.id);
    enrQ.equalTo('courseId', assignment.get('courseId'));
    enrQ.equalTo('status', 'active');
    const enr = await enrQ.first({ useMasterKey: true });
    if (!enr) return res.status(403).json({ error: 'Not enrolled' });

    // If multipart provided, extract from req.file
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
    if (fileBase64 && (fileName || req.file)) {
      const originalName = fileName || (req.file ? req.file.originalname : 'upload.bin');
      const safeName = String(originalName).replace(/[^A-Za-z0-9._-]/g, '_');
      file = new Parse.File(safeName, { base64: fileBase64 }, contentType);
      await file.save({ useMasterKey: true });
    }

    const Submission = Parse.Object.extend('Submission');
    const submission = new Submission();
    submission.set('tenantId', req.tenantId);
    submission.set('assignmentId', assignmentId);
    submission.set('studentId', req.user.id);
    if (content) submission.set('content', content);
    if (file) submission.set('file', file);
    if (fileType) submission.set('fileType', fileType);
    submission.set('status', 'submitted');
    submission.set('submittedAt', new Date());

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
    // Read from query or params
    let { assignmentId } = req.query || {};
    if (!assignmentId && req.params && req.params.assignmentId) {
      assignmentId = req.params.assignmentId;
    }

    const query = new Parse.Query('Submission');
    query.equalTo('tenantId', req.tenantId);
    if (assignmentId) query.equalTo('assignmentId', assignmentId);

    const role = req.user.get('role');
    if (role === 'Student') {
      query.equalTo('studentId', req.user.id);
    }
    if (role === 'Teacher') {
      if (!assignmentId) {
        return res
          .status(400)
          .json({ error: 'assignmentId is required for teachers' });
      }
      await assertTeacherOwnsAssignment(assignmentId, req.user);
    }

        const results = await query.find({ useMasterKey: true });

    // Collect studentIds to resolve names
    const studentIds = Array.from(
      new Set(
        results
          .map((s) => s.get('studentId'))
          .filter(Boolean)
      )
    );

    let namesById = {};
    if (studentIds.length) {
      const userQ = new Parse.Query('_User');
      userQ.containedIn('objectId', studentIds);
      const users = await userQ.find({ useMasterKey: true });

      namesById = Object.fromEntries(
        users.map((u) => [
          u.id,
          // pick a reasonable display name field
          u.get('name') || u.get('username') || u.get('email'),
        ])
      );
    }

    const jsonResults = results.map((s) => {
      const json = toJSON(s);
      const studentId = s.get('studentId');
      const file = s.get('file');

      // attach studentName if we found one
      if (studentId && namesById[studentId]) {
        json.studentName = namesById[studentId];
      }

      // expose file URL as fileUrl for frontend
      if (file && typeof file.url === 'function') {
        json.fileUrl = file.url();
      }

      return json;
    });

    res.json(jsonResults);
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
    if (role === 'Teacher') {
      await assertTeacherOwnsAssignment(submission.get('assignmentId'), req.user);
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
    const { grade, feedback } = req.body || {};
    if (grade === undefined) return res.status(400).json({ error: 'grade is required' });

    // Enforce marks out of 10
    const numericGrade = Number(grade);
    if (!Number.isFinite(numericGrade) || numericGrade < 0 || numericGrade > 10) {
      return res.status(400).json({ error: 'grade must be a number between 0 and 10' });
    }

    const submission = await new Parse.Query('Submission').get(id, { useMasterKey: true });
    if (submission.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    await assertTeacherOwnsAssignment(submission.get('assignmentId'), req.user);

    submission.set('grade', numericGrade);
    if (feedback !== undefined) submission.set('feedback', feedback);
    submission.set('status', 'graded');
    const saved = await submission.save(null, { useMasterKey: true });

    // Notify student: ASSIGNMENT_GRADED
    try {
      await notify({
        tenantId: req.tenantId,
        userIds: [submission.get('studentId')],
        type: 'ASSIGNMENT_GRADED',
        title: 'Assignment Graded',
        message: `Assignment graded: ${submission.get('assignmentId')}`,
        data: { assignmentId: submission.get('assignmentId'), submissionId: submission.id, score: numericGrade, total: 10 },
        createdBy: req.user.id,
      });
    } catch (e) { /* swallow notification errors */ }

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