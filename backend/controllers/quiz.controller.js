const Parse = require('../config/parse');
const { notify } = require('../utils/notify');

const toJSON = (obj) => ({ id: obj.id, ...obj.toJSON() });

async function assertTeacherOwnsCourse(courseId, user, tenantId) {
  let course;
  try {
    course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
  } catch (e) {
    if (e && e.code === 101) { const err = new Error('Course not found'); err.status = 404; throw err; }
    throw e;
  }
  if (course.get('tenantId') !== tenantId) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  if (user.get('role') === 'Teacher' && course.get('teacherId') !== user.id) { const e = new Error('Forbidden'); e.status = 403; throw e; }
  return course;
}

async function ensureEnrolled(courseId, tenantId, user) {
  const enrQ = new Parse.Query('Enrollment');
  enrQ.equalTo('tenantId', tenantId);
  enrQ.equalTo('studentId', user.id);
  enrQ.equalTo('courseId', courseId);
  enrQ.equalTo('status', 'active');
  const enr = await enrQ.first({ useMasterKey: true });
  if (!enr) { const e = new Error('Not enrolled'); e.status = 403; throw e; }
}

async function hasAttempts(quizId, tenantId) {
  const q = new Parse.Query('QuizAttempt');
  q.equalTo('tenantId', tenantId);
  q.equalTo('quizId', quizId);
  const count = await q.count({ useMasterKey: true });
  return count > 0;
}

// Create quiz (course-scoped)
const createQuizForCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const { title, description, durationMinutes, showAnswersAfterSubmit, isPublished, openAt, closeAt } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required' });

    // Validate open/close window if provided
    if (openAt && isNaN(new Date(openAt))) return res.status(400).json({ error: 'openAt must be a valid date' });
    if (closeAt && isNaN(new Date(closeAt))) return res.status(400).json({ error: 'closeAt must be a valid date' });
    if (openAt && closeAt && new Date(openAt) >= new Date(closeAt)) return res.status(400).json({ error: 'openAt must be before closeAt' });

    await assertTeacherOwnsCourse(courseId, req.user, req.tenantId);

    const Quiz = Parse.Object.extend('Quiz');
    const quiz = new Quiz();
    quiz.set('tenantId', req.tenantId);
    quiz.set('courseId', courseId);
    quiz.set('teacherId', req.user.id);
    quiz.set('title', title);
    if (description !== undefined) quiz.set('description', description);
    if (durationMinutes !== undefined) {
      quiz.set('durationMinutes', Number(durationMinutes));
    }
    if (openAt !== undefined) quiz.set('openAt', openAt ? new Date(openAt) : null);
    if (closeAt !== undefined) quiz.set('closeAt', closeAt ? new Date(closeAt) : null);
    quiz.set('totalPoints', 0);
    quiz.set('showAnswersAfterSubmit', !!showAnswersAfterSubmit);
    quiz.set('isPublished', !!isPublished);

   const saved = await quiz.save(null, { useMasterKey: true });

res.status(201).json({
  id: saved.id,
  title: saved.get('title'),
  description: saved.get('description') || null,
  totalPoints: saved.get('totalPoints') || 0,
  durationMinutes: saved.get('durationMinutes') || null,
  showAnswersAfterSubmit: !!saved.get('showAnswersAfterSubmit'),
  isPublished: !!saved.get('isPublished'),
  openAt: saved.get('openAt') || null,
  closeAt: saved.get('closeAt') || null,
  courseId: saved.get('courseId'),
  teacherId: saved.get('teacherId'),
});
  } catch (err) {
    console.error('Create quiz error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to create quiz' });
  }
};

// List quizzes for a course
const listQuizzesForCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const role = req.user.get('role');

    // Verify course exists and tenant matches
    try {
      const course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
      if (course.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });
    } catch (e) {
      if (e && e.code === 101) return res.status(404).json({ error: 'Course not found' });
      throw e;
    }

    if (role === 'Student') {
      await ensureEnrolled(courseId, req.tenantId, req.user);
    } else if (role === 'Teacher') {
      await assertTeacherOwnsCourse(courseId, req.user, req.tenantId);
    }

    const q = new Parse.Query('Quiz');
    q.equalTo('tenantId', req.tenantId);
    q.equalTo('courseId', courseId);
    if (role === 'Student') q.equalTo('isPublished', true);
    q.ascending('createdAt');
    const results = await q.find({ useMasterKey: true });
    res.json(results.map(toJSON));
  } catch (err) {
    console.error('List quizzes error:', err);
    res.status(err.status || 500).json({ error: err.status ? (err.status === 404 ? 'Course not found' : 'Forbidden') : 'Failed to list quizzes' });
  }
};

