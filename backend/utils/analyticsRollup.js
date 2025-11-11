const Parse = require('../config/parse');
const { normalizeToUTC } = require('./analytics');

function enumerateDaysIST(from, to) {
  // Using UTC-normalized buckets to match analytics.js current implementation
  const start = normalizeToUTC(from || new Date());
  const end = normalizeToUTC(to || new Date());
  const days = [];
  let cur = start;
  while (cur.getTime() <= end.getTime()) {
    days.push(new Date(cur));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return days;
}

async function rollupDaily({ tenantId, from, to }) {
  const start = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const end = to ? new Date(to) : new Date();

  const q = new Parse.Query('AnalyticsEvent');
  q.equalTo('tenantId', tenantId);
  q.greaterThanOrEqualTo('ts', start);
  // Parse mock lacks lessThanOrEqualTo; use lessThan with +1ms to include end
  const endInclusive = new Date(end.getTime() + 1);
  q.lessThan('ts', endInclusive);
  const events = await q.find({ useMasterKey: true });

  const byDay = new Map();
  for (const e of events) {
    const ts = e.get('ts') || new Date();
    const day = normalizeToUTC(e.get('day') || ts);
    const key = day.getTime();
    const ev = e.get('event');
    if (!byDay.has(key)) byDay.set(key, {});
    const bucket = byDay.get(key);
    bucket[ev] = (bucket[ev] || 0) + 1;
  }

  // Persist only days that actually have events
  const Daily = Parse.Object.extend('AnalyticsDaily');
  const toSave = [];

  for (const key of Array.from(byDay.keys())) {
    const dayDate = new Date(Number(key));
    const totals = byDay.get(key) || {};

    const existsQ = new Parse.Query('AnalyticsDaily');
    existsQ.equalTo('tenantId', tenantId);
    existsQ.equalTo('day', dayDate);
    const existing = await existsQ.first({ useMasterKey: true });

    if (existing) {
      existing.set('totalsByEvent', totals);
      existing.set('lastComputedAt', new Date());
      toSave.push(existing);
    } else {
      const doc = new Daily();
      doc.set('tenantId', tenantId);
      doc.set('day', dayDate);
      doc.set('totalsByEvent', totals);
      doc.set('lastComputedAt', new Date());
      toSave.push(doc);
    }
  }

  if (toSave.length) await Parse.Object.saveAll(toSave, { useMasterKey: true });
  return toSave.length;
}

module.exports = { rollupDaily, enumerateDaysIST };
