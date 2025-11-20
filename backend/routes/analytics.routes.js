const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const {
  postEvent,
  getOverview,
  postRollup,
  adminDashboardSummary,
  teacherDashboardSummary,
  studentDashboardSummary,
  courseQuizAnalytics,
  courseAssignmentAnalytics,
  studentCourseQuizAnalytics,
  studentCourseAssignmentAnalytics,
} = require('../controllers/analytics.controller');
router.use(requireAuth, tenantMiddleware);

// Any authenticated user can emit events
router.post('/events', postEvent);

// Admin-only rollup trigger
router.post('/rollup', requireRole(['Admin']), postRollup);

// Overview restricted to Admin/Teacher for now
router.get('/overview', requireRole(['Admin', 'Teacher']), getOverview);

// Dashboard summaries
router.get('/admin/summary', requireRole(['Admin']), adminDashboardSummary);
router.get('/teacher/summary', requireRole(['Teacher']), teacherDashboardSummary);
router.get('/me/summary', requireRole(['Student']), studentDashboardSummary);
router.get(
  '/courses/:courseId/quizzes/detail',
  requireRole(['Admin', 'Teacher']),
  courseQuizAnalytics
);

router.get(
  '/courses/:courseId/assignments/detail',
  requireRole(['Admin', 'Teacher']),
  courseAssignmentAnalytics
);
router.get(
  '/me/courses/:courseId/quizzes',
  requireRole(['Student']),
  studentCourseQuizAnalytics
);

router.get(
  '/me/courses/:courseId/assignments',
  requireRole(['Student']),
  studentCourseAssignmentAnalytics
);

module.exports = router;
