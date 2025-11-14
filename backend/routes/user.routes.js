// backend/routes/user.routes.js
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { listUsers } = require('../controllers/user.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

// Only Admins can list users; role filter comes from query (?role=Teacher)
router.get('/', requireRole(['Admin', 'Teacher', 'Student']), listUsers);

module.exports = router;