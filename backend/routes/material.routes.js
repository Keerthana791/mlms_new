// backend/routes/mterial.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { uploadMaterial, listMaterials } = require('../controllers/material.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

// Per-route JSON limit for large base64 uploads
const json100mb = express.json({ limit: '100mb' });

// Upload: Admin or Teacher (owning Teacher validated in controller)
router.post('/:courseId/materials', upload.single('file'), json100mb, requireRole(['Admin', 'Teacher']), uploadMaterial);

// List: any authenticated; controller enforces RBAC (Admin, owning Teacher, enrolled Student)
router.get('/:courseId/materials', listMaterials);

module.exports = router;