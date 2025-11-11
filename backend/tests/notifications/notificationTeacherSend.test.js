const request = require('supertest');

process.env.NODE_ENV = 'test';

jest.mock('../../config/parse', () => require('../mocks/parseMock'));
jest.mock('../../utils/notify', () => ({ notify: jest.fn(async () => 1) }));

// Force auth as Teacher in tenant t1
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const Parse = require('../../config/parse');
    const user = Parse.__create('User', { tenantId: 't1', role: 'Teacher', usernameOnTenant: 'teach1', username: 't1:teach1' });
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

describe('Notification API -> Teacher send with explicit userIds across owned courses', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  test('teacher sends to explicit userIds; only students in owned courses are targeted', async () => {
    // Courses: A is owned by teach1, B by someone else
    const courseA = Parse.__create('Course', { tenantId: 't1', teacherId: 'teach1', title: 'A' });
    const courseB = Parse.__create('Course', { tenantId: 't1', teacherId: 'tOther', title: 'B' });

    // Students
    const s1 = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 's1', username: 't1:s1' });
    const s2 = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 's2', username: 't1:s2' });
    const s3 = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 's3', username: 't1:s3' });

    // Enrollments: s1 in A (owned), s2 in B (not owned), s3 in none
    Parse.__create('Enrollment', { tenantId: 't1', courseId: courseA.id, studentId: s1.id, status: 'active' });
    Parse.__create('Enrollment', { tenantId: 't1', courseId: courseB.id, studentId: s2.id, status: 'active' });

    const res = await request(app)
      .post('/api/notifications')
      .send({ type: 'INFO', title: 'Hello', message: 'From teacher', userIds: [s1.id, s2.id, s3.id] });

    expect(res.status).toBe(201);
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.userIds).toEqual([s1.id]);
    expect(payload.type).toBe('INFO');
    expect(payload.title).toBe('Hello');
  });
});