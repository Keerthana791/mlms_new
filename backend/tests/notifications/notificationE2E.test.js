const request = require('supertest');

process.env.NODE_ENV = 'test';

// Use in-memory Parse mock
jest.mock('../../config/parse', () => require('../mocks/parseMock'));
// IMPORTANT: do NOT mock ../../utils/notify here; we want the real helper

// Auth mock that can impersonate role/userId per request via headers
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const Parse = require('../../config/parse');
    const role = req.headers['x-test-role'] || 'Admin';
    const userId = req.headers['x-test-user-id'] || (role === 'Admin' ? 'admin1' : 'user1');
    const tenantId = req.headers['x-tenant-id'] || 't1';
    const username = `${tenantId}:${userId}`;
    const user = Parse.__create('User', { tenantId, role, usernameOnTenant: userId, username });
    user.id = userId;
    req.user = user;
    req.sessionToken = 's1';
    req.tenantId = tenantId;
    next();
  },
  requireRole: (roles) => (req, res, next) =>
    roles.includes(req.user.get('role')) ? next() : res.status(403).json({ error: 'Forbidden' })
}));

const app = require('../../server');
const Parse = require('../../config/parse');

describe('E2E: Admin send -> Student receives via list/unread/mark-read', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  test('admin sends to one student; student can list and mark as read', async () => {
    const tenantId = 't1';
    const studentId = 'stud1';

    // Ensure student exists in mock store
    const s = Parse.__create('User', { tenantId, role: 'Student', usernameOnTenant: studentId, username: `${tenantId}:${studentId}` });
    s.id = studentId;

    // Admin sends a notification directly to the student
    const sendRes = await request(app)
      .post('/api/notifications')
      .set('x-tenant-id', tenantId)
      .set('x-test-role', 'Admin')
      .set('x-test-user-id', 'admin1')
      .send({ type: 'ANNOUNCEMENT', title: 'Welcome', message: 'Hello student', userIds: [studentId] });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body).toHaveProperty('count', 1);

    // Student lists notifications
    const listRes = await request(app)
      .get('/api/notifications')
      .set('x-tenant-id', tenantId)
      .set('x-test-role', 'Student')
      .set('x-test-user-id', studentId);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].type).toBe('ANNOUNCEMENT');
    expect(listRes.body[0].read).toBe(false);

    const notifId = listRes.body[0].id;

    // Unread count is 1
    const unreadRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('x-tenant-id', tenantId)
      .set('x-test-role', 'Student')
      .set('x-test-user-id', studentId);

    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.unreadCount).toBe(1);

    // Mark as read
    const readRes = await request(app)
      .put(`/api/notifications/${notifId}/read`)
      .set('x-tenant-id', tenantId)
      .set('x-test-role', 'Student')
      .set('x-test-user-id', studentId)
      .send();

    expect(readRes.status).toBe(200);
    expect(readRes.body.id).toBe(notifId);
    expect(readRes.body.read).toBe(true);

    // Unread count is now 0
    const unreadAfter = await request(app)
      .get('/api/notifications/unread-count')
      .set('x-tenant-id', tenantId)
      .set('x-test-role', 'Student')
      .set('x-test-user-id', studentId);

    expect(unreadAfter.status).toBe(200);
    expect(unreadAfter.body.unreadCount).toBe(0);
  });
});
