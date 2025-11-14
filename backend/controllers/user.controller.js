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
if (!['Admin', 'Teacher', 'Student'].includes(currentRole)) {
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

module.exports = {
  listUsers,
};