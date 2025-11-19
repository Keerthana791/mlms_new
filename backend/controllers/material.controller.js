const Parse = require('../config/parse');
const { notify } = require('../utils/notify');

const toJSON = (obj) => {
  const data = obj.toJSON();
  const file = obj.get('file');
  return {
    id: obj.id,
    ...data,
    fileUrl: file ? file.url() : null,
  };
};

async function loadCourseOr404(courseId, tenantId) {
  let course;
  try {
    course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
  } catch (_) {
    const err = new Error('Not found'); err.status = 404; throw err;
  }
  if (!course || course.get('tenantId') !== tenantId) {
    const err = new Error('Not found'); err.status = 404; throw err;
  }
  return course;
}

async function ensureTeacherOwnsOrAdmin(course, user) {
  const role = user.get('role');
  if (role === 'Admin') return true;
  if (role === 'Teacher' && course.get('teacherId') === user.id) return true;
  const err = new Error('Insufficient permissions'); err.status = 403; throw err;
}

async function ensureCanViewMaterials(courseId, tenantId, user) {
  const role = user.get('role');
  if (role === 'Admin') return true;

  if (role === 'Teacher') {
    let course;
    try {
      course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
    } catch (_) {
      const err = new Error('Not found'); err.status = 404; throw err;
    }
    if (course && course.get('tenantId') === tenantId && course.get('teacherId') === user.id) return true;
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

// POST /api/courses/:courseId/materials
const uploadMaterial = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Support both JSON base64 and multipart/form-data (multer)
    let { title, fileBase64, fileName, fileType, contentType } = req.body || {};

    // If multipart provided, extract from req.file
    if (req.file && req.file.buffer) {
      // Title can still come from body
      fileName = fileName || req.file.originalname;
      contentType = contentType || req.file.mimetype;
      // Infer fileType if not provided
      if (!fileType) {
        if (contentType === 'application/pdf') fileType = 'pdf';
        else if (contentType && contentType.startsWith('video/')) fileType = 'video';
      }
      fileBase64 = req.file.buffer.toString('base64');
    }

    // Validate inputs
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'file data is required (send as base64 JSON or multipart file)' });
    }
    if (!fileType || !['video', 'pdf'].includes(fileType)) {
      return res.status(400).json({ error: 'fileType must be "video" or "pdf"' });
    }

    const course = await loadCourseOr404(courseId, req.tenantId);
    await ensureTeacherOwnsOrAdmin(course, req.user);

    // Create Parse.File from base64
    const file = new Parse.File(fileName, { base64: fileBase64 }, contentType);
    await file.save({ useMasterKey: true });
    const courseTitle = course.get('title') || 'Course';

    const CourseMaterial = Parse.Object.extend('CourseMaterial');
    const material = new CourseMaterial();
    material.set('tenantId', req.tenantId);
    material.set('courseId', courseId);
    material.set('title', title);
    material.set('file', file);
    material.set('fileType', fileType);
    material.set('uploadedBy', req.user.id);

    const saved = await material.save(null, { useMasterKey: true });

   // Notify enrolled students about new material
try {
  const enrQ = new Parse.Query('Enrollment');
  enrQ.equalTo('tenantId', req.tenantId);
  enrQ.equalTo('courseId', courseId);
  enrQ.equalTo('status', 'active');
  const enrollments = await enrQ.find({ useMasterKey: true });
  const studentIds = Array.from(new Set(enrollments.map(e => e.get('studentId'))));
  if (studentIds.length) {
    await notify({
      tenantId: req.tenantId,
      userIds: studentIds,
      type: 'MATERIAL_UPLOADED',
      title: `Material Uploaded: ${title}`,
      message: `New material "${title}" uploaded in course "${courseTitle}"`,
      data: { materialId: saved.id, courseId, courseTitle, title },
      createdBy: req.user.id,
    });
  }
} catch (e) { /* swallow notification errors */ }

    res.status(201).json(toJSON(saved));
  } catch (err) {
    console.error('Upload material error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to upload material' });
  }
};

// GET /api/courses/:courseId/materials
const listMaterials = async (req, res) => {
  try {
    const { courseId } = req.params;
    await loadCourseOr404(courseId, req.tenantId);
    await ensureCanViewMaterials(courseId, req.tenantId, req.user);

    const q = new Parse.Query('CourseMaterial');
    q.equalTo('tenantId', req.tenantId);
    q.equalTo('courseId', courseId);
    q.ascending('createdAt');
    const results = await q.find({ useMasterKey: true });
    res.json(results.map(toJSON));
  } catch (err) {
    console.error('List materials error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to list materials' });
  }
};

// DELETE /api/courses/:courseId/materials/:materialId
const deleteMaterial = async (req, res) => {
  try {
    const { courseId, materialId } = req.params;
    if (!courseId || !materialId) {
      return res.status(400).json({ error: 'courseId and materialId are required' });
    }

    const course = await loadCourseOr404(courseId, req.tenantId);
    await ensureTeacherOwnsOrAdmin(course, req.user); // Admin or owning Teacher only

    const q = new Parse.Query('CourseMaterial');
    q.equalTo('tenantId', req.tenantId);
    q.equalTo('courseId', courseId);
    const mat = await q.get(materialId, { useMasterKey: true });

    if (!mat) {
      return res.status(404).json({ error: 'Material not found' });
    }

    await mat.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete material error:', err);
    res.status(err.status || 500).json({
      error: err.status ? err.message : 'Failed to delete material',
    });
  }
};

module.exports = {
  uploadMaterial,
  listMaterials,
  deleteMaterial,
};