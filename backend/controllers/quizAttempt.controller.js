const Parse = require('../config/parse');
const { notify } = require('../utils/notify');

const toJSON = (obj) => ({ id: obj.id, ...obj.toJSON() });

async function getQuiz(quizId) {
  return new Parse.Query('Quiz').get(quizId, { useMasterKey: true });
}

function remainingSeconds(expiresAt) {
  if (!expiresAt) return null;
  const d = (expiresAt && typeof expiresAt === 'object' && expiresAt.iso)
    ? new Date(expiresAt.iso)
    : new Date(expiresAt);
  if (isNaN(d)) return 0;
  const diff = Math.floor((d.getTime() - Date.now()) / 1000);
  return diff > 0 ? diff : 0;
}

async function studentCanSeeCorrect(quiz, attempt, tenantId, user) {
  if (user.get('role') !== 'Student') return false;
  if (!quiz.get('showAnswersAfterSubmit')) return false;
  if (attempt) return attempt.get('status') === 'submitted' && attempt.get('studentId') === user.id;
  const submitted = await new Parse.Query('QuizAttempt')
    .equalTo('tenantId', tenantId)
    .equalTo('quizId', quiz.id || quiz.get('objectId') || quiz.id)
    .equalTo('studentId', user.id)
    .equalTo('status', 'submitted')
    .first({ useMasterKey: true });
  return !!submitted;
}

async function sanitizeAttemptOut(attempt, role, quiz, user) {
  const base = toJSON(attempt);
  base.remainingSeconds = remainingSeconds(base.expiresAt);
  if (role === 'Student') {
    const out = {
      id: base.id,
      startedAt: base.startedAt,
      expiresAt: base.expiresAt,
      status: base.status,
      submittedAt: base.submittedAt,
      remainingSeconds: base.remainingSeconds,
    };
    if (base.status === 'submitted') out.score = base.score;
    out.studentCanSeeCorrect = !!quiz && !!quiz.get && quiz.get('showAnswersAfterSubmit') && base.status === 'submitted' && attempt.get('studentId') === user.id;
    return out;
  }
  return base;
}

async function ensureEnrolledForCourse(courseId, tenantId, user) {
  const enrQ = new Parse.Query('Enrollment');
  enrQ.equalTo('tenantId', tenantId);
  enrQ.equalTo('studentId', user.id);
  enrQ.equalTo('courseId', courseId);
  enrQ.equalTo('status', 'active');
  const enr = await enrQ.first({ useMasterKey: true });
  if (!enr) { const e = new Error('Not enrolled'); e.status = 403; throw e; }
}

async function assertTeacherOwnsQuiz(quiz, user) {
  if (user.get('role') !== 'Teacher') return;
  const course = await new Parse.Query('Course').get(quiz.get('courseId'), { useMasterKey: true });
  if (course.get('teacherId') !== user.id) { const e = new Error('Forbidden'); e.status = 403; throw e; }
}

function eqSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const sa = new Set(a), sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

function toNumberArray(value) {
  if (Array.isArray(value)) return value.map(v => Number(v));
  return [Number(value)];
}

function isValidIndices(indices, optionsLength) {
  if (!Array.isArray(indices)) return false;
  for (const i of indices) {
    if (!Number.isInteger(i)) return false;
    if (i < 0 || i >= optionsLength) return false;
  }
  return true;
}

// answers: array of answer JSONs { questionId, selectedOptionIndex, score }
// opts: { canSeeCorrect: boolean, includeScore: boolean, questionMap?: Map(questionId -> QuizQuestion Parse.Object) }
function sanitizeAnswersOut(answers, opts) {
  const { canSeeCorrect, includeScore, questionMap } = opts || {};
  if (!Array.isArray(answers)) return [];
  return answers.map(a => {
    const out = {
      questionId: a.questionId,
      selectedOptionIndex: a.selectedOptionIndex,
    };
    if (includeScore && typeof a.score !== 'undefined') {
      out.score = a.score;
    }
    if (canSeeCorrect && questionMap && questionMap.has(a.questionId)) {
      const q = questionMap.get(a.questionId);
      out.correctAnswers = (q.get('correctAnswers') || []).map(n => Number(n)).filter(n => Number.isInteger(n));
    }
    return out;
  });
}

const startAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const quiz = await getQuiz(quizId);
    if (quiz.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });
    if (!quiz.get('isPublished')) return res.status(400).json({ error: 'Quiz not published' });

    // Enforce open/close window
    const now = new Date();
    const openAt = quiz.get('openAt');
    const closeAt = quiz.get('closeAt');
    if (openAt && now < new Date(openAt)) return res.status(400).json({ error: 'Quiz not open yet' });
    if (closeAt && now >= new Date(closeAt)) return res.status(400).json({ error: 'Quiz is closed' });

    await ensureEnrolledForCourse(quiz.get('courseId'), req.tenantId, req.user);

    // Prevent multiple attempts per student
    // Prevent multiple attempts per student, but be idempotent:
    // if an in_progress attempt already exists, just return it.
    const existingQ = new Parse.Query('QuizAttempt');
    existingQ.equalTo('tenantId', req.tenantId);
    existingQ.equalTo('quizId', quizId);
    existingQ.equalTo('studentId', req.user.id);
    existingQ.equalTo('status', 'in_progress');
    const existingAttempt = await existingQ.first({ useMasterKey: true });

    if (existingAttempt) {
      const out = await sanitizeAttemptOut(existingAttempt, req.user.get('role'), quiz, req.user);
      return res.status(200).json(out);
    }

    const Attempt = Parse.Object.extend('QuizAttempt');
    const attempt = new Attempt();
    attempt.set('tenantId', req.tenantId);
    attempt.set('quizId', quizId);
    attempt.set('studentId', req.user.id);
    attempt.set('startedAt', now);

    // Compute expiresAt as min(start+duration, closeAt) if provided
    // Compute expiresAt as min(start+durationMinutes, closeAt) if provided
    const durationMinutes = Number(
      quiz.get('durationMinutes') ?? quiz.get('duration')
    );
    let expiresAt = null;
    if (!Number.isNaN(durationMinutes) && durationMinutes > 0) {
      expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
    }
    if (closeAt) {
      const closeTime = new Date(closeAt);
      expiresAt = expiresAt ? new Date(Math.min(expiresAt.getTime(), closeTime.getTime())) : closeTime;
    }
    if (expiresAt) attempt.set('expiresAt', expiresAt);

    attempt.set('status', 'in_progress');
    attempt.set('score', 0);

    const saved = await attempt.save(null, { useMasterKey: true });
    const out = await sanitizeAttemptOut(saved, req.user.get('role'), quiz, req.user);
    res.status(201).json(out);
  } catch (err) {
    console.error('Start attempt error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to start attempt' });
  }
};

