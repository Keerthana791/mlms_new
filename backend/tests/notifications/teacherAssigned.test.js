const request = require('supertest');

// Ensure server does not start listener in tests
process.env.NODE_ENV = 'test';

jest.mock('../../config/parse', () => require('../mocks/parseMock'));
jest.mock('../../utils/notify', () => ({ notify: jest.fn(async () => 1) }));
// Stub auth middleware to inject an Admin user in tenant t1
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const Parse = require('../../config/parse');
    const user = Parse.__create('User', { tenantId: 't1', role: 'Admin', usernameOnTenant: 'admin', username: 't1:admin', email: 'a@x.com' });
    user.id = 'admin1';
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

describe('Course -> TEACHER_ASSIGNED notification', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  test('updating course teacherId notifies the new teacher', async () => {
    // Seed course with original teacher tOld
    const course = Parse.__create('Course', { tenantId: 't1', teacherId: 'tOld', title: 'C1' });

    // New teacher user
    const newTeacher = Parse.__create('User', { tenantId: 't1', role: 'Teacher', usernameOnTenant: 'teach2', username: 't1:teach2', email: 't2@x.com' });

    const res = await request(app)
      .put(`/api/courses/${course.id}`)
      .send({ teacherId: newTeacher.id });

    expect(res.status).toBe(200);
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.type).toBe('TEACHER_ASSIGNED');
    expect(payload.tenantId).toBe('t1');
    expect(payload.userIds).toEqual([newTeacher.id]);
    expect(payload.data.courseId).toBe(course.id);
  });
});