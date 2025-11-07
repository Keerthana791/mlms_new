const tenantMiddleware = (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'] || req.user?.get('tenantId');
    if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
    }
    req.tenantId = tenantId;
    next();
};

module.exports = { tenantMiddleware };