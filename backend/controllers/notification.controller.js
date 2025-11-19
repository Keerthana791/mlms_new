const Parse = require('../config/parse');
const { notify } = require('../utils/notify');

function toOut(obj) {
  const j = obj.toJSON();
  return {
    id: obj.id,
    type: j.type,
    title: j.title,
    message: j.message,
    data: j.data || {},
    read: !!j.read,
    readAt: j.readAt || null,
    createdBy: j.createdBy || null,
    createdAt: j.createdAt,
    expiresAt: j.expiresAt || null,
  };
}

// GET /api/notifications
async function listNotifications(req, res) {
  try {
    const { read, limit = 20, before, includeExpired } = req.query || {};
    const q = new Parse.Query('Notification');
    q.equalTo('tenantId', req.tenantId);
    q.equalTo('userId', req.user.id);
    if (read === 'true') q.equalTo('read', true);
    if (read === 'false') q.equalTo('read', false);

    if (!includeExpired) {
      const now = new Date();
      // (expiresAt missing) OR (expiresAt >= now)
      const notExpired = new Parse.Query('Notification');
      notExpired.equalTo('tenantId', req.tenantId);
      notExpired.equalTo('userId', req.user.id);
      notExpired.doesNotExist('expiresAt');
      const future = new Parse.Query('Notification');
      future.equalTo('tenantId', req.tenantId);
      future.equalTo('userId', req.user.id);
      future.greaterThanOrEqualTo('expiresAt', now);
      q._orQuery([notExpired, future]);
    }

    if (before) {
      const d = !isNaN(Date.parse(before)) ? new Date(before) : null;
      if (d) q.lessThan('createdAt', d);
      // Fallback: if "before" is an id, try fetching it and use its createdAt
      if (!d && typeof before === 'string') {
        try {
          const cursor = await new Parse.Query('Notification').get(before, { useMasterKey: true });
          q.lessThan('createdAt', cursor.createdAt);
        } catch (_) {}
      }
    }

    q.descending('createdAt');
    q.limit(Math.min(Number(limit) || 20, 100));
    const results = await q.find({ useMasterKey: true });
    res.json(results.map(toOut));
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Failed to list notifications' });
  }
}

// GET /api/notifications/unread-count
async function getUnreadCount(req, res) {
  try {
    const now = new Date();
    const base = new Parse.Query('Notification');
    base.equalTo('tenantId', req.tenantId);
    base.equalTo('userId', req.user.id);
    base.equalTo('read', false);
    const missing = new Parse.Query('Notification');
    missing.equalTo('tenantId', req.tenantId);
    missing.equalTo('userId', req.user.id);
    missing.equalTo('read', false);
    missing.doesNotExist('expiresAt');
    const future = new Parse.Query('Notification');
    future.equalTo('tenantId', req.tenantId);
    future.equalTo('userId', req.user.id);
    future.equalTo('read', false);
    future.greaterThanOrEqualTo('expiresAt', now);
    base._orQuery([missing, future]);
    const count = await base.count({ useMasterKey: true });
    res.json({ unreadCount: count });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
}

// PUT /api/notifications/:id/read
async function markRead(req, res) {
  try {
    const { id } = req.params;
    const obj = await new Parse.Query('Notification').get(id, { useMasterKey: true });
    if (obj.get('tenantId') !== req.tenantId || obj.get('userId') !== req.user.id) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!obj.get('read')) {
      obj.set('read', true);
      obj.set('readAt', new Date());
      await obj.save(null, { useMasterKey: true });
    }
    res.json(toOut(obj));
  } catch (err) {
    res.status(404).json({ error: 'Not found' });
  }
}

// PUT /api/notifications/read-all
async function markAllRead(req, res) {
  try {
    const { olderThan } = req.body || {};
    const now = new Date();
    const q1 = new Parse.Query('Notification');
    q1.equalTo('tenantId', req.tenantId);
    q1.equalTo('userId', req.user.id);
    q1.equalTo('read', false);
    q1.doesNotExist('expiresAt');
    const q2 = new Parse.Query('Notification');
    q2.equalTo('tenantId', req.tenantId);
    q2.equalTo('userId', req.user.id);
    q2.equalTo('read', false);
    q2.greaterThanOrEqualTo('expiresAt', now);
    let q = Parse.Query.or(q1, q2);
    if (olderThan && !isNaN(Date.parse(olderThan))) {
      q.lessThan('createdAt', new Date(olderThan));
    }
    const results = await q.find({ useMasterKey: true });
    for (const o of results) {
      o.set('read', true);
      o.set('readAt', new Date());
    }
    if (results.length) await Parse.Object.saveAll(results, { useMasterKey: true });
    res.json({ updated: results.length });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark all read' });
  }
}

