const Parse = require('../config/parse');
const { notify } = require('../utils/notify');

// Helpers
const toJSON = (obj) => ({ id: obj.id, ...obj.toJSON() });

// Create Course (Admin, Teacher)
const createCourse = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const Course = Parse.Object.extend('Course');
    const course = new Course();
    course.set('title', title);
    course.set('description', description || '');
    // RBAC: Teachers can only create for themselves; Admin can assign any teacher
    const role = req.user.get('role');
    const assignedTeacherId = role === 'Teacher' ? req.user.id : (req.body.teacherId || req.user.id);
    course.set('teacherId', assignedTeacherId);
    course.set('tenantId', req.tenantId);

    const saved = await course.save(null, { useMasterKey: true });
    res.status(201).json(toJSON(saved));
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ error: 'Failed to create course' });
  }
};

// List Courses (tenant scoped)
const listCourses = async (req, res) => {
  try {
    const role = req.user?.get('role');

    const query = new Parse.Query('Course');
    query.equalTo('tenantId', req.tenantId);

    if (role === 'Teacher') {
      // Teachers see only their courses
      query.equalTo('teacherId', req.user.id);
    }

    // Students can see all courses in the tenant to allow discovery/enrollment
    const results = await query.find({ useMasterKey: true });
    res.json(results.map(toJSON));
  } catch (err) {
    console.error('List courses error:', err);
    res.status(500).json({ error: 'Failed to list courses' });
  }
};

// Get Course by id (tenant scoped)
const getCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await new Parse.Query('Course').get(id, { useMasterKey: true });
    if (course.get('tenantId') !== req.tenantId) return res.status(404).json({ error: 'Not found' });

    const role = req.user?.get('role');
    if (role === 'Student') {
      // Students can see the course only if enrolled
      const enrQ = new Parse.Query('Enrollment');
      enrQ.equalTo('tenantId', req.tenantId);
      enrQ.equalTo('studentId', req.user.id);
      enrQ.equalTo('courseId', id);
      enrQ.equalTo('status', 'active');
      const enr = await enrQ.first({ useMasterKey: true });
      if (!enr) return res.status(403).json({ error: 'Not enrolled' });
    }

    res.json(toJSON(course));
  } catch (err) {
    console.error('Get course error:', err);
    res.status(404).json({ error: 'Course not found' });
  }
};

// Update Course (Admin, Teacher owning the course)
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await new Parse.Query('Course').get(id, { useMasterKey: true });
    if (course.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    const userRole = req.user.get('role');
    const isOwnerTeacher = userRole === 'Teacher' && course.get('teacherId') === req.user.id;
    const isAdmin = userRole === 'Admin';
    if (!isOwnerTeacher && !isAdmin) return res.status(403).json({ error: 'Insufficient permissions' });

    const { title, description, teacherId } = req.body;
    if (title !== undefined) course.set('title', title);
    if (description !== undefined) course.set('description', description);
    // Prevent Teachers from reassigning the course to another teacher
    let teacherChangedTo = null;
    if (teacherId !== undefined) {
      if (userRole === 'Teacher') {
        return res.status(403).json({ error: 'Teachers cannot reassign teacherId' });
      }
      if (course.get('teacherId') !== teacherId) {
        teacherChangedTo = teacherId;
      }
      course.set('teacherId', teacherId);
    }

    const saved = await course.save(null, { useMasterKey: true });

    // Notify new teacher if assignment changed
    if (teacherChangedTo) {
      try {
        await notify({
          tenantId: req.tenantId,
          userIds: [teacherChangedTo],
          type: 'TEACHER_ASSIGNED',
          title: `You have been assigned to ${saved.get('title') || 'a course'}`,
          message: 'You have been assigned as the teacher for this course',
          data: { courseId: saved.id },
          createdBy: req.user.id,
        });
      } catch (e) { /* swallow notification errors */ }
    }

    res.json(toJSON(saved));
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).json({ error: 'Failed to update course' });
  }
};

// Delete Course (Admin, Teacher owning the course)
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await new Parse.Query('Course').get(id, { useMasterKey: true });
    if (course.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    const userRole = req.user.get('role');
    const isOwnerTeacher = userRole === 'Teacher' && course.get('teacherId') === req.user.id;
    const isAdmin = userRole === 'Admin';
    if (!isOwnerTeacher && !isAdmin) return res.status(403).json({ error: 'Insufficient permissions' });

    await course.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ error: 'Failed to delete course' });
  }
};

module.exports = {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  deleteCourse,
};