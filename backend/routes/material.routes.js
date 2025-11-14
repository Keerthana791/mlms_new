// backend/routes/material.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { uploadMaterial, listMaterials, deleteMaterial } = require('../controllers/material.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

const json100mb = express.json({ limit: '100mb' });

// Course Material routes
router.post('/:courseId/materials', upload.single('file'), json100mb, requireRole(['Admin', 'Teacher']), uploadMaterial);
router.delete('/:courseId/materials/:materialId', requireRole(['Admin', 'Teacher']), deleteMaterial);
router.get('/:courseId/materials', listMaterials);

module.exports = router;
