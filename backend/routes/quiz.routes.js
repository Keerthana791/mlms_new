const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const {
  createQuizForCourse,
  listQuizzesForCourse,
  getQuizForCourse,
  updateQuizForCourse,
  publishQuiz,
  closeQuiz,
  deleteQuizForCourse,
} = require('../controllers/quiz.controller');

router.use(requireAuth);
router.use(tenantMiddleware);
router.get('/__ping_quiz', (req, res) => res.json({ ok: true }));

// Course-scoped
router.post('/:courseId/quizzes', requireRole(['Admin', 'Teacher']), createQuizForCourse);
router.get('/:courseId/quizzes', listQuizzesForCourse);
router.get('/:courseId/quizzes/:quizId', getQuizForCourse);
router.put('/:courseId/quizzes/:quizId', requireRole(['Admin', 'Teacher']), updateQuizForCourse);
router.put('/:courseId/quizzes/:quizId/publish', requireRole(['Admin', 'Teacher']), publishQuiz);
router.put('/:courseId/quizzes/:quizId/close', requireRole(['Admin', 'Teacher']), closeQuiz);
router.delete('/:courseId/quizzes/:quizId', requireRole(['Admin', 'Teacher']), deleteQuizForCourse);

module.exports = router;