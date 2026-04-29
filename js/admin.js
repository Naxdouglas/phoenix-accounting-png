// Admin views
(function (global) {
  const Admin = {};

  // ----- Clients list -----
  Admin.renderClients = function (view) {
    const tpl = document.getElementById('tpl-admin-clients').content.cloneNode(true);
    view.appendChild(tpl);

    const search = view.querySelector('#clientSearch');
    search.addEventListener('input', refresh);

    function refresh() {
      const q = search.value.trim().toLowerCase();
      let smes = Store.listSmeUsers();
      if (q) {
        smes = smes.filter(u =>
          u.businessName.toLowerCase().includes(q) ||
          u.ownerName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }
      const container = view.querySelector('#clientTable');
      if (!smes.length) { container.innerHTML = '<div class="empty">No SME clients yet.</div>'; return; }
      const rows = smes.map(u => {
        const txns = Store.listTransactions(u.id);
        const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const payments = Store.listPayments(u.id);
        const due = payments.filter(p => p.status !== 'paid').reduce((s, p) => s + Number(p.amount), 0);
        return `<tr>
          <td><a href="#/admin/clients/${u.id}"><strong>${Utils.escapeHtml(u.businessName)}</strong></a><div style="color:var(--muted); font-size:12px;">${Utils.escapeHtml(u.ownerName)}</div></td>
          <td>${Utils.escapeHtml(u.email)}</td>
          <td>${Utils.escapeHtml(u.province || '')}</td>
          <td class="num">${txns.length}</td>
          <td class="num">${Utils.formatKina(income)}</td>
          <td class="num">${Utils.formatKina(expense)}</td>
          <td class="num" style="color:${due > 0 ? 'var(--danger)' : 'var(--muted)'}">${Utils.formatKina(due)}</td>
        </tr>`;
      }).join('');
      container.innerHTML = `<table class="data">
        <thead><tr><th>Business</th><th>Email</th><th>Province</th><th class="num">Transactions</th><th class="num">Income</th><th class="num">Expenses</th><th class="num">Outstanding</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }
    refresh();
  };

  // ----- Client detail -----
  Admin.renderClientDetail = function (view, clientId) {
    const tpl = document.getElementById('tpl-admin-client-detail').content.cloneNode(true);
    view.appendChild(tpl);

    const client = Store.findUser(clientId);
    const wrap = view.querySelector('#clientDetail');
    if (!client || client.role !== 'sme') {
      wrap.innerHTML = '<div class="empty">Client not found.</div>';
      return;
    }

    const txns = Store.listTransactions(client.id);
    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const payroll = Store.listPayroll(client.id);
    const payments = Store.listPayments(client.id);
    const helpReqs = Store.listHelpRequests(client.id);
    const statements = Store.listStatements(client.id);
    const initial = client.businessName.charAt(0).toUpperCase();

    wrap.innerHTML = `
      <div class="client-head">
        <div class="avatar">${Utils.escapeHtml(initial)}</div>
        <div style="flex:1">
          <div style="font-size:20px; font-weight:700;">${Utils.escapeHtml(client.businessName)}</div>
          <div class="client-meta">${Utils.escapeHtml(client.ownerName)} · ${Utils.escapeHtml(client.email)}${client.phone ? ' · ' + Utils.escapeHtml(client.phone) : ''}${client.province ? ' · ' + Utils.escapeHtml(client.province) : ''}</div>
          <div class="client-meta">Joined ${Utils.formatDate(client.createdAt)}</div>
        </div>
      </div>

      <div class="cards">
        <div class="stat-card stat-income"><div class="stat-label">Income</div><div class="stat-value">${Utils.formatKina(income)}</div></div>
        <div class="stat-card stat-expense"><div class="stat-label">Expenses</div><div class="stat-value">${Utils.formatKina(expense)}</div></div>
        <div class="stat-card stat-profit"><div class="stat-label">Profit / Loss</div><div class="stat-value" style="color:${income - expense < 0 ? 'var(--danger)' : 'var(--success)'}">${Utils.formatKina(income - expense)}</div></div>
        <div class="stat-card stat-count"><div class="stat-label">Transactions</div><div class="stat-value">${txns.length}</div></div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>Financial statements</h2>
          <button class="btn btn-sm btn-primary" id="addStatementBtn">+ New statement</button>
        </div>
        <div id="statementsList">${Statements.renderList(statements)}</div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Transactions</h2></div>
        <div class="table-wrap">${renderAdminTxnTable(txns)}</div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="panel-head"><h2>Payroll records</h2></div>
          ${renderPayrollList(payroll)}
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>Payments</h2>
            <button class="btn btn-sm btn-primary" id="addClientPayment">+ Record payment</button>
          </div>
          <div id="clientPaymentsTable">${renderPaymentsTable(payments, true)}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>Help requests</h2></div>
        ${renderHelpRequests(helpReqs, client.id)}
      </div>
    `;

    const refreshClient = () => {
      view.innerHTML = '';
      Admin.renderClientDetail(view, clientId);
    };

    const addPaymentBtn = wrap.querySelector('#addClientPayment');
    if (addPaymentBtn) addPaymentBtn.addEventListener('click', () => openPaymentModal(client, refreshClient));
    const addStmtBtn = wrap.querySelector('#addStatementBtn');
    if (addStmtBtn) addStmtBtn.addEventListener('click', () => Statements.openEditor(client, null, refreshClient));

    // Wire statement viewer with admin controls
    Statements.attachListHandlers(wrap.querySelector('#statementsList'), {
      adminControls: true,
      onChange: refreshClient
    });

    attachAdminHelpHandlers(wrap);
    attachPaymentHandlers(wrap, refreshClient);
  };

  function renderAdminTxnTable(list) {
    if (!list.length) return '<div class="empty">No transactions recorded.</div>';
    const rows = list.map(t => `
      <tr>
        <td>${Utils.formatDate(t.date)}</td>
        <td><span class="pill pill-${t.type}">${t.type}</span></td>
        <td>${Utils.escapeHtml(t.category)}</td>
        <td>${Utils.escapeHtml(t.description || '')}</td>
        <td>${t.receiptId ? `<img class="thumb" data-receipt="${t.receiptId}" src="${(Store.findReceipt(t.receiptId) || {}).dataUrl || ''}">` : ''}</td>
        <td class="num">${(t.type === 'income' ? '+' : '-') + Utils.formatKina(t.amount).replace('-', '')}</td>
      </tr>`).join('');
    return `<table class="data"><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Receipt</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderPayrollList(list) {
    if (!list.length) return '<div class="empty">No payroll records.</div>';
    const rows = list.map(p => `
      <tr><td>${Utils.formatDate(p.payDate)}</td><td>${Utils.escapeHtml(p.employeeName)}</td>
      <td class="num">${Utils.formatKina(p.gross)}</td><td class="num">${Utils.formatKina(p.net)}</td></tr>`).join('');
    return `<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Employee</th><th class="num">Gross</th><th class="num">Net</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderPaymentsTable(list, compact) {
    if (!list.length) return '<div class="empty">No payments recorded.</div>';
    const rows = list.map(p => `
      <tr>
        ${compact ? '' : `<td>${Utils.escapeHtml(p.clientName || '')}</td>`}
        <td>${Utils.formatDate(p.date)}</td>
        <td>${Utils.escapeHtml(p.description || '')}</td>
        <td class="num">${Utils.formatKina(p.amount)}</td>
        <td><span class="pill pill-${p.status}">${p.status}</span></td>
        <td>
          ${p.status !== 'paid' ? `<button class="btn btn-sm" data-pay-mark="${p.id}">Mark paid</button>` : ''}
          <button class="btn btn-sm btn-danger" data-pay-del="${p.id}">Delete</button>
        </td>
      </tr>`).join('');
    const clientCol = compact ? '' : '<th>Client</th>';
    return `<div class="table-wrap"><table class="data"><thead><tr>${clientCol}<th>Date</th><th>Description</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderHelpRequests(list, userId) {
    if (!list.length) return '<div class="empty">No help requests from this client.</div>';
    const idAttr = userId ? `data-client="${userId}"` : '';
    return '<div class="help-list">' + list.map(h => `
      <div class="help-item" data-help="${h.id}">
        <div class="help-item-head">
          <span><strong>${Utils.escapeHtml(h.topic)}</strong> · <span class="pill pill-${h.priority}">${h.priority}</span></span>
          <span>${Utils.formatDate(h.createdAt)} · <span class="pill pill-${h.status}">${h.status.replace('_', ' ')}</span></span>
        </div>
        <div class="help-item-body">${Utils.escapeHtml(h.message)}</div>
        ${h.reply ? `<div class="help-item-reply"><strong>Phoenix team:</strong> ${Utils.escapeHtml(h.reply)}</div>` : ''}
        <div style="margin-top:8px; display:flex; gap:6px; flex-wrap: wrap;">
          <button class="btn btn-sm" data-help-reply="${h.id}">${h.reply ? 'Edit reply' : 'Reply'}</button>
          ${h.status !== 'in_progress' ? `<button class="btn btn-sm" data-help-status="${h.id}" data-status="in_progress">Mark in progress</button>` : ''}
          ${h.status !== 'resolved' ? `<button class="btn btn-sm" data-help-status="${h.id}" data-status="resolved">Mark resolved</button>` : ''}
          ${h.status !== 'open' ? `<button class="btn btn-sm" data-help-status="${h.id}" data-status="open">Reopen</button>` : ''}
        </div>
      </div>`).join('') + '</div>';
  }

  function attachAdminHelpHandlers(root) {
    root.querySelectorAll('img.thumb[data-receipt]').forEach(img => {
      img.addEventListener('click', () => {
        const r = Store.findReceipt(img.dataset.receipt);
        if (!r) return;
        App.openModal({ title: 'Receipt', bodyHtml: `<img class="receipt-preview" src="${r.dataUrl}">`, footer: [{ label: 'Close', primary: true, close: true }] });
      });
    });
    root.querySelectorAll('button[data-help-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.updateHelpRequest(btn.dataset.helpStatus, { status: btn.dataset.status });
        App.rerender();
      });
    });
    root.querySelectorAll('button[data-help-reply]').forEach(btn => {
      btn.addEventListener('click', () => {
        const req = Store.listHelpRequests().find(h => h.id === btn.dataset.helpReply);
        if (!req) return;
        App.openModal({
          title: 'Reply to help request',
          bodyHtml: `<p style="margin-top:0; color:var(--muted)">${Utils.escapeHtml(req.message)}</p>
                     <label class="full">Your reply<textarea id="replyBody" rows="5" style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--border);">${Utils.escapeHtml(req.reply || '')}</textarea></label>`,
          footer: [
            { label: 'Cancel', close: true },
            { label: 'Send reply', primary: true, onClick: (modal) => {
              const reply = modal.querySelector('#replyBody').value.trim();
              Store.updateHelpRequest(req.id, { reply, status: req.status === 'open' ? 'in_progress' : req.status });
              App.rerender();
              return true;
            }}
          ]
        });
      });
    });
  }

  function attachPaymentHandlers(root, refresh) {
    root.querySelectorAll('button[data-pay-mark]').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.updatePayment(btn.dataset.payMark, { status: 'paid', paidAt: new Date().toISOString() });
        refresh();
      });
    });
    root.querySelectorAll('button[data-pay-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this payment record?')) { Store.deletePayment(btn.dataset.payDel); refresh(); }
      });
    });
  }

  function openPaymentModal(client, onSave) {
    const bodyHtml = `
      <form id="payForm" class="form-grid">
        <label class="full">Description<input type="text" name="description" required placeholder="e.g. Monthly accounting fee - June"></label>
        <label>Date<input type="date" name="date" required value="${Utils.todayISO()}"></label>
        <label>Amount (K)<input type="number" step="0.01" min="0" name="amount" required></label>
        <label>Status
          <select name="status">
            <option value="due">Due</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
      </form>`;
    App.openModal({
      title: `Record payment · ${client.businessName}`,
      bodyHtml,
      footer: [
        { label: 'Cancel', close: true },
        { label: 'Save', primary: true, onClick: (modal) => {
          const form = modal.querySelector('#payForm');
          const data = Object.fromEntries(new FormData(form).entries());
          if (!data.description || Number(data.amount) <= 0) { alert('Description and positive amount required.'); return false; }
          Store.addPayment({
            id: Utils.uid(),
            userId: client.id,
            clientName: client.businessName,
            description: data.description,
            date: data.date,
            amount: Number(data.amount),
            status: data.status,
            createdAt: new Date().toISOString()
          });
          onSave();
          return true;
        }}
      ]
    });
  }

  // ----- All statements page -----
  Admin.renderStatements = function (view) {
    const tpl = document.getElementById('tpl-admin-statements').content.cloneNode(true);
    view.appendChild(tpl);

    const clientFilter = view.querySelector('#filterStmtClient');
    Store.listSmeUsers().forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id; opt.textContent = u.businessName;
      clientFilter.appendChild(opt);
    });
    const typeFilter = view.querySelector('#filterStmtType');
    const statusFilter = view.querySelector('#filterStmtStatus');
    [clientFilter, typeFilter, statusFilter].forEach(el => el.addEventListener('change', refresh));

    view.querySelector('#addStatementGlobalBtn').addEventListener('click', () => {
      const smes = Store.listSmeUsers();
      if (!smes.length) { alert('No SME clients yet.'); return; }
      const bodyHtml = `
        <form id="pickClient" class="stacked-form">
          <label>Client to prepare statement for
            <select name="clientId" required>
              ${smes.map(u => `<option value="${u.id}">${Utils.escapeHtml(u.businessName)} — ${Utils.escapeHtml(u.ownerName)}</option>`).join('')}
            </select>
          </label>
        </form>`;
      App.openModal({
        title: 'New statement',
        bodyHtml,
        footer: [
          { label: 'Cancel', close: true },
          { label: 'Next', primary: true, onClick: (modal) => {
            const clientId = modal.querySelector('select[name=clientId]').value;
            const client = Store.findUser(clientId);
            App.closeModal();
            Statements.openEditor(client, null, refresh);
            return false;
          }}
        ]
      });
    });

    function refresh() {
      let list = Store.listStatements();
      if (clientFilter.value) list = list.filter(s => s.userId === clientFilter.value);
      if (typeFilter.value) list = list.filter(s => s.type === typeFilter.value);
      if (statusFilter.value) list = list.filter(s => s.status === statusFilter.value);
      // augment with client column
      const wrap = view.querySelector('#adminStatementsList');
      if (!list.length) { wrap.innerHTML = '<div class="empty">No statements match these filters.</div>'; return; }
      const rows = list.map(s => {
        const schema = Statements.schema(s.type);
        const total = schema.totalLabel
          ? Statements.signedSum(schema, s.data || {}, schema.totalFrom) + (schema.addExtra ? Number((s.data || {})[schema.addExtra] || 0) : 0)
          : (schema.balanceCheck ? Statements.signedSum(schema, s.data || {}, schema.balanceCheck.leftFrom) : null);
        const totalLabel = schema.totalLabel || (schema.balanceCheck ? schema.balanceCheck.leftLabel : '');
        const period = s.periodLabel || (s.periodEnd ? Utils.formatDate(s.periodEnd) : '');
        return `<tr>
          <td><strong>${Utils.escapeHtml(s.businessName || '')}</strong></td>
          <td><a href="#" data-view-statement="${s.id}">${Utils.escapeHtml(schema.shortTitle)}</a></td>
          <td>${Utils.escapeHtml(period)}</td>
          <td class="num">${total != null ? `<span style="color:var(--muted); font-size:12px">${Utils.escapeHtml(totalLabel)}</span><br>${Utils.formatKina(total)}` : ''}</td>
          <td><span class="pill pill-${s.status}">${s.status}</span></td>
          <td>${s.attachment ? '📎' : ''}</td>
          <td>${Utils.formatDate(s.updatedAt || s.createdAt)}</td>
        </tr>`;
      }).join('');
      wrap.innerHTML = `<div class="table-wrap"><table class="data">
        <thead><tr><th>Client</th><th>Type</th><th>Period</th><th class="num">Total</th><th>Status</th><th></th><th>Updated</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
      Statements.attachListHandlers(wrap, { adminControls: true, onChange: refresh });
    }
    refresh();
  };

  // ----- Payments page -----
  Admin.renderPayments = function (view) {
    const tpl = document.getElementById('tpl-admin-payments').content.cloneNode(true);
    view.appendChild(tpl);
    view.querySelector('#addPaymentBtn').addEventListener('click', () => {
      const smes = Store.listSmeUsers();
      if (!smes.length) { alert('No SME clients yet.'); return; }
      const bodyHtml = `
        <form id="pickClient" class="stacked-form">
          <label>Client
            <select name="clientId" required>
              ${smes.map(u => `<option value="${u.id}">${Utils.escapeHtml(u.businessName)} — ${Utils.escapeHtml(u.ownerName)}</option>`).join('')}
            </select>
          </label>
        </form>`;
      App.openModal({
        title: 'Record payment',
        bodyHtml,
        footer: [
          { label: 'Cancel', close: true },
          { label: 'Next', primary: true, onClick: (modal) => {
            const clientId = modal.querySelector('select[name=clientId]').value;
            const client = Store.findUser(clientId);
            App.closeModal();
            openPaymentModal(client, refresh);
            return false; // already closed
          }}
        ]
      });
    });
    function refresh() {
      const payments = Store.listPayments();
      view.querySelector('#paymentsTable').innerHTML = renderPaymentsTable(payments, false);
      attachPaymentHandlers(view.querySelector('#paymentsTable'), refresh);
    }
    refresh();
  };

  // ----- Messages / help requests -----
  Admin.renderMessages = function (view) {
    const tpl = document.getElementById('tpl-admin-messages').content.cloneNode(true);
    view.appendChild(tpl);

    const all = Store.listHelpRequests();
    if (!all.length) {
      view.querySelector('#adminMessagesList').innerHTML = '<div class="empty panel">No help requests yet.</div>';
      return;
    }
    const byUser = {};
    all.forEach(h => {
      if (!byUser[h.userId]) byUser[h.userId] = [];
      byUser[h.userId].push(h);
    });
    const html = Object.entries(byUser).map(([uid, list]) => {
      const user = Store.findUser(uid) || { businessName: 'Unknown', ownerName: '' };
      return `<div class="panel">
        <div class="panel-head">
          <h2>${Utils.escapeHtml(user.businessName)} <span style="color:var(--muted); font-weight:400; font-size:13px;">· ${Utils.escapeHtml(user.ownerName)}</span></h2>
          <a class="link" href="#/admin/clients/${uid}">Open client →</a>
        </div>
        ${renderHelpRequests(list, uid)}
      </div>`;
    }).join('');
    view.querySelector('#adminMessagesList').innerHTML = html;
    attachAdminHelpHandlers(view.querySelector('#adminMessagesList'));
  };

  global.Admin = Admin;
})(window);
