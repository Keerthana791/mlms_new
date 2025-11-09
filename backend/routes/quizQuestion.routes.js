const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { addQuestion, listQuestions, updateQuestion, deleteQuestion } = require('../controllers/quizQuestion.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

// Students can GET; Admin/Teacher manage
router.get('/:quizId/questions', listQuestions);
router.post('/:quizId/questions', requireRole(['Admin', 'Teacher']), addQuestion);
router.put('/:quizId/questions/:questionId', requireRole(['Admin', 'Teacher']), updateQuestion);
router.delete('/:quizId/questions/:questionId', requireRole(['Admin', 'Teacher']), deleteQuestion);

module.exports = router;