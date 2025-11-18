// backend/routes/assignment.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); // allows :courseId param
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { 
  createAssignmentForCourse, 
  listAssignmentsForCourse,
   deleteAssignment,
} = require('../controllers/assignment.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

const json50mb = express.json({ limit: '50mb' });

// Course-scoped create & list
router.post('/:courseId/assignments', upload.single('file'), json50mb, requireRole(['Admin', 'Teacher']), createAssignmentForCourse);
router.get('/:courseId/assignments', listAssignmentsForCourse);
router.delete(
  '/:courseId/assignments/:id',
  requireRole(['Admin', 'Teacher']),
  deleteAssignment
);

module.exports = router;
