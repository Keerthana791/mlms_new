// backend/controllers/user.controller.js
const Parse = require('../config/parse');

// helper to normalize Parse objects
const toJSON = (obj) => ({ id: obj.id, ...obj.toJSON() });

// GET /api/users?role=Teacher
const listUsers = async (req, res) => {
  try {
    const { role } = req.query;

    // Only Admins can list users
    const currentRole = req.user?.get('role');
    if (currentRole !== 'Admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const User = Parse.User;
    const query = new Parse.Query(User);

    // tenant scoped
    query.equalTo('tenantId', req.tenantId);

    if (role) {
      query.equalTo('role', role);
    }

    const results = await query.find({ useMasterKey: true });
    res.json(results.map(toJSON));
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
};

// POST /api/users  (Admin creates Teacher/Student in their tenant)
const createUser = async (req, res) => {
  try {
    const currentRole = req.user?.get('role');
    if (currentRole !== 'Admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const tenantId = req.tenantId;
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'username, email, password, role are required' });
    }
    if (!['Teacher', 'Student'].includes(role)) {
      return res.status(400).json({ error: 'Only Teacher or Student can be created by Admin' });
    }

    // Check username uniqueness per tenant (usernameOnTenant)
    const userByLocalUsername = new Parse.Query(Parse.User);
    userByLocalUsername.equalTo('tenantId', tenantId);
    userByLocalUsername.equalTo('usernameOnTenant', username);
    if (await userByLocalUsername.first({ useMasterKey: true })) {
      return res.status(409).json({ error: 'Username already taken in this tenant' });
    }

    // Check email uniqueness per tenant
    const emailQuery = new Parse.Query(Parse.User);
    emailQuery.equalTo('email', email);
    emailQuery.equalTo('tenantId', tenantId);
    if (await emailQuery.first({ useMasterKey: true })) {
      return res.status(409).json({ error: 'Email already in use in this tenant' });
    }

    // Create user directly (no tenantSecret, Admin is trusted)
    const user = new Parse.User();
    const canonicalUsername = `${tenantId}:${username}`;
    user.set('username', canonicalUsername);
    user.set('usernameOnTenant', username);
    user.set('email', email);
    user.set('password', password);
    user.set('role', role);
    user.set('tenantId', tenantId);

    await user.signUp(null, { useMasterKey: true });

    res.status(201).json({ id: user.id, username, email, role });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// DELETE /api/users/:id  (Admin deletes Teacher/Student in their tenant)
const deleteUser = async (req, res) => {
  try {
    const currentRole = req.user?.get('role');
    if (currentRole !== 'Admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const tenantId = req.tenantId;

    const User = Parse.User;
    const q = new Parse.Query(User);
    const user = await q.get(id, { useMasterKey: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.get('tenantId') !== tenantId) {
      return res.status(403).json({ error: 'Cannot delete user from another tenant' });
    }

    const role = user.get('role');
    if (role === 'Admin') {
      return res.status(400).json({ error: 'Cannot delete Admin users' });
    }

    await user.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  listUsers,
  createUser,
  deleteUser,
};