// POST /api/notifications  (Admin or Teacher)
async function sendNotifications(req, res) {
  try {
    const role = req.user.get('role');
    const { userIds, courseId, role: targetRole, type, title, message, data, expiresAt } = req.body || {};
    if (!type || !title || !message) return res.status(400).json({ error: 'type, title, message are required' });

    if (targetRole && role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });

    let targets = Array.isArray(userIds) ? userIds.filter(Boolean) : [];

    if (courseId) {
      const course = await new Parse.Query('Course').get(courseId, { useMasterKey: true });
      if (!course || course.get('tenantId') !== req.tenantId) return res.status(404).json({ error: 'Not found' });
      if (role === 'Teacher' && course.get('teacherId') !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
      const enrQ = new Parse.Query('Enrollment');
      enrQ.equalTo('tenantId', req.tenantId);
      enrQ.equalTo('courseId', courseId);
      enrQ.equalTo('status', 'active');
      const enrollments = await enrQ.find({ useMasterKey: true });
      const studentIds = enrollments.map(e => e.get('studentId'));
      targets = targets.length ? targets.filter(t => studentIds.includes(t)) : studentIds;
    }

    if (targetRole) {
      const uQ = new Parse.Query('_User');
      uQ.equalTo('tenantId', req.tenantId);
      uQ.equalTo('role', targetRole);
      const users = await uQ.find({ useMasterKey: true });
      const ids = users.map(u => u.id);
      targets = targets.length ? targets.filter(t => ids.includes(t)) : ids;
    }

    // If Teacher without courseId, require explicit userIds but ensure they belong to teacher's courses
    if (role === 'Teacher' && !courseId) {
      if (!targets.length) return res.status(400).json({ error: 'Teachers must provide courseId or userIds' });
      // Validate targets are students in any course owned by this teacher
      const coursesQ = new Parse.Query('Course');
      coursesQ.equalTo('tenantId', req.tenantId);
      coursesQ.equalTo('teacherId', req.user.id);
      const ownedCourses = await coursesQ.find({ useMasterKey: true });
      const ownedIds = new Set(ownedCourses.map(c => c.id));
      const enrQ = new Parse.Query('Enrollment');
      enrQ.equalTo('tenantId', req.tenantId);
      enrQ.equalTo('status', 'active');
      enrQ.containedIn('courseId', Array.from(ownedIds));
      enrQ.containedIn('studentId', targets);
      const allowed = await enrQ.find({ useMasterKey: true });
      const allowedSet = new Set(allowed.map(e => e.get('studentId')));
      targets = targets.filter(t => allowedSet.has(t));
    }

    targets = Array.from(new Set(targets));
    if (!targets.length) return res.status(400).json({ error: 'No targets resolved' });

    const created = await notify({ tenantId: req.tenantId, userIds: targets, type, title, message, data: data || {}, expiresAt, createdBy: req.user.id });
    res.status(201).json({ count: created });
  } catch (err) {
    console.error('Send notifications error:', err);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
}

// POST /api/notifications/cleanup (Admin)
async function cleanupNotifications(req, res) {
  try {
    const role = req.user.get('role');
    if (role !== 'Admin') return res.status(403).json({ error: 'Forbidden' });
    const now = new Date();
    const expired = new Parse.Query('Notification');
    expired.equalTo('tenantId', req.tenantId);
    expired.lessThan('expiresAt', now);
    const oldQ = new Parse.Query('Notification');
    oldQ.equalTo('tenantId', req.tenantId);
    oldQ.doesNotExist('expiresAt');
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    oldQ.lessThan('createdAt', cutoff);
    const toDelete = await Parse.Query.or(expired, oldQ).find({ useMasterKey: true });
    if (toDelete.length) await Parse.Object.destroyAll(toDelete, { useMasterKey: true });
    res.json({ deleted: toDelete.length });
  } catch (err) {
    console.error('Cleanup notifications error:', err);
    res.status(500).json({ error: 'Failed to cleanup notifications' });
  }
}
// DELETE /api/notifications/:id
async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    const obj = await new Parse.Query('Notification').get(id, { useMasterKey: true });

    const sameTenant = obj.get('tenantId') === req.tenantId;
    const sameUser = obj.get('userId') === req.user.id;
    const isAdmin = req.user.get('role') === 'Admin';

    // Allow:
    //  - Owner user in same tenant
    //  - Or Admin in same tenant
    if (!sameTenant || (!sameUser && !isAdmin)) {
      return res.status(404).json({ error: 'Not found' });
    }

    await obj.destroy({ useMasterKey: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(404).json({ error: 'Not found' });
  }
}

module.exports = {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  sendNotifications,
  cleanupNotifications,
  deleteNotification,
};