const Parse = require('../config/parse');

// Normalize a date to UTC midnight (for daily buckets)
function normalizeToUTC(date) {
  const d = date instanceof Date ? new Date(date) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

// Track a single analytics event
// Required: tenantId, userId, event
// Optional: role, entityType, entityId, payload (object), ts (Date)
async function trackEvent({ tenantId, userId, role, event, entityType, entityId, payload, ts }) {
  try {
    if (!tenantId || !userId || !event) return false;
    const AnalyticsEvent = Parse.Object.extend('AnalyticsEvent');
    const obj = new AnalyticsEvent();
    obj.set('tenantId', tenantId);
    obj.set('userId', userId);
    if (role) obj.set('role', role);
    obj.set('event', event);
    if (entityType) obj.set('entityType', entityType);
    if (entityId) obj.set('entityId', entityId);
    if (payload && typeof payload === 'object') obj.set('payload', payload);
    const when = ts instanceof Date ? ts : new Date();
    obj.set('ts', when);
    obj.set('day', normalizeToUTC(when));
    await obj.save(null, { useMasterKey: true });
    return true;
  } catch (_) {
    // Do not break primary flow due to analytics failures
    return false;
  }
}

// Track multiple events in one call
async function trackEventsBatch(events = []) {
  try {
    const AnalyticsEvent = Parse.Object.extend('AnalyticsEvent');
    const toSave = [];
    for (const e of events) {
      const { tenantId, userId, role, event, entityType, entityId, payload, ts } = e || {};
      if (!tenantId || !userId || !event) continue;
      const obj = new AnalyticsEvent();
      obj.set('tenantId', tenantId);
      obj.set('userId', userId);
      if (role) obj.set('role', role);
      obj.set('event', event);
      if (entityType) obj.set('entityType', entityType);
      if (entityId) obj.set('entityId', entityId);
      if (payload && typeof payload === 'object') obj.set('payload', payload);
      const when = ts instanceof Date ? ts : new Date();
      obj.set('ts', when);
      obj.set('day', normalizeToUTC(when));
      toSave.push(obj);
    }
    if (!toSave.length) return 0;
    await Parse.Object.saveAll(toSave, { useMasterKey: true });
    return toSave.length;
  } catch (_) {
    return 0;
  }
}

module.exports = { trackEvent, trackEventsBatch, normalizeToUTC };
