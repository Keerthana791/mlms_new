// backend/routes/assignment.routes.js
const express = require('express');
const router = express.Router();
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

// Create (Admin, Teacher)
router.post('/', requireRole(['Admin', 'Teacher']), createAssignment);
// Read
router.get('/', listAssignments);
router.get('/:id', getAssignment);
// Update (Admin, Teacher)
router.put('/:id', requireRole(['Admin', 'Teacher']), updateAssignment);
// Delete (Admin, Teacher)
router.delete('/:id', requireRole(['Admin', 'Teacher']), deleteAssignment);

module.exports = router;