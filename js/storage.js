// JSON/localStorage-backed data store for Phoenix Accounting
(function (global) {
  const KEY = 'phoenix_accounting_db_v1';
  const SEED_URL = 'data/seed.json';

  const Store = {};
  let db = null;
  let readyPromise = null;

  async function load() {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        db = JSON.parse(raw);
        migrate();
        return db;
      } catch (e) {
        console.warn('Failed to parse stored DB, reseeding.', e);
      }
    }
    // Fetch seed JSON
    try {
      const res = await fetch(SEED_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('seed fetch ' + res.status);
      db = await res.json();
    } catch (e) {
      console.warn('Seed fetch failed, using empty DB.', e);
      db = emptyDb();
    }
    migrate();
    persist();
    return db;
  }

  function emptyDb() {
    return {
      users: [],
      transactions: [],
      receipts: [],
      payroll: [],
      helpRequests: [],
      payments: [],
      messages: [],
      statements: [],
      meta: { createdAt: new Date().toISOString() }
    };
  }

  // Migrate older DBs missing newer collections
  function migrate() {
    if (!db) return;
    if (!db.statements) db.statements = [];
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Persist failed (quota?)', e);
      alert('Unable to save data: storage quota may be full. Try clearing old receipts.');
    }
  }

  Store.ready = function () {
    if (!readyPromise) readyPromise = load();
    return readyPromise;
  };

  Store.reset = async function () {
    localStorage.removeItem(KEY);
    readyPromise = null;
    db = null;
    return Store.ready();
  };

  Store.getDb = function () { return db; };

  // ----- Users -----
  Store.findUserByEmail = function (email) {
    if (!email) return null;
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  };
  Store.findUser = function (id) {
    return db.users.find(u => u.id === id) || null;
  };
  Store.listSmeUsers = function () {
    return db.users.filter(u => u.role === 'sme');
  };
  Store.addUser = function (user) {
    db.users.push(user);
    persist();
    return user;
  };

  // ----- Transactions -----
  Store.listTransactions = function (userId) {
    return db.transactions
      .filter(t => t.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date));
  };
  Store.addTransaction = function (txn) {
    db.transactions.push(txn);
    persist();
    return txn;
  };
  Store.updateTransaction = function (id, updates) {
    const t = db.transactions.find(t => t.id === id);
    if (!t) return null;
    Object.assign(t, updates);
    persist();
    return t;
  };
  Store.deleteTransaction = function (id) {
    const idx = db.transactions.findIndex(t => t.id === id);
    if (idx >= 0) {
      const t = db.transactions[idx];
      if (t.receiptId) {
        const ri = db.receipts.findIndex(r => r.id === t.receiptId);
        if (ri >= 0) db.receipts.splice(ri, 1);
      }
      db.transactions.splice(idx, 1);
      persist();
    }
  };

  // ----- Receipts -----
  Store.addReceipt = function (receipt) {
    db.receipts.push(receipt);
    persist();
    return receipt;
  };
  Store.findReceipt = function (id) {
    return db.receipts.find(r => r.id === id) || null;
  };

  // ----- Payroll -----
  Store.listPayroll = function (userId) {
    return db.payroll
      .filter(p => p.userId === userId)
      .sort((a, b) => b.payDate.localeCompare(a.payDate));
  };
  Store.addPayroll = function (entry) {
    db.payroll.push(entry);
    persist();
    return entry;
  };
  Store.deletePayroll = function (id) {
    const idx = db.payroll.findIndex(p => p.id === id);
    if (idx >= 0) { db.payroll.splice(idx, 1); persist(); }
  };

  // ----- Help requests -----
  Store.listHelpRequests = function (userId) {
    const items = userId
      ? db.helpRequests.filter(h => h.userId === userId)
      : db.helpRequests.slice();
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  };
  Store.addHelpRequest = function (req) {
    db.helpRequests.push(req);
    persist();
    return req;
  };
  Store.updateHelpRequest = function (id, updates) {
    const h = db.helpRequests.find(h => h.id === id);
    if (!h) return null;
    Object.assign(h, updates);
    persist();
    return h;
  };

  // ----- Payments -----
  Store.listPayments = function (userId) {
    const items = userId
      ? db.payments.filter(p => p.userId === userId)
      : db.payments.slice();
    return items.sort((a, b) => b.date.localeCompare(a.date));
  };
  Store.addPayment = function (payment) {
    db.payments.push(payment);
    persist();
    return payment;
  };
  Store.updatePayment = function (id, updates) {
    const p = db.payments.find(p => p.id === id);
    if (!p) return null;
    Object.assign(p, updates);
    persist();
    return p;
  };
  Store.deletePayment = function (id) {
    const idx = db.payments.findIndex(p => p.id === id);
    if (idx >= 0) { db.payments.splice(idx, 1); persist(); }
  };

  // ----- Statements -----
  Store.listStatements = function (userId, opts) {
    let items = userId
      ? db.statements.filter(s => s.userId === userId)
      : db.statements.slice();
    if (opts && opts.publishedOnly) items = items.filter(s => s.status === 'published');
    return items.sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || '') || b.createdAt.localeCompare(a.createdAt));
  };
  Store.findStatement = function (id) {
    return db.statements.find(s => s.id === id) || null;
  };
  Store.addStatement = function (s) {
    db.statements.push(s);
    persist();
    return s;
  };
  Store.updateStatement = function (id, updates) {
    const s = db.statements.find(s => s.id === id);
    if (!s) return null;
    Object.assign(s, updates, { updatedAt: new Date().toISOString() });
    persist();
    return s;
  };
  Store.deleteStatement = function (id) {
    const idx = db.statements.findIndex(s => s.id === id);
    if (idx >= 0) { db.statements.splice(idx, 1); persist(); }
  };

  // ----- Messages -----
  Store.listMessages = function (userId) {
    return db.messages
      .filter(m => m.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  };
  Store.addMessage = function (msg) {
    db.messages.push(msg);
    persist();
    return msg;
  };

  global.Store = Store;
})(window);
