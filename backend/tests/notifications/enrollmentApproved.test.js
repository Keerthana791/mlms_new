const request = require('supertest');

// Ensure server does not start listener in tests
process.env.NODE_ENV = 'test';

jest.mock('../../config/parse', () => require('../mocks/parseMock'));
jest.mock('../../utils/notify', () => ({ notify: jest.fn(async () => 1) }));
// Stub auth middleware to inject a Student user in tenant t1 with deterministic id
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const Parse = require('../../config/parse');
    const user = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 'stud1', username: 't1:stud1', email: 's@x.com' });
    user.id = 'stud1';
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

describe('Enrollment -> COURSE_ENROLLMENT_APPROVED notification', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  test('creating self-enrollment notifies the student', async () => {
    // Seed course
    const course = Parse.__create('Course', { tenantId: 't1', teacherId: 'teach1', title: 'C1' });

    const res = await request(app)
      .post('/api/enrollments/self')
      .send({ courseId: course.id });

    expect(res.status).toBe(201);
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.type).toBe('COURSE_ENROLLMENT_APPROVED');
    expect(payload.tenantId).toBe('t1');
    expect(payload.userIds).toEqual(['stud1']);
    expect(payload.data.courseId).toBe(course.id);
  });
});