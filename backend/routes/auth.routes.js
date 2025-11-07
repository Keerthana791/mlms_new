const express = require('express');
const router = express.Router();
const { signup, login, getCurrentUser, logout } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Protected route
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', requireAuth, logout);
module.exports = router;