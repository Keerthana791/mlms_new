// backend/routes/course.routes.js
const express = require('express');
const { listCourseEnrollments } = require('../controllers/enrollment.controller');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const {
  createCourse,
  listCourses,
  getCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/course.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

// Create
router.post('/', requireRole(['Admin', 'Teacher']), createCourse);
// Read
router.get('/', listCourses);
router.get('/:id/enrollments', requireRole(['Admin', 'Teacher']), listCourseEnrollments);
router.get('/:id', getCourse);

// Update
router.put('/:id', requireRole(['Admin', 'Teacher']), updateCourse);
// Delete
router.delete('/:id', requireRole(['Admin', 'Teacher']), deleteCourse);

module.exports = router;