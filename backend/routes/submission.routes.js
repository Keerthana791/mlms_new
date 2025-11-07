// backend/routes/submission.routes.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const {
  createSubmission,
  listSubmissions,
  getSubmission,
  gradeSubmission,
  deleteSubmission,
} = require('../controllers/submission.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

// Create (Student)
router.post('/', requireRole(['Student', 'Teacher', 'Admin']), createSubmission);
// Read
router.get('/', listSubmissions);
router.get('/:id', getSubmission);
// Grade (Admin/Teacher)
router.put('/:id/grade', requireRole(['Admin', 'Teacher']), gradeSubmission);
// Delete (Student own pre-graded or Admin/Teacher)
router.delete('/:id', requireRole(['Admin', 'Teacher', 'Student']), deleteSubmission);

module.exports = router;