// Get quiz (course scoped)
const getQuizForCourse = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    const quiz = await new Parse.Query('Quiz').get(quizId, { useMasterKey: true });
    if (quiz.get('tenantId') !== req.tenantId || quiz.get('courseId') !== courseId) return res.status(404).json({ error: 'Not found' });

    const role = req.user.get('role');
    if (role === 'Student') {
      await ensureEnrolled(courseId, req.tenantId, req.user);
      if (!quiz.get('isPublished')) return res.status(404).json({ error: 'Not found' });
    } else if (role === 'Teacher') {
      await assertTeacherOwnsCourse(courseId, req.user, req.tenantId);
    }

    res.json(toJSON(quiz));
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(404).json({ error: 'Quiz not found' });
  }
};

// Update quiz (metadata)
const updateQuizForCourse = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    await assertTeacherOwnsCourse(courseId, req.user, req.tenantId);

    const quiz = await new Parse.Query('Quiz').get(quizId, { useMasterKey: true });
    if (quiz.get('tenantId') !== req.tenantId || quiz.get('courseId') !== courseId) return res.status(404).json({ error: 'Not found' });

    // If attempts exist, only allow unpublish (isPublished=false); block other edits
    const attemptsExist = await hasAttempts(quizId, req.tenantId);
    if (attemptsExist) {
      const payload = req.body || {};
      const onlyUnpublish = Object.keys(payload).every(k => k === 'isPublished') && payload.isPublished === false;
      if (!onlyUnpublish) {
        return res.status(400).json({ error: 'Quiz is locked because students have already started attempts' });
      }
    }

    const { title, description, duration, showAnswersAfterSubmit, isPublished, openAt, closeAt } = req.body || {};

    // Validate open/close window if provided
    if (openAt !== undefined && openAt && isNaN(new Date(openAt))) return res.status(400).json({ error: 'openAt must be a valid date' });
    if (closeAt !== undefined && closeAt && isNaN(new Date(closeAt))) return res.status(400).json({ error: 'closeAt must be a valid date' });
    if ((openAt !== undefined || closeAt !== undefined)) {
      const nextOpen = openAt !== undefined ? (openAt ? new Date(openAt) : null) : quiz.get('openAt');
      const nextClose = closeAt !== undefined ? (closeAt ? new Date(closeAt) : null) : quiz.get('closeAt');
      if (nextOpen && nextClose && nextOpen >= nextClose) return res.status(400).json({ error: 'openAt must be before closeAt' });
    }

    if (title !== undefined) quiz.set('title', title);
    if (description !== undefined) quiz.set('description', description);
    if (duration !== undefined) quiz.set('duration', duration);
    if (openAt !== undefined) quiz.set('openAt', openAt ? new Date(openAt) : null);
    if (closeAt !== undefined) quiz.set('closeAt', closeAt ? new Date(closeAt) : null);
    if (showAnswersAfterSubmit !== undefined) quiz.set('showAnswersAfterSubmit', !!showAnswersAfterSubmit);
    if (isPublished !== undefined) quiz.set('isPublished', !!isPublished);

    const saved = await quiz.save(null, { useMasterKey: true });
    res.json(toJSON(saved));
  } catch (err) {
    console.error('Update quiz error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to update quiz' });
  }
};

const publishQuiz = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    await assertTeacherOwnsCourse(courseId, req.user, req.tenantId);

    const quiz = await new Parse.Query('Quiz').get(quizId, { useMasterKey: true });
    if (quiz.get('tenantId') !== req.tenantId || quiz.get('courseId') !== courseId) return res.status(404).json({ error: 'Not found' });
    if (await hasAttempts(quizId, req.tenantId)) {
      return res.status(400).json({ error: 'Quiz is locked because students have already started attempts' });
    }
    quiz.set('isPublished', true);
    const saved = await quiz.save(null, { useMasterKey: true });

    let courseTitle = 'Course';
    try {
      const course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
      if (course && course.get('tenantId') === req.tenantId) {
        courseTitle = course.get('title') || 'Course';
      }
    } catch (e) { /* ignore */ }

    const titleText = saved.get('title') || 'Quiz';

    // Notify enrolled students: QUIZ_PUBLISHED
    try {
      const enrQ = new Parse.Query('Enrollment');
      enrQ.equalTo('tenantId', req.tenantId);
      enrQ.equalTo('courseId', courseId);
      enrQ.equalTo('status', 'active');
      const enrollments = await enrQ.find({ useMasterKey: true });
      const studentIds = Array.from(new Set(enrollments.map(e => e.get('studentId'))));
      if (studentIds.length) {
        const exp = saved.get('closeAt') ? new Date(saved.get('closeAt')) : null;
        const titleText = saved.get('title') || 'Quiz';
        await notify({
          tenantId: req.tenantId,
          userIds: studentIds,
          type: 'QUIZ_PUBLISHED',
          title: `New Quiz Published: ${titleText}`,
          message: `New quiz "${titleText}" published in course "${courseTitle}"`,
          data: { quizId: saved.id, courseId, openAt: saved.get('openAt') || null, closeAt: saved.get('closeAt') || null },
          expiresAt: exp,
          createdBy: req.user.id,
        });
      }
    } catch (e) { /* swallow notification errors */ }

    res.json(toJSON(saved));
  } catch (err) {
    console.error('Publish quiz error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to publish quiz' });
  }
};

