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

describe('Course Material -> MATERIAL_UPLOADED notification', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  test('uploading material notifies enrolled students', async () => {
    // Seed course owned by teach1 and enrollments
    const course = Parse.__create('Course', { tenantId: 't1', teacherId: 'teach1', title: 'Course 1' });
    const s1 = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 's1', username: 't1:s1', email: 's1@x.com' });
    const s2 = Parse.__create('User', { tenantId: 't1', role: 'Student', usernameOnTenant: 's2', username: 't1:s2', email: 's2@x.com' });
    Parse.__create('Enrollment', { tenantId: 't1', courseId: course.id, studentId: s1.id, status: 'active' });
    Parse.__create('Enrollment', { tenantId: 't1', courseId: course.id, studentId: s2.id, status: 'active' });

    const res = await request(app)
      .post(`/api/courses/${course.id}/materials`)
      .send({
        title: 'Chapter 1 PDF',
        fileBase64: Buffer.from('pdfdata').toString('base64'),
        fileName: 'ch1.pdf',
        fileType: 'pdf',
        contentType: 'application/pdf'
      });

    expect(res.status).toBe(201);
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.type).toBe('MATERIAL_UPLOADED');
    expect(payload.tenantId).toBe('t1');
    expect(payload.userIds.sort()).toEqual([s1.id, s2.id].sort());
  });
});