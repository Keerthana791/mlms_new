const request = require('supertest');

// Ensure server does not start listener in tests
process.env.NODE_ENV = 'test';

jest.mock('../../config/parse', () => require('../mocks/parseMock'));
jest.mock('../../utils/notify', () => ({ notify: jest.fn(async () => 1) }));
// Stub auth middleware to inject a Teacher user in tenant t1 with deterministic id
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const Parse = require('../../config/parse');
    const user = Parse.__create('User', { tenantId: 't1', role: 'Teacher', usernameOnTenant: 'teach1', username: 't1:teach1', email: 't@x.com' });
    user.id = 'teach1';
    req.user = user;
    req.sessionToken = 's1';
    req.headers['x-tenant-id'] = 't1';
    req.tenantId = 't1';
    next();
  },
  requireRole: (roles) => (req, res, next) => roles.includes(req.user.get('role')) ? next() : res.status(403).json({ error: 'Forbidden' })
}));

const app = require('../../server');
const Parse = require('../../config/parse');
const { notify } = require('../../utils/notify');

describe('Quiz -> QUIZ_PUBLISHED and QUIZ_CLOSED notifications', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  function seedCourseAndEnrollments() {
    const course = Parse.__create('Course', { tenantId: 't1', teacherId: 'teach1', title: 'Course 1' });
    const s1 = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 's1', username: 't1:s1', email: 's1@x.com' });
    const s2 = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 's2', username: 't1:s2', email: 's2@x.com' });
    Parse.__create('Enrollment', { tenantId: 't1', courseId: course.id, studentId: s1.id, status: 'active' });
    Parse.__create('Enrollment', { tenantId: 't1', courseId: course.id, studentId: s2.id, status: 'active' });
    return { course, s1, s2 };
  }

  test('publish quiz notifies enrolled students with expiresAt=closeAt', async () => {
    const { course, s1, s2 } = seedCourseAndEnrollments();
    // Seed a quiz belonging to the course, unpublished
    const Quiz = Parse.Object.extend('Quiz');
    const quiz = new Quiz();
    quiz.set('tenantId', 't1');
    quiz.set('courseId', course.id);
    quiz.set('teacherId', 'teach1');
    quiz.set('title', 'Q1');
    quiz.set('isPublished', false);
    const closeAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    quiz.set('closeAt', closeAt);
    await quiz.save();

    // Publish
    const res = await request(app)
      .put(`/api/courses/${course.id}/quizzes/${quiz.id}/publish`)
      .send({});

    expect(res.status).toBe(200);
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.type).toBe('QUIZ_PUBLISHED');
    expect(payload.tenantId).toBe('t1');
    expect(payload.userIds.sort()).toEqual([s1.id, s2.id].sort());
    // expiresAt should equal closeAt when present
    expect(new Date(payload.expiresAt).toISOString()).toBe(closeAt.toISOString());
  });

  test('close quiz notifies enrolled students', async () => {
    const { course, s1, s2 } = seedCourseAndEnrollments();
    const Quiz = Parse.Object.extend('Quiz');
    const quiz = new Quiz();
    quiz.set('tenantId', 't1');
    quiz.set('courseId', course.id);
    quiz.set('teacherId', 'teach1');
    quiz.set('title', 'Q2');
    quiz.set('isPublished', true);
    await quiz.save();

    const res = await request(app)
      .put(`/api/courses/${course.id}/quizzes/${quiz.id}/close`)
      .send({});

    expect(res.status).toBe(200);
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.type).toBe('QUIZ_CLOSED');
    expect(payload.tenantId).toBe('t1');
    expect(payload.userIds.sort()).toEqual([s1.id, s2.id].sort());
  });
});