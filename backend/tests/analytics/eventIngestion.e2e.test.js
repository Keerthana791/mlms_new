const request = require('supertest');

// Ensure server does not start listener in tests
process.env.NODE_ENV = 'test';

// Mocks
jest.mock('../../config/parse', () => require('../mocks/parseMock'));

// Auth middleware mock that injects a user and tenant
jest.mock('../../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    const Parse = require('../../config/parse');
    const tenantId = req.headers['x-tenant-id'] || 't1';
    const role = req.headers['x-test-role'] || 'Student';
    const userId = req.headers['x-test-user-id'] || 'stud1';
    const user = Parse.__create('User', { tenantId, role, usernameOnTenant: userId, username: `${tenantId}:${userId}` });
    user.id = userId;
    req.user = user;
    req.tenantId = tenantId;
    next();
  },
  requireRole: (roles) => (req, res, next) =>
    roles.includes(req.user.get('role')) ? next() : res.status(403).json({ error: 'Forbidden' }),
}));

const app = require('../../server');
const Parse = require('../../config/parse');

function normalizeToUTC(date) {
  const d = date instanceof Date ? new Date(date) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

describe('Analytics Event Ingestion E2E', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  test('POST /api/analytics/events persists event with UTC-normalized day', async () => {
    const tenantId = 't1';
    const userId = 'stud1';
    const when = new Date('2025-11-01T10:15:30.000Z');

    // Send event
    const res = await request(app)
      .post('/api/analytics/events')
      .set('x-tenant-id', tenantId)
      .set('x-test-role', 'Student')
      .set('x-test-user-id', userId)
      .send({
        event: 'material.complete',
        entityType: 'material',
        entityId: 'mat123',
        payload: { courseId: 'course1', fileType: 'video', extra: 'keep' },
        ts: when.toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    // Verify persisted in DB
    const q = new Parse.Query('AnalyticsEvent');
    q.equalTo('tenantId', tenantId);
    q.equalTo('userId', userId);
    q.equalTo('event', 'material.complete');
    q.equalTo('entityType', 'material');
    q.equalTo('entityId', 'mat123');
    const evt = await q.first({ useMasterKey: true });

    expect(evt).toBeTruthy();
    expect(evt.get('tenantId')).toBe(tenantId);
    expect(evt.get('userId')).toBe(userId);
    expect(evt.get('event')).toBe('material.complete');
    expect(evt.get('entityType')).toBe('material');
    expect(evt.get('entityId')).toBe('mat123');
    expect(evt.get('payload')).toMatchObject({ courseId: 'course1', fileType: 'video', extra: 'keep' });

    // ts should match supplied timestamp
    const savedTs = evt.get('ts');
    expect(new Date(savedTs).toISOString()).toBe(when.toISOString());

    // day should be UTC-normalized midnight for the supplied timestamp
    const savedDay = evt.get('day');
    const expectedDay = normalizeToUTC(when);
    expect(new Date(savedDay).toISOString()).toBe(expectedDay.toISOString());
  });
});