const submitAttempt = async (req, res) => {
  try {
    const { quizId, attemptId } = req.params;
    const { answers } = req.body || {};
    if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers[] is required' });

    const attempt = await new Parse.Query('QuizAttempt').get(attemptId, { useMasterKey: true });
    if (attempt.get('tenantId') !== req.tenantId || attempt.get('quizId') !== quizId) return res.status(403).json({ error: 'Forbidden' });
    if (attempt.get('studentId') !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (attempt.get('status') !== 'in_progress') return res.status(400).json({ error: 'Attempt not in progress' });

    const quiz = await getQuiz(quizId);
    if (quiz.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    // Enforce close window at submit as well
    const now = new Date();
    const closeAt = quiz.get('closeAt');
    if (closeAt && now > new Date(closeAt)) return res.status(400).json({ error: 'Quiz window closed' });

    const expiresAt = attempt.get('expiresAt');
    if (expiresAt && now > new Date(expiresAt)) return res.status(400).json({ error: 'Time limit exceeded' });

    const qq = new Parse.Query('QuizQuestion');
    qq.equalTo('tenantId', req.tenantId);
    qq.equalTo('quizId', quizId);
    const questions = await qq.find({ useMasterKey: true });
    const qMap = new Map();
    questions.forEach(q => qMap.set(q.id, q));

    // Idempotency: delete existing answers for this attempt before saving new ones
    const existingAnsQ = new Parse.Query('QuizAnswer');
    existingAnsQ.equalTo('tenantId', req.tenantId);
    existingAnsQ.equalTo('attemptId', attemptId);
    const existingAnswers = await existingAnsQ.find({ useMasterKey: true });
    if (existingAnswers.length) await Parse.Object.destroyAll(existingAnswers, { useMasterKey: true });

    // Build new answers and save in batch
    let total = 0;
    const Answer = Parse.Object.extend('QuizAnswer');
    const batch = [];
    for (const a of answers) {
      const q = qMap.get(a.questionId);
      if (!q) continue;

      const options = q.get('options') || [];
      const selected = toNumberArray(a.selectedOptionIndex).filter(n => !Number.isNaN(n));
      if (!isValidIndices(selected, options.length)) {
        return res.status(400).json({ error: `Invalid selectedOptionIndex for question ${q.id}` });
      }

      const correct = (q.get('correctAnswers') || []).map(n => Number(n)).filter(n => Number.isInteger(n));
      const marks = Number(q.get('marks') || 0);
      const ok = eqSet(selected, correct);
      const s = ok ? marks : 0;
      total += s;

      const ans = new Answer();
      ans.set('tenantId', req.tenantId);
      ans.set('attemptId', attemptId);
      ans.set('questionId', q.id);
      ans.set('selectedOptionIndex', selected);
      ans.set('score', s);
      batch.push(ans);
    }
    if (batch.length) await Parse.Object.saveAll(batch, { useMasterKey: true });

    // Mark attempt as submitted
    attempt.set('score', total);
    attempt.set('status', 'submitted');
    attempt.set('submittedAt', new Date());
    const saved = await attempt.save(null, { useMasterKey: true });

    // Notify student: QUIZ_GRADED
    // after computing total and saving attempt
    const quizTitle = quiz.get('title') || 'Quiz';
    const courseId = quiz.get('courseId');
    let courseTitle = 'Course';
    try {
      const course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
      if (course && course.get('tenantId') === req.tenantId) {
        courseTitle = course.get('title') || 'Course';
      }
    } catch (e) { /* ignore */ }

    const totalMarks = Number(quiz.get('totalPoints') || 0);
    const score = total; // your computed score

    try {
      await notify({
        tenantId: req.tenantId,
        userIds: [req.user.id],
        type: 'QUIZ_GRADED',
        title: `Quiz Graded: ${quizTitle}`,
        message: `Your quiz "${quizTitle}" in course "${courseTitle}" was graded: ${score} out of ${totalMarks}`,
        data: {
          quizId,
          courseId,
          courseTitle,
          attemptId: saved.id,
          score,
          totalMarks,
        },
        createdBy: req.user.id,
      });
    } catch (e) { /* swallow notification errors */ }

    const out = await sanitizeAttemptOut(saved, req.user.get('role'), quiz, req.user);
    res.json(out);
  } catch (err) {
    console.error('Submit attempt error:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Failed to submit attempt' });
  }
};

const listAttempts = async (req, res) => {
  try {
    const { quizId } = req.params;
    const quiz = await getQuiz(quizId);
    if (quiz.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    const role = req.user.get('role');
    const q = new Parse.Query('QuizAttempt');
    q.equalTo('tenantId', req.tenantId);
    q.equalTo('quizId', quizId);
    if (role === 'Student') {
      await ensureEnrolledForCourse(quiz.get('courseId'), req.tenantId, req.user);
      q.equalTo('studentId', req.user.id);
    } else if (role === 'Teacher') {
      await assertTeacherOwnsQuiz(quiz, req.user);
    }
    const results = await q.find({ useMasterKey: true });
    const roleResp = req.user.get('role');
    if (roleResp === 'Student') {
      const outs = await Promise.all(results.map(a => sanitizeAttemptOut(a, roleResp, quiz, req.user)));
      return res.json(outs);
    }
    // For Teacher/Admin: include answers and correct answers
    const attemptIds = results.map(a => a.id);
    let answersByAttempt = new Map();
    if (attemptIds.length > 0) {
      const ansQ = new Parse.Query('QuizAnswer');
      ansQ.equalTo('tenantId', req.tenantId);
      ansQ.containedIn('attemptId', attemptIds);
      const ans = await ansQ.find({ useMasterKey: true });
      for (const a of ans) {
        const aj = toJSON(a);
        const arr = answersByAttempt.get(aj.attemptId) || [];
        arr.push(aj);
        answersByAttempt.set(aj.attemptId, arr);
      }
    }
    // Load questions once to attach correctAnswers
    const qq = new Parse.Query('QuizQuestion');
    qq.equalTo('tenantId', req.tenantId);
    qq.equalTo('quizId', quizId);
    const qs = await qq.find({ useMasterKey: true });
    const qMap = new Map(qs.map(q => [q.id, q]));

    const outWithAnswers = results.map(a => {
      const base = toJSON(a);
      const ans = answersByAttempt.get(base.id) || [];
      base.answers = sanitizeAnswersOut(ans, { canSeeCorrect: true, includeScore: true, questionMap: qMap });
      return base;
    });
    res.json(outWithAnswers);
  } catch (err) {
    console.error('List attempts error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to list attempts' });
  }
};

const getAttempt = async (req, res) => {
  try {
    const { quizId, attemptId } = req.params;
    const attempt = await new Parse.Query('QuizAttempt').get(attemptId, { useMasterKey: true });
    if (attempt.get('tenantId') !== req.tenantId || attempt.get('quizId') !== quizId) return res.status(403).json({ error: 'Forbidden' });

    const role = req.user.get('role');
    if (role === 'Student' && attempt.get('studentId') !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    if (role === 'Teacher') {
      const quiz = await getQuiz(quizId);
      if (quiz.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });
      await assertTeacherOwnsQuiz(quiz, req.user);
    }

    const quiz = await getQuiz(quizId);
    const out = await sanitizeAttemptOut(attempt, req.user.get('role'), quiz, req.user);
    // Include answers conditionally
    const roleGA = req.user.get('role');
    const isOwner = attempt.get('studentId') === req.user.id;
    let includeAnswers = false;
    let canSeeCorrect = false;
    let includeScore = false;
    if (roleGA === 'Student') {
      includeAnswers = isOwner; // only their own attempt
      includeScore = attempt.get('status') === 'submitted';
      canSeeCorrect = quiz.get('showAnswersAfterSubmit') && attempt.get('status') === 'submitted' && isOwner;
    } else {
      // Teacher/Admin
      includeAnswers = true;
      includeScore = true;
      canSeeCorrect = true;
    }
    if (includeAnswers) {
      const ansQ = new Parse.Query('QuizAnswer');
      ansQ.equalTo('tenantId', req.tenantId);
      ansQ.equalTo('attemptId', attempt.id);
      const ans = await ansQ.find({ useMasterKey: true });
      let qMap;
      if (canSeeCorrect) {
        const qq = new Parse.Query('QuizQuestion');
        qq.equalTo('tenantId', req.tenantId);
        qq.equalTo('quizId', quizId);
        const qs = await qq.find({ useMasterKey: true });
        qMap = new Map(qs.map(q => [q.id, q]));
      }
      out.answers = sanitizeAnswersOut(ans.map(toJSON), { canSeeCorrect, includeScore, questionMap: qMap });
    }
    res.json(out);
  } catch (err) {
    console.error('Get attempt error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to get attempt' });
  }
};

