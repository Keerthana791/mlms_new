// backend/routes/assignment.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
} = require('../controllers/assignment.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

const json50mb = express.json({ limit: '50mb' });

// Create (Admin, Teacher) - supports multipart or JSON base64
router.post('/', upload.single('file'), json50mb, requireRole(['Admin', 'Teacher']), createAssignment);
// Read
router.get('/', listAssignments);
router.get('/:id', getAssignment);
// Update (Admin, Teacher)
router.put('/:id', requireRole(['Admin', 'Teacher']), updateAssignment);
// Delete (Admin, Teacher)
router.delete('/:id', requireRole(['Admin', 'Teacher']), deleteAssignment);

module.exports = router;