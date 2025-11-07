const Parse = require('../config/parse');

const requireAuth = async (req, res, next) => {
  try {
    const sessionToken = req.headers['x-parse-session-token'] || req.headers['x-session-token'];
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const Session = Parse.Object.extend('_Session');
    const query = new Parse.Query(Session);
    query.equalTo('sessionToken', sessionToken);
    query.include('user');
    const session = await query.first({ useMasterKey: true });

    if (!session) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const user = session.get('user');
    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId && user.get('tenantId') !== headerTenantId) {
      return res.status(403).json({ error: 'Tenant mismatch' });
    }
    req.user = user;
    req.tenantId = headerTenantId || user.get('tenantId');
    req.sessionToken = sessionToken; // attach for logout
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Authentication required' });
      const userRole = req.user.get('role');
      if (!roles.includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      next();
    } catch (err) {
      console.error('Role middleware error:', err);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
};

module.exports = { requireAuth, requireRole };