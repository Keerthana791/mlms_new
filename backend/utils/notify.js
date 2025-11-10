// backend/utils/notify.js
const Parse = require('../config/parse');

async function notify({ tenantId, userIds, type, title, message, data = {}, expiresAt = null, createdBy = null }) {
  if (!tenantId) throw new Error('notify: tenantId is required');
  if (!Array.isArray(userIds) || userIds.length === 0) return 0;
  if (!type || !title || !message) throw new Error('notify: type, title, message are required');

  const Notification = Parse.Object.extend('Notification');
  const now = new Date();
  const exp = expiresAt instanceof Date
    ? expiresAt
    : (expiresAt && !isNaN(Date.parse(expiresAt)) ? new Date(expiresAt) : null);

  if (exp && exp.getTime() <= now.getTime()) return 0; // skip if already expired

  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const chunkSize = 100;
  let created = 0;

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const objs = chunk.map(uid => {
      const n = new Notification();
      n.set('tenantId', tenantId);
      n.set('userId', uid);
      n.set('type', type);
      n.set('title', title);
      n.set('message', message);
      n.set('data', data || {});
      n.set('read', false);
      if (createdBy) n.set('createdBy', createdBy);
      if (exp) n.set('expiresAt', exp);
      return n;
    });
    if (objs.length) {
      await Parse.Object.saveAll(objs, { useMasterKey: true });
      created += objs.length;
    }
  }
  return created;
}

module.exports = { notify };