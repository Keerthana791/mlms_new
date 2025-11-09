const Parse = require('../config/parse');

const toJSON = (obj) => ({ id: obj.id, ...obj.toJSON() });

async function assertTeacherOwnsQuiz(quizId, user, tenantId) {
  const quiz = await new Parse.Query('Quiz').get(quizId, { useMasterKey: true });
  if (quiz.get('tenantId') !== tenantId) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  const course = await new Parse.Query('Course').get(quiz.get('courseId'), { useMasterKey: true });
  if (user.get('role') === 'Teacher' && course.get('teacherId') !== user.id) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  return quiz;
}

async function ensureEnrolledForQuiz(quiz, tenantId, user) {
  const enrQ = new Parse.Query('Enrollment');
  enrQ.equalTo('tenantId', tenantId);
  enrQ.equalTo('studentId', user.id);
  enrQ.equalTo('courseId', quiz.get('courseId'));
  enrQ.equalTo('status', 'active');
  const enr = await enrQ.first({ useMasterKey: true });
  if (!enr) { const e = new Error('Not enrolled'); e.status = 403; throw e; }
}

async function recomputeTotalPoints(quizId, tenantId) {
  const qq = new Parse.Query('QuizQuestion');
  qq.equalTo('tenantId', tenantId);
  qq.equalTo('quizId', quizId);
  const qs = await qq.find({ useMasterKey: true });
  const total = qs.reduce((sum, q) => sum + (q.get('marks') || 0), 0);
  const quiz = await new Parse.Query('Quiz').get(quizId, { useMasterKey: true });
  if (quiz.get('tenantId') !== tenantId) return; // safety
  quiz.set('totalPoints', total);
  await quiz.save(null, { useMasterKey: true });
}

async function hasAttempts(quizId, tenantId) {
  const q = new Parse.Query('QuizAttempt');
  q.equalTo('tenantId', tenantId);
  q.equalTo('quizId', quizId);
  const count = await q.count({ useMasterKey: true });
  return count > 0;
}

const addQuestion = async (req, res) => {
  try {
    const { quizId } = req.params;
    await assertTeacherOwnsQuiz(quizId, req.user, req.tenantId);

    // Lock question CRUD if attempts exist
    if (await hasAttempts(quizId, req.tenantId)) {
      return res.status(400).json({ error: 'Quiz is locked because students have already started attempts' });
    }

    const { questionText, options, correctAnswers, marks, order, media } = req.body || {};
    if (!questionText || !Array.isArray(options) || !Array.isArray(correctAnswers)) {
      return res.status(400).json({ error: 'questionText, options[], correctAnswers[] are required' });
    }

    const QQ = Parse.Object.extend('QuizQuestion');
    const q = new QQ();
    q.set('tenantId', req.tenantId);
    q.set('quizId', quizId);
    q.set('questionText', questionText);
    q.set('options', options);
    q.set('correctAnswers', correctAnswers);
    if (marks !== undefined) q.set('marks', marks);
    if (order !== undefined) q.set('order', order);
    if (media !== undefined) q.set('media', media);

    const saved = await q.save(null, { useMasterKey: true });
    await recomputeTotalPoints(quizId, req.tenantId);
    res.status(201).json(toJSON(saved));
  } catch (err) {
    console.error('Add question error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to add question' });
  }
};

const listQuestions = async (req, res) => {
  try {
    const { quizId } = req.params;
    const quiz = await new Parse.Query('Quiz').get(quizId, { useMasterKey: true });
    if (quiz.get('tenantId') !== req.tenantId) return res.status(404).json({ error: 'Not found' });

    const role = req.user.get('role');
    if (role === 'Student') {
      await ensureEnrolledForQuiz(quiz, req.tenantId, req.user);
      if (!quiz.get('isPublished')) return res.status(404).json({ error: 'Not found' });
    } else if (role === 'Teacher') {
      await assertTeacherOwnsQuiz(quizId, req.user, req.tenantId);
    }

    const qq = new Parse.Query('QuizQuestion');
    qq.equalTo('tenantId', req.tenantId);
    qq.equalTo('quizId', quizId);
    qq.ascending('order');
    const results = await qq.find({ useMasterKey: true });

    // Determine if student is allowed to see correct answers
    let studentCanSeeCorrect = false;
    if (role === 'Student') {
      const submittedAttempt = await new Parse.Query('QuizAttempt')
        .equalTo('tenantId', req.tenantId)
        .equalTo('quizId', quizId)
        .equalTo('studentId', req.user.id)
        .equalTo('status', 'submitted')
        .first({ useMasterKey: true });
      studentCanSeeCorrect = !!submittedAttempt && !!quiz.get('showAnswersAfterSubmit');
    }

    const json = results.map(toJSON);
    if (role === 'Student' && !studentCanSeeCorrect) {
      json.forEach(j => { delete j.correctAnswers; });
    }

    res.json(json);
  } catch (err) {
    console.error('List questions error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to list questions' });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    await assertTeacherOwnsQuiz(quizId, req.user, req.tenantId);

    // Lock question CRUD if attempts exist
    if (await hasAttempts(quizId, req.tenantId)) {
      return res.status(400).json({ error: 'Quiz is locked because students have already started attempts' });
    }

    const q = await new Parse.Query('QuizQuestion').get(questionId, { useMasterKey: true });
    if (q.get('tenantId') !== req.tenantId || q.get('quizId') !== quizId) return res.status(404).json({ error: 'Not found' });

    const { questionText, options, correctAnswers, marks, order, media } = req.body || {};
    if (questionText !== undefined) q.set('questionText', questionText);
    if (options !== undefined) q.set('options', options);
    if (correctAnswers !== undefined) q.set('correctAnswers', correctAnswers);
    if (marks !== undefined) q.set('marks', marks);
    if (order !== undefined) q.set('order', order);
    if (media !== undefined) q.set('media', media);

    const saved = await q.save(null, { useMasterKey: true });
    await recomputeTotalPoints(quizId, req.tenantId);
    res.json(toJSON(saved));
  } catch (err) {
    console.error('Update question error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to update question' });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const { quizId, questionId } = req.params;
    await assertTeacherOwnsQuiz(quizId, req.user, req.tenantId);

    // Lock question CRUD if attempts exist
    if (await hasAttempts(quizId, req.tenantId)) {
      return res.status(400).json({ error: 'Quiz is locked because students have already started attempts' });
    }

    const q = await new Parse.Query('QuizQuestion').get(questionId, { useMasterKey: true });
    if (q.get('tenantId') !== req.tenantId || q.get('quizId') !== quizId) return res.status(404).json({ error: 'Not found' });

    await q.destroy({ useMasterKey: true });
    await recomputeTotalPoints(quizId, req.tenantId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete question error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to delete question' });
  }
};

module.exports = { addQuestion, listQuestions, updateQuestion, deleteQuestion };