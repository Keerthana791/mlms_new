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
    // Force a stable id to match seeded course.teacherId
    user.id = 'teach1';
    req.user = user;
    req.sessionToken = 's1';
    next();
  },
  requireRole: (roles) => (req, res, next) => roles.includes(req.user.get('role')) ? next() : res.status(403).json({ error: 'Forbidden' })
}));

const app = require('../../server');
const Parse = require('../../config/parse');
const { notify } = require('../../utils/notify');

describe('Assignment -> ASSIGNMENT_POSTED notifications', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  test('creating assignment notifies enrolled students and sets expiresAt to dueDate', async () => {
    // Seed course and enrollments owned by teach1
    const course = Parse.__create('Course', { tenantId: 't1', teacherId: 'teach1', title: 'Course 1' });
    const s1 = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 's1', username: 't1:s1', email: 's1@x.com' });
    const s2 = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 's2', username: 't1:s2', email: 's2@x.com' });
    Parse.__create('Enrollment', { tenantId: 't1', courseId: course.id, studentId: s1.id, status: 'active' });
    Parse.__create('Enrollment', { tenantId: 't1', courseId: course.id, studentId: s2.id, status: 'active' });

    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/assignments')
      .send({ courseId: course.id, title: 'A1', description: 'D', dueDate });

    expect(res.status).toBe(201);
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.type).toBe('ASSIGNMENT_POSTED');
    expect(payload.tenantId).toBe('t1');
    expect(new Date(payload.expiresAt).toISOString()).toBe(new Date(dueDate).toISOString());
    // userIds should include s1 and s2 (order not guaranteed)
    expect(payload.userIds.sort()).toEqual([s1.id, s2.id].sort());
  });
});