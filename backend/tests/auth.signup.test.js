const request = require('supertest');

// Ensure server does not start listener in tests
process.env.NODE_ENV = 'test';

// Mock Parse and notify
jest.mock('../config/parse', () => require('./mocks/parseMock'));
jest.mock('../utils/notify', () => ({ notify: jest.fn(async () => 1) }));
// Mock bcrypt compare to always succeed for tenantSecret validation
jest.mock('bcryptjs', () => ({
  compare: async () => true,
  hash: async (s) => `hash-${s}`,
}));

const app = require('../server');
const Parse = require('../config/parse');
const { notify } = require('../utils/notify');

describe('Auth Signup -> NEW_USER_SIGNUP notifications', () => {
  beforeEach(() => {
    Parse.__reset();
    jest.clearAllMocks();
  });

  test('first Admin signup initializes tenant, no Admin recipients yet', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        username: 'admin',
        email: 'admin@example.com',
        password: 'pass',
        role: 'Admin',
        tenantId: 't1',
        tenantSecret: 'init-secret',
        tenantName: 'Tenant One'
      });

    expect(res.status).toBe(201);
    // Since first user is Admin and there are no prior admins, notify may not be called
    expect(notify).toHaveBeenCalledTimes(0);
  });

  test('subsequent signup emits NEW_USER_SIGNUP to Admins in tenant', async () => {
    // Seed tenant exists
    Parse.__create('Tenant', { tenantId: 't1', tenantSecretHash: 'hash-init-secret' });
    // Seed one Admin in tenant t1
    const admin = Parse.__create('User', { tenantId: 't1', role: 'Admin', usernameOnTenant: 'admin1', username: 't1:admin1', email: 'a1@x.com' });
    await admin.save();

    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        username: 'stud',
        email: 'stud@example.com',
        password: 'pass',
        role: 'Student',
        tenantId: 't1',
        tenantSecret: 'init-secret'
      });

    expect(res.status).toBe(201);
    expect(notify).toHaveBeenCalledTimes(1);
    const payload = notify.mock.calls[0][0];
    expect(payload.type).toBe('NEW_USER_SIGNUP');
    expect(payload.tenantId).toBe('t1');
    expect(Array.isArray(payload.userIds)).toBe(true);
  });
});