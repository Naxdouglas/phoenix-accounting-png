// SME user views & actions
(function (global) {
  const SME = {};
  const TXN_CATEGORIES = {
    income: ['Sales', 'Services', 'Interest', 'Grant', 'Other income'],
    expense: ['Inventory', 'Rent', 'Utilities', 'Salaries & wages', 'Transport', 'Supplies', 'Marketing', 'Taxes & licences', 'Bank fees', 'Other expense']
  };
  const ALL_CATEGORIES = [...TXN_CATEGORIES.income, ...TXN_CATEGORIES.expense];

  // ----- Dashboard -----
  SME.renderDashboard = function (view, user) {
    const tpl = document.getElementById('tpl-sme-dashboard').content.cloneNode(true);
    view.appendChild(tpl);

    const periodSelect = view.querySelector('#periodSelect');
    const savedPeriod = localStorage.getItem('phoenix_period') || 'this_month';
    periodSelect.value = savedPeriod;
    update(savedPeriod);
    periodSelect.addEventListener('change', () => {
      localStorage.setItem('phoenix_period', periodSelect.value);
      update(periodSelect.value);
    });

    function update(period) {
      const range = Utils.periodRange(period);
      const txns = Store.listTransactions(user.id).filter(t => Utils.inRange(t.date, range));
      let income = 0, expense = 0;
      txns.forEach(t => {
        if (t.type === 'income') income += Number(t.amount);
        else expense += Number(t.amount);
      });
      view.querySelector('#statIncome').textContent = Utils.formatKina(income);
      view.querySelector('#statExpense').textContent = Utils.formatKina(expense);
      const profit = income - expense;
      const profitEl = view.querySelector('#statProfit');
      profitEl.textContent = Utils.formatKina(profit);
      profitEl.style.color = profit < 0 ? 'var(--danger)' : 'var(--success)';
      view.querySelector('#statCount').textContent = txns.length;

      // Recent 5
      const recent = txns.slice(0, 5);
      view.querySelector('#recentTxn').innerHTML = renderTxnTable(recent, { compact: true });

      // Category breakdown (expenses only)
      const byCat = {};
      txns.filter(t => t.type === 'expense').forEach(t => {
        byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount);
      });
      const totalExp = expense;
      const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const catWrap = view.querySelector('#catBreakdown');
      if (!entries.length) {
        catWrap.innerHTML = '<div class="empty">No expenses recorded in this period.</div>';
      } else {
        catWrap.innerHTML = entries.map(([cat, amt]) => {
          const pct = totalExp > 0 ? (amt / totalExp * 100) : 0;
          return `
            <div class="cat-row">
              <div class="cat-top"><span>${Utils.escapeHtml(cat)}</span><span>${Utils.formatKina(amt)} · ${pct.toFixed(0)}%</span></div>
              <div class="cat-bar"><div class="cat-bar-inner" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
      }
    }
  };

  // ----- Transactions page -----
  SME.renderTransactions = function (view, user) {
    const tpl = document.getElementById('tpl-sme-transactions').content.cloneNode(true);
    view.appendChild(tpl);

    const filterCategory = view.querySelector('#filterCategory');
    ALL_CATEGORIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      filterCategory.appendChild(opt);
    });

    const filterType = view.querySelector('#filterType');
    const filterSearch = view.querySelector('#filterSearch');
    [filterType, filterCategory, filterSearch].forEach(el => el.addEventListener('input', refresh));

    view.querySelector('#addTxnBtn').addEventListener('click', () => openTxnModal(null, user, refresh));

    function refresh() {
      const type = filterType.value;
      const cat = filterCategory.value;
      const q = filterSearch.value.trim().toLowerCase();
      let list = Store.listTransactions(user.id);
      if (type) list = list.filter(t => t.type === type);
      if (cat) list = list.filter(t => t.category === cat);
      if (q) list = list.filter(t => (t.description || '').toLowerCase().includes(q));
      view.querySelector('#txnTable').innerHTML = renderTxnTable(list, { actions: true });
      attachTxnActions(view.querySelector('#txnTable'), user, refresh);
    }
    refresh();
  };

  function renderTxnTable(list, opts = {}) {
    if (!list.length) return '<div class="empty">No transactions yet.</div>';
    const rows = list.map(t => {
      const receipt = t.receiptId
        ? `<img class="thumb" data-receipt="${t.receiptId}" src="${(Store.findReceipt(t.receiptId) || {}).dataUrl || ''}" alt="receipt" />`
        : '';
      const amountCls = t.type === 'income' ? 'pill pill-income' : 'pill pill-expense';
      const signed = (t.type === 'income' ? '+' : '-') + Utils.formatKina(t.amount).replace('-', '');
      const actions = opts.actions
        ? `<td class="num">
             <button class="btn btn-sm" data-act="edit" data-id="${t.id}">Edit</button>
             <button class="btn btn-sm btn-danger" data-act="delete" data-id="${t.id}">Delete</button>
           </td>` : '';
      return `
        <tr>
          <td>${Utils.formatDate(t.date)}</td>
          <td><span class="${amountCls}">${t.type}</span></td>
          <td>${Utils.escapeHtml(t.category)}</td>
          <td>${Utils.escapeHtml(t.description || '')}</td>
          <td>${receipt}</td>
          <td class="num">${signed}</td>
          ${actions}
        </tr>`;
    }).join('');
    const actionsHead = opts.actions ? '<th></th>' : '';
    return `<table class="data">
      <thead><tr>
        <th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Receipt</th><th class="num">Amount</th>${actionsHead}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function attachTxnActions(root, user, refresh) {
    root.querySelectorAll('button[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const txn = Store.listTransactions(user.id).find(t => t.id === id);
        if (!txn) return;
        if (btn.dataset.act === 'edit') {
          openTxnModal(txn, user, refresh);
        } else if (btn.dataset.act === 'delete') {
          if (confirm('Delete this transaction?')) {
            Store.deleteTransaction(id);
            refresh();
          }
        }
      });
    });
    root.querySelectorAll('img.thumb[data-receipt]').forEach(img => {
      img.addEventListener('click', () => {
        const r = Store.findReceipt(img.dataset.receipt);
        if (!r) return;
        App.openModal({
          title: 'Receipt',
          bodyHtml: `<img class="receipt-preview" src="${r.dataUrl}" alt="receipt">`,
          footer: [{ label: 'Close', primary: true, close: true }]
        });
      });
    });
  }

  function openTxnModal(existing, user, onSave) {
    const isEdit = !!existing;
    const title = isEdit ? 'Edit transaction' : 'New transaction';
    const initial = existing || { type: 'expense', date: Utils.todayISO(), category: 'Sales', amount: '', description: '' };
    const bodyHtml = `
      <form id="txnForm" class="form-grid">
        <label>Type
          <select name="type" required>
            <option value="income" ${initial.type === 'income' ? 'selected' : ''}>Income</option>
            <option value="expense" ${initial.type === 'expense' ? 'selected' : ''}>Expense</option>
          </select>
        </label>
        <label>Date<input type="date" name="date" required value="${initial.date}"></label>
        <label class="full">Category<select name="category" required></select></label>
        <label class="full">Description<input type="text" name="description" value="${Utils.escapeHtml(initial.description || '')}"></label>
        <label>Amount (K)<input type="number" step="0.01" min="0" name="amount" required value="${initial.amount || ''}"></label>
        <label>Receipt photo<input type="file" name="receipt" accept="image/*"></label>
      </form>`;
    App.openModal({
      title,
      bodyHtml,
      footer: [
        { label: 'Cancel', close: true },
        { label: isEdit ? 'Save changes' : 'Add transaction', primary: true, onClick: onSubmit }
      ],
      onOpen: (modal) => {
        const form = modal.querySelector('#txnForm');
        const typeSel = form.querySelector('select[name=type]');
        const catSel = form.querySelector('select[name=category]');
        function rebuildCats() {
          const opts = TXN_CATEGORIES[typeSel.value];
          catSel.innerHTML = opts.map(c => `<option ${c === initial.category ? 'selected' : ''}>${c}</option>`).join('');
        }
        rebuildCats();
        typeSel.addEventListener('change', rebuildCats);
      }
    });

    async function onSubmit(modal) {
      const form = modal.querySelector('#txnForm');
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.amount || Number(data.amount) <= 0) { alert('Amount must be greater than 0'); return false; }

      let receiptId = existing ? existing.receiptId : null;
      const fileInput = form.querySelector('input[name=receipt]');
      if (fileInput.files && fileInput.files[0]) {
        try {
          const dataUrl = await Utils.readFileAsDataURL(fileInput.files[0]);
          const rec = Store.addReceipt({
            id: Utils.uid(),
            userId: user.id,
            dataUrl,
            filename: fileInput.files[0].name,
            createdAt: new Date().toISOString()
          });
          receiptId = rec.id;
        } catch (e) {
          console.error(e);
          alert('Could not read the receipt image.');
          return false;
        }
      }

      const payload = {
        type: data.type,
        date: data.date,
        category: data.category,
        description: data.description,
        amount: Number(data.amount),
        receiptId
      };
      if (isEdit) {
        Store.updateTransaction(existing.id, payload);
      } else {
        Store.addTransaction({ id: Utils.uid(), userId: user.id, createdAt: new Date().toISOString(), ...payload });
      }
      onSave();
      return true;
    }
  }

  // ----- Reports -----
  SME.renderReports = function (view, user) {
    const tpl = document.getElementById('tpl-sme-reports').content.cloneNode(true);
    view.appendChild(tpl);

    // Tab switching
    const tabs = view.querySelectorAll('.report-tabs .tab');
    const panes = view.querySelectorAll('[data-rpane]');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('active', x === t));
      panes.forEach(p => { p.hidden = p.dataset.rpane !== t.dataset.rtab; });
    }));

    // Statements (published only) for this SME
    const statements = Store.listStatements(user.id, { publishedOnly: true });
    const stmtList = view.querySelector('#statementsList');
    stmtList.innerHTML = Statements.renderList(statements);
    Statements.attachListHandlers(stmtList);

    const txns = Store.listTransactions(user.id);
    const byMonth = {};
    txns.forEach(t => {
      const key = Utils.ymKey(t.date);
      if (!byMonth[key]) byMonth[key] = { income: 0, expense: 0 };
      if (t.type === 'income') byMonth[key].income += Number(t.amount);
      else byMonth[key].expense += Number(t.amount);
    });
    const months = Object.keys(byMonth).sort();

    const tableEl = view.querySelector('#monthlyTable');
    if (!months.length) {
      tableEl.innerHTML = '<div class="empty">No transactions to report yet.</div>';
    } else {
      const rows = months.map(m => {
        const r = byMonth[m];
        const profit = r.income - r.expense;
        return `<tr>
          <td>${Utils.formatMonth(m)}</td>
          <td class="num">${Utils.formatKina(r.income)}</td>
          <td class="num">${Utils.formatKina(r.expense)}</td>
          <td class="num" style="color:${profit < 0 ? 'var(--danger)' : 'var(--success)'}">${Utils.formatKina(profit)}</td>
        </tr>`;
      }).join('');
      tableEl.innerHTML = `<table class="data">
        <thead><tr><th>Month</th><th class="num">Income</th><th class="num">Expenses</th><th class="num">Profit / Loss</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    // Chart
    const chart = view.querySelector('#monthlyChart');
    if (!months.length) {
      chart.innerHTML = '<div class="empty">No data to chart yet.</div>';
    } else {
      const max = Math.max(...months.map(m => Math.max(byMonth[m].income, byMonth[m].expense)));
      chart.innerHTML = months.map(m => {
        const r = byMonth[m];
        const h1 = max > 0 ? Math.max(2, (r.income / max * 160)) : 0;
        const h2 = max > 0 ? Math.max(2, (r.expense / max * 160)) : 0;
        return `<div class="bar-group">
          <div class="bar-pair">
            <div class="bar inc" style="height:${h1}px" title="Income: ${Utils.formatKina(r.income)}"></div>
            <div class="bar exp" style="height:${h2}px" title="Expense: ${Utils.formatKina(r.expense)}"></div>
          </div>
          <div class="bar-label">${Utils.formatMonth(m)}</div>
        </div>`;
      }).join('');
    }

    view.querySelector('#printReport').addEventListener('click', () => window.print());
  };

  // ----- Payroll -----
  SME.renderPayroll = function (view, user) {
    const tpl = document.getElementById('tpl-sme-payroll').content.cloneNode(true);
    view.appendChild(tpl);
    view.querySelector('#addPayrollBtn').addEventListener('click', () => openPayrollModal(user, refresh));
    function refresh() {
      const list = Store.listPayroll(user.id);
      const container = view.querySelector('#payrollTable');
      if (!list.length) { container.innerHTML = '<div class="empty">No pay runs recorded yet.</div>'; return; }
      const rows = list.map(p => `
        <tr>
          <td>${Utils.formatDate(p.payDate)}</td>
          <td>${Utils.escapeHtml(p.employeeName)}</td>
          <td>${Utils.escapeHtml(p.position || '')}</td>
          <td class="num">${Utils.formatKina(p.gross)}</td>
          <td class="num">${Utils.formatKina(p.tax)}</td>
          <td class="num">${Utils.formatKina(p.net)}</td>
          <td><button class="btn btn-sm btn-danger" data-del="${p.id}">Delete</button></td>
        </tr>`).join('');
      container.innerHTML = `<table class="data">
        <thead><tr><th>Pay date</th><th>Employee</th><th>Position</th><th class="num">Gross</th><th class="num">Tax</th><th class="num">Net</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table>`;
      container.querySelectorAll('button[data-del]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Delete this pay record?')) { Store.deletePayroll(btn.dataset.del); refresh(); }
        });
      });
    }
    refresh();
  };

  function openPayrollModal(user, onSave) {
    const bodyHtml = `
      <form id="pForm" class="form-grid">
        <label class="full">Employee name<input type="text" name="employeeName" required></label>
        <label>Position<input type="text" name="position"></label>
        <label>Pay date<input type="date" name="payDate" required value="${Utils.todayISO()}"></label>
        <label>Gross pay (K)<input type="number" step="0.01" min="0" name="gross" required></label>
        <label>Tax withheld (K)<input type="number" step="0.01" min="0" name="tax" value="0"></label>
        <label class="full">Notes<input type="text" name="notes"></label>
      </form>`;
    App.openModal({
      title: 'Record pay run',
      bodyHtml,
      footer: [
        { label: 'Cancel', close: true },
        { label: 'Save', primary: true, onClick: async (modal) => {
            const form = modal.querySelector('#pForm');
            const data = Object.fromEntries(new FormData(form).entries());
            const gross = Number(data.gross);
            const tax = Number(data.tax) || 0;
            if (!data.employeeName || gross <= 0) { alert('Employee and gross pay are required.'); return false; }
            Store.addPayroll({
              id: Utils.uid(),
              userId: user.id,
              employeeName: data.employeeName,
              position: data.position,
              payDate: data.payDate,
              gross,
              tax,
              net: gross - tax,
              notes: data.notes,
              createdAt: new Date().toISOString()
            });
            onSave();
            return true;
        }}
      ]
    });
  }

  // ----- Help -----
  SME.renderHelp = function (view, user) {
    const tpl = document.getElementById('tpl-sme-help').content.cloneNode(true);
    view.appendChild(tpl);

    const form = view.querySelector('#helpForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.message.trim()) return;
      Store.addHelpRequest({
        id: Utils.uid(),
        userId: user.id,
        topic: data.topic,
        message: data.message.trim(),
        priority: data.priority,
        status: 'open',
        reply: null,
        createdAt: new Date().toISOString()
      });
      form.reset();
      refresh();
    });
    function refresh() {
      const list = Store.listHelpRequests(user.id);
      const wrap = view.querySelector('#helpList');
      if (!list.length) { wrap.innerHTML = '<div class="empty">No requests yet — ask us anything!</div>'; return; }
      wrap.innerHTML = list.map(h => `
        <div class="help-item">
          <div class="help-item-head">
            <span><strong>${Utils.escapeHtml(h.topic)}</strong> · <span class="pill pill-${h.priority}">${h.priority}</span></span>
            <span>${Utils.formatDate(h.createdAt)} · <span class="pill pill-${h.status}">${h.status.replace('_', ' ')}</span></span>
          </div>
          <div class="help-item-body">${Utils.escapeHtml(h.message)}</div>
          ${h.reply ? `<div class="help-item-reply"><strong>Phoenix team:</strong> ${Utils.escapeHtml(h.reply)}</div>` : ''}
        </div>`).join('');
    }
    refresh();
  };

  global.SME = SME;
  global.TXN_CATEGORIES = TXN_CATEGORIES;
})(window);
