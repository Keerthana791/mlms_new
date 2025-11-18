const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { startAttempt, submitAttempt, listAttempts, getAttempt, getActiveAttempt,} = require('../controllers/quizAttempt.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

router.post('/:quizId/attempts/start', requireRole(['Student']), startAttempt);
router.post('/:quizId/attempts/:attemptId/submit', requireRole(['Student']), submitAttempt);

router.get('/:quizId/attempts/active', requireRole(['Student']), getActiveAttempt);
router.get('/:quizId/attempts', listAttempts);
router.get('/:quizId/attempts/:attemptId', getAttempt);

module.exports = router;