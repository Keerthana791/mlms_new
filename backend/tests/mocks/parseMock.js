// backend/tests/mocks/parseMock.js
// Minimal in-memory Parse mock for tests

const store = {
  User: [],
  _Session: [],
  Tenant: [],
  Course: [],
  Enrollment: [],
  Assignment: [],
  Notification: [],
  Quiz: [],
  QuizAttempt: [],
};

function genId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

class BaseObject {
  constructor(className) {
    this._className = className;
    this._data = {};
    this.id = genId(className.toLowerCase());
  }
  set(k, v) { this._data[k] = v; }
  get(k) { return this._data[k]; }
  toJSON() { return { objectId: this.id, ...this._data }; }
  async save() {
    const arr = store[this._className] || (store[this._className] = []);
    const existingIdx = arr.findIndex(o => o.id === this.id);
    if (existingIdx >= 0) arr[existingIdx] = this; else arr.push(this);
    return this;
  }
  async destroy() {
    const arr = store[this._className] || [];
    const idx = arr.findIndex(o => o.id === this.id);
    if (idx >= 0) arr.splice(idx, 1);
    return true;
  }
}

class FakeUser extends BaseObject {
  constructor() { super('User'); }
  async signUp() {
    await this.save();
    return this;
  }
  getSessionToken() { return 'test-session-token'; }
}

function extend(className) {
  if (className === 'User') {
    FakeUser.__className = 'User';
    return FakeUser;
  }
  const Cls = class extends BaseObject {
    constructor() { super(className); }
  };
  Cls.__className = className;
  return Cls;
}

class FakeQuery {
  constructor(target) {
    if (typeof target === 'string') {
      this._className = target;
    } else if (target && target.__className) {
      this._className = target.__className;
    } else {
      this._className = target?.name || String(target);
    }
    this._filters = [];
    this._includes = [];
    this._lessThan = [];
    this._gte = [];
    this._neq = [];
    this._in = [];
    this._doesNotExist = [];
    this._order = null;
    this._limit = null;
  }
  equalTo(field, value) { this._filters.push({ field, value }); return this; }
  notEqualTo(field, value) { this._neq.push({ field, value }); return this; }
  containedIn(field, values) { this._in.push({ field, values: Array.isArray(values) ? values : [values] }); return this; }
  include(field) { this._includes.push(field); return this; }
  lessThan(field, value) { this._lessThan.push({ field, value }); return this; }
  greaterThanOrEqualTo(field, value) { this._gte.push({ field, value }); return this; }
  doesNotExist(field) { this._doesNotExist.push(field); return this; }
  ascending(field) { this._order = { field, dir: 'asc' }; return this; }
  descending(field) { this._order = { field, dir: 'desc' }; return this; }
  limit(n) { this._limit = n; return this; }
  static or(...queries) {
    const q = new FakeQuery('OR');
    q._or = queries;
    return q;
  }
  _orQuery(queries) { this._or = queries; return this; }
  _applyFilters(arr) {
    let result = arr;
    for (const f of this._filters) {
      result = result.filter(o => (o.get ? o.get(f.field) : o._data?.[f.field]) === f.value);
    }
    for (const f of this._neq) {
      result = result.filter(o => (o.get ? o.get(f.field) : o._data?.[f.field]) !== f.value);
    }
    for (const f of this._in) {
      result = result.filter(o => f.values.includes(o.get ? o.get(f.field) : o._data?.[f.field]));
    }
    for (const f of this._lessThan) {
      result = result.filter(o => {
        const val = o.get ? o.get(f.field) : o._data?.[f.field];
        return val instanceof Date ? val < f.value : val < f.value;
      });
    }
    for (const f of this._gte) {
      result = result.filter(o => {
        const val = o.get ? o.get(f.field) : o._data?.[f.field];
        return val instanceof Date ? val >= f.value : val >= f.value;
      });
    }
    for (const field of this._doesNotExist) {
      result = result.filter(o => o.get ? (o.get(field) === undefined) : (o._data?.[field] === undefined));
    }
    if (this._order) {
      const { field, dir } = this._order;
      result = result.slice().sort((a,b) => {
        const av = a.get ? a.get(field) : a._data?.[field];
        const bv = b.get ? b.get(field) : b._data?.[field];
        if (av == null && bv == null) return 0;
        if (av == null) return dir === 'asc' ? -1 : 1;
        if (bv == null) return dir === 'asc' ? 1 : -1;
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    if (typeof this._limit === 'number') {
      result = result.slice(0, this._limit);
    }
    return result;
  }
  async get(id) {
    const arr = store[this._className] || [];
    const found = arr.find(o => o.id === id);
    if (!found) {
      const err = new Error(`${this._className} not found`);
      err.code = 101;
      throw err;
    }
    return found;
  }
  async first() {
    if (this._or) {
      const merged = new Set();
      for (const q of this._or) {
        (await q.find()).forEach(o => merged.add(o));
      }
      const filtered = this._applyFilters(Array.from(merged));
      return filtered[0] || null;
    }
    const arr = store[this._className] || [];
    const filtered = this._applyFilters(arr);
    return filtered[0] || null;
  }
  async count() {
    let arr = store[this._className] || [];
    if (this._or) {
      const merged = new Set();
      for (const q of this._or) {
        (await q.find()).forEach(o => merged.add(o));
      }
      arr = Array.from(merged);
    }
    const filtered = this._applyFilters(arr);
    return filtered.length;
  }
  async find() {
    if (this._or) {
      const merged = new Set();
      for (const q of this._or) {
        (await q.find()).forEach(o => merged.add(o));
      }
      const filtered = this._applyFilters(Array.from(merged));
      return filtered;
    }
    const arr = store[this._className] || [];
    return this._applyFilters(arr);
  }
}

const Parse = {
  initialize: () => {},
  serverURL: 'http://localhost/parse',
  Object: {
    extend,
    saveAll: async (objs) => { for (const o of objs) await o.save(); return objs; },
    destroyAll: async (objs) => { for (const o of objs) await o.destroy(); return true; },
  },
  Query: FakeQuery,
  User: FakeUser,
  File: class {
    constructor(name, data, contentType) {
      this._name = name;
      this._data = data;
      this._contentType = contentType;
    }
    async save() { return this; }
    url() { return `http://mock/${encodeURIComponent(this._name || 'file')}`; }
  },
};

Parse.User.logIn = async () => new FakeUser();

// Helpers to seed data in tests
Parse.__store = store;
Parse.__reset = () => { Object.keys(store).forEach(k => store[k] = []); };
Parse.__create = (className, data) => {
  const Cls = extend(className);
  const obj = new Cls();
  Object.entries(data || {}).forEach(([k,v]) => obj.set(k, v));
  store[className] = store[className] || [];
  store[className].push(obj);
  return obj;
};

module.exports = Parse;