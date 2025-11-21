// backend/routes/user.routes.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { listUsers, createUser, deleteUser } = require('../controllers/user.controller');

router.use(requireAuth);
router.use(tenantMiddleware);

// Only Admins can manage users (role check is inside controller)
router.get('/', listUsers);          // GET /api/users
router.post('/', createUser);        // POST /api/users
router.delete('/:id', deleteUser);   // DELETE /api/users/:id

module.exports = router;