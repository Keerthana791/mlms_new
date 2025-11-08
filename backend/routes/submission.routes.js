// backend/routes/submission.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
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

const json50mb = express.json({ limit: '50mb' });

// Assignment-scoped create: POST /assignments/:assignmentId/submissions (Student only)
router.post('/:assignmentId/submissions', upload.single('file'), json50mb, requireRole(['Student']), (req, res, next) => createSubmission(req, res, next));

// Assignment-scoped list: GET /assignments/:assignmentId/submissions
router.get('/:assignmentId/submissions', (req, res, next) => {
  req.query = req.query || {};
  req.query.assignmentId = req.params.assignmentId;
  return listSubmissions(req, res, next);
});

// Assignment-scoped get by id: GET /assignments/:assignmentId/submissions/:id
router.get('/:assignmentId/submissions/:id', (req, res, next) => {
  req.query = req.query || {};
  req.query.assignmentId = req.params.assignmentId;
  return getSubmission(req, res, next);
});

// Assignment-scoped grade: PUT /assignments/:assignmentId/submissions/:id/grade
router.put('/:assignmentId/submissions/:id/grade', requireRole(['Admin', 'Teacher']), (req, res, next) => {
  req.query = req.query || {};
  req.query.assignmentId = req.params.assignmentId;
  return gradeSubmission(req, res, next);
});

// Assignment-scoped delete: DELETE /assignments/:assignmentId/submissions/:id
router.delete('/:assignmentId/submissions/:id', requireRole(['Admin', 'Teacher', 'Student']), (req, res, next) => {
  req.query = req.query || {};
  req.query.assignmentId = req.params.assignmentId;
  return deleteSubmission(req, res, next);
});

module.exports = router;