const closeQuiz = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    await assertTeacherOwnsCourse(courseId, req.user, req.tenantId);
    const quiz = await new Parse.Query('Quiz').get(quizId, { useMasterKey: true });
    if (quiz.get('tenantId') !== req.tenantId || quiz.get('courseId') !== courseId) return res.status(404).json({ error: 'Not found' });
    // Allow closing (unpublish) even after attempts exist, to stop visibility
    quiz.set('isPublished', false);
    const saved = await quiz.save(null, { useMasterKey: true });
    let courseTitle = 'Course';
    try {
      const course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
      if (course && course.get('tenantId') === req.tenantId) {
        courseTitle = course.get('title') || 'Course';
      }
    } catch (e) { /* ignore */ }

    const titleText = saved.get('title') || 'Quiz';

    // Notify enrolled students: QUIZ_CLOSED
    // Notify enrolled students: QUIZ_CLOSED
    try {
      const enrQ = new Parse.Query('Enrollment');
      enrQ.equalTo('tenantId', req.tenantId);
      enrQ.equalTo('courseId', courseId);
      enrQ.equalTo('status', 'active');
      const enrollments = await enrQ.find({ useMasterKey: true });
      const studentIds = Array.from(new Set(enrollments.map(e => e.get('studentId'))));
      if (studentIds.length) {
        const titleText = saved.get('title') || 'Quiz';
        await notify({
          tenantId: req.tenantId,
          userIds: studentIds,
          type: 'QUIZ_CLOSED',
          title: `Quiz Closed: ${titleText}`,
          message: `Quiz "${titleText}" in course "${courseTitle}" was closed`,
          data: {
            quizId: saved.id,
            courseId,
            closeAt: saved.get('closeAt') || new Date(),
          },
          createdBy: req.user.id,
        });
      }
    } catch (e) { /* swallow notification errors */ }

    res.json(toJSON(saved));
  } catch (err) {
    console.error('Close quiz error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to close quiz' });
  }
};

const deleteQuizForCourse = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    await assertTeacherOwnsCourse(courseId, req.user, req.tenantId);
    const quiz = await new Parse.Query('Quiz').get(quizId, { useMasterKey: true });
    if (quiz.get('tenantId') !== req.tenantId || quiz.get('courseId') !== courseId) return res.status(404).json({ error: 'Not found' });
    const attemptsQ = new Parse.Query('QuizAttempt');
    attemptsQ.equalTo('tenantId', req.tenantId);
    attemptsQ.equalTo('quizId', quizId);
    const attemptsExist = await attemptsQ.count({ useMasterKey: true });

    if (attemptsExist > 0) {
      // Support completed-only hard delete when explicitly forced
      const isForce = (req.query && (req.query.force === 'true' || req.query.force === true));
      if (!isForce) {
        return res.status(400).json({ error: 'Quiz is locked because students have already started attempts' });
      }
      // Ensure no in-progress attempts remain
      const inProgQ = new Parse.Query('QuizAttempt');
      inProgQ.equalTo('tenantId', req.tenantId);
      inProgQ.equalTo('quizId', quizId);
      inProgQ.notEqualTo('status', 'submitted');
      const inProgCount = await inProgQ.count({ useMasterKey: true });
      if (inProgCount > 0) {
        return res.status(400).json({ error: 'Cannot delete while attempts are still in progress' });
      }

      // Cascade delete: answers -> attempts -> questions -> quiz
      const attempts = await attemptsQ.find({ useMasterKey: true });
      const attemptIds = attempts.map(a => a.id);

      // Delete answers for these attempts
      if (attemptIds.length > 0) {
        const ansQ = new Parse.Query('QuizAnswer');
        ansQ.equalTo('tenantId', req.tenantId);
        ansQ.containedIn('attemptId', attemptIds);
        const answers = await ansQ.find({ useMasterKey: true });
        if (answers.length > 0) await Parse.Object.destroyAll(answers, { useMasterKey: true });
      }

      // Delete attempts
      if (attempts.length > 0) await Parse.Object.destroyAll(attempts, { useMasterKey: true });

      // Delete questions for this quiz
      const qq = new Parse.Query('QuizQuestion');
      qq.equalTo('tenantId', req.tenantId);
      qq.equalTo('quizId', quizId);
      const questions = await qq.find({ useMasterKey: true });
      if (questions.length > 0) await Parse.Object.destroyAll(questions, { useMasterKey: true });

      // Finally delete quiz
      await quiz.destroy({ useMasterKey: true });
      return res.json({ success: true, deleted: { answers: true, attempts: true, questions: true, quiz: true } });
    }

    // No attempts: normal delete
    await quiz.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete quiz error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to delete quiz' });
  }
};

module.exports = {
  createQuizForCourse,
  listQuizzesForCourse,
  getQuizForCourse,
  updateQuizForCourse,
  publishQuiz,
  closeQuiz,
  deleteQuizForCourse,
};