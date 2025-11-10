const Parse = require('../config/parse');
const bcrypt = require('bcryptjs');
const { notify } = require('../utils/notify');

// Parse class names
const TENANT_CLASS = 'Tenant';

const signup = async (req, res) => {
  try {
    const { username, email, password, role, tenantId, tenantSecret, tenantName } = req.body;
    if (!username || !email || !password || !role || !tenantId) {
      return res.status(400).json({ error: 'username, email, password, role, tenantId are required' });
    }

    // Username is tenant-local. Check per-tenant uniqueness on usernameOnTenant
    const userByLocalUsername = new Parse.Query(Parse.User);
    userByLocalUsername.equalTo('tenantId', tenantId);
    userByLocalUsername.equalTo('usernameOnTenant', username);
    if (await userByLocalUsername.first({ useMasterKey: true })) {
      return res.status(409).json({ error: 'Username already taken in this tenant' });
    }

    // Enforce per-tenant email uniqueness
    const emailQuery = new Parse.Query(Parse.User);
    emailQuery.equalTo('email', email);
    emailQuery.equalTo('tenantId', tenantId);
    if (await emailQuery.first({ useMasterKey: true })) {
      return res.status(409).json({ error: 'Email already in use in this tenant' });
    }

    // Find tenant record
    const tenantQuery = new Parse.Query(TENANT_CLASS);
    tenantQuery.equalTo('tenantId', tenantId);
    let tenant = await tenantQuery.first({ useMasterKey: true });

    if (!tenant) {
      // Tenant not found: only allow Admin to initialize tenant, and require tenantSecret
      if (role !== 'Admin') {
        return res.status(400).json({ error: 'Tenant not initialized. An Admin must create this tenant first.' });
      }
      if (!tenantSecret) {
        return res.status(400).json({ error: 'tenantSecret is required to initialize a tenant' });
      }
      const Tenant = Parse.Object.extend(TENANT_CLASS);
      tenant = new Tenant();
      const secretHash = await bcrypt.hash(tenantSecret, 10);
      tenant.set('tenantId', tenantId);
      if (tenantName) tenant.set('name', tenantName);
      tenant.set('tenantSecretHash', secretHash);
      await tenant.save(null, { useMasterKey: true });
      // First user for this tenant must be Admin (already checked)
    } else {
      // Tenant exists: validate tenantSecret for all signups except maybe first Admin
      if (!tenantSecret) {
        return res.status(401).json({ error: 'tenantSecret is required' });
      }
      const secretHash = tenant.get('tenantSecretHash');
      const ok = secretHash && await bcrypt.compare(tenantSecret, secretHash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid tenantSecret' });
      }

      // Restrict additional Admin creation (only the first user can be Admin)
      if (role === 'Admin') {
        const usersInTenant = new Parse.Query(Parse.User);
        usersInTenant.equalTo('tenantId', tenantId);
        const count = await usersInTenant.count({ useMasterKey: true });
        if (count > 0) {
          return res.status(403).json({ error: 'Additional Admins are not allowed for this tenant' });
        }
      }
    }

    // Create user (store namespaced username for Parse global uniqueness)
    const user = new Parse.User();
    const canonicalUsername = `${tenantId}:${username}`;
    user.set('username', canonicalUsername);
    user.set('usernameOnTenant', username);
    user.set('email', email);
    user.set('password', password);
    user.set('role', role);
    user.set('tenantId', tenantId);

    await user.signUp();

    // Notify Admins in this tenant: NEW_USER_SIGNUP
    try {
      const adminQ = new Parse.Query(Parse.User);
      adminQ.equalTo('tenantId', tenantId);
      adminQ.equalTo('role', 'Admin');
      const admins = await adminQ.find({ useMasterKey: true });
      const adminIds = (admins || []).map(a => a.id);
      if (adminIds.length) {
        await notify({
          tenantId,
          userIds: adminIds,
          type: 'NEW_USER_SIGNUP',
          title: `New User Signed Up: ${username}`,
          message: `Role: ${role}`,
          data: { newUserId: user.id, role },
          createdBy: user.id,
        });
      }
    } catch (e) { /* swallow notification errors */ }

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 202) return res.status(409).json({ error: 'Username already taken' });
    if (error.code === 203) return res.status(409).json({ error: 'Email already in use' });
    res.status(400).json({ error: error.message || 'Failed to create user' });
  }
};

const login = async (req, res) => {
  try {
    const { tenantId, username, email, password } = req.body;
    if (!tenantId || !password || (!username && !email)) {
      return res.status(400).json({ error: 'tenantId and password are required, plus username or email' });
    }

    // Resolve user within the provided tenantId
    const userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo('tenantId', tenantId);
    if (username) userQuery.equalTo('usernameOnTenant', username);
    else userQuery.equalTo('email', email);

    const found = await userQuery.first({ useMasterKey: true });
    if (!found) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Use the canonical global username for Parse login
    const canonicalUsername = found.get('username');
    const user = await Parse.User.logIn(canonicalUsername, password);

    res.json({
      sessionToken: user.getSessionToken(),
      user: {
        id: user.id,
        username: user.get('usernameOnTenant'),
        email: user.get('email'),
        role: user.get('role'),
        tenantId: user.get('tenantId')
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
};

const getCurrentUser = (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.get('usernameOnTenant'),
    email: req.user.get('email'),
    role: req.user.get('role'),
    tenantId: req.user.get('tenantId')
  });
};

const logout = async (req, res) => {
  try {
    const sessionToken = req.sessionToken;
    if (!sessionToken) return res.status(400).json({ error: 'No session token provided' });

    // Find _Session by token and delete it
    const Session = Parse.Object.extend('_Session');
    const q = new Parse.Query(Session);
    q.equalTo('sessionToken', sessionToken);
    const session = await q.first({ useMasterKey: true });
    if (!session) return res.status(200).json({ success: true }); // already logged out

    await session.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Failed to logout' });
  }
};

module.exports = { signup, login, getCurrentUser, logout };