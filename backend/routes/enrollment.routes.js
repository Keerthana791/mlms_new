const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const {
  createSelfEnrollment,
  listSelfEnrollments,
  deleteSelfEnrollment,
} = require('../controllers/enrollment.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

router.post('/self', requireRole(['Student']), createSelfEnrollment);
router.get('/self', requireRole(['Student']), listSelfEnrollments);
router.delete('/self/:courseId', requireRole(['Student']), deleteSelfEnrollment);

module.exports = router;