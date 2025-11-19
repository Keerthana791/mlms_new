const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const ctrl = require('../controllers/notification.controller');

router.use(requireAuth, tenantMiddleware);

router.get('/', ctrl.listNotifications);
router.get('/unread-count', ctrl.getUnreadCount);
router.put('/:id/read', ctrl.markRead);
router.put('/read-all', ctrl.markAllRead);
router.post('/', requireRole(['Admin', 'Teacher']), ctrl.sendNotifications);
router.post('/cleanup', requireRole(['Admin']), ctrl.cleanupNotifications);
router.delete('/:id', ctrl.deleteNotification);
module.exports = router;