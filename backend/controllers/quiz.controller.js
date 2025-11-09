const Parse = require('../config/parse');

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
    const { title, description, duration, showAnswersAfterSubmit, isPublished, openAt, closeAt } = req.body || {};
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
    if (duration !== undefined) quiz.set('duration', duration);
    if (openAt !== undefined) quiz.set('openAt', openAt ? new Date(openAt) : null);
    if (closeAt !== undefined) quiz.set('closeAt', closeAt ? new Date(closeAt) : null);
    quiz.set('totalPoints', 0);
    quiz.set('showAnswersAfterSubmit', !!showAnswersAfterSubmit);
    quiz.set('isPublished', !!isPublished);

    const saved = await quiz.save(null, { useMasterKey: true });
    res.status(201).json(toJSON(saved));
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

    // Lock quiz if any attempts exist
    if (await hasAttempts(quizId, req.tenantId)) {
      return res.status(400).json({ error: 'Quiz is locked because students have already started attempts' });
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
    if (await hasAttempts(quizId, req.tenantId)) {
      return res.status(400).json({ error: 'Quiz is locked because students have already started attempts' });
    }
    quiz.set('isPublished', false);
    const saved = await quiz.save(null, { useMasterKey: true });
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
    if (await hasAttempts(quizId, req.tenantId)) {
      return res.status(400).json({ error: 'Quiz is locked because students have already started attempts' });
    }
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