// Get student's active attempt with remaining time
const getActiveAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const quiz = await getQuiz(quizId);
    if (quiz.get('tenantId') !== req.tenantId) return res.status(403).json({ error: 'Forbidden' });

    // Only student can fetch their active attempt
    if (req.user.get('role') !== 'Student') return res.status(403).json({ error: 'Forbidden' });

    const q = new Parse.Query('QuizAttempt');
    q.equalTo('tenantId', req.tenantId);
    q.equalTo('quizId', quizId);
    q.equalTo('studentId', req.user.id);
    q.equalTo('status', 'in_progress');
    const attempt = await q.first({ useMasterKey: true });
    if (!attempt) return res.status(404).json({ error: 'No active attempt' });

    const out = await sanitizeAttemptOut(attempt, req.user.get('role'), quiz, req.user);
    // Include any previously saved answers if present (e.g., autosave). No correct answers and no per-answer score while in progress for students.
    const ansQ = new Parse.Query('QuizAnswer');
    ansQ.equalTo('tenantId', req.tenantId);
    ansQ.equalTo('attemptId', attempt.id);
    const ans = await ansQ.find({ useMasterKey: true });
    out.answers = sanitizeAnswersOut(ans.map(toJSON), { canSeeCorrect: false, includeScore: false });
    res.json(out);
  } catch (err) {
    console.error('Get active attempt error:', err);
    res.status(err.status || 500).json({ error: err.status ? 'Forbidden' : 'Failed to get active attempt' });
  }
};


module.exports = { startAttempt, submitAttempt, listAttempts, getAttempt, getActiveAttempt };