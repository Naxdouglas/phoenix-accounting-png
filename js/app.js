// App shell: routing, auth wiring, modal helper
(function (global) {
  const App = {};
  const view = () => document.getElementById('view');
  const header = () => document.getElementById('appHeader');
  const nav = () => document.getElementById('mainNav');
  const whoami = () => document.getElementById('whoami');
  const modalRoot = () => document.getElementById('modalRoot');

  const ROUTES = {
    sme: [
      { hash: '#/dashboard', label: 'Dashboard', render: SME.renderDashboard },
      { hash: '#/transactions', label: 'Transactions', render: SME.renderTransactions },
      { hash: '#/reports', label: 'Reports', render: SME.renderReports },
      { hash: '#/payroll', label: 'Payroll', render: SME.renderPayroll },
      { hash: '#/help', label: 'Help', render: SME.renderHelp }
    ],
    admin: [
      { hash: '#/admin/clients', label: 'Clients', render: Admin.renderClients },
      { hash: '#/admin/payments', label: 'Payments', render: Admin.renderPayments },
      { hash: '#/admin/messages', label: 'Messages', render: Admin.renderMessages }
    ]
  };

  App.init = async function () {
    await Store.ready();

    document.getElementById('logoutBtn').addEventListener('click', () => {
      Auth.logout();
      location.hash = '';
      render();
    });

    window.addEventListener('hashchange', render);
    render();
  };

  function render() {
    const user = Auth.currentUser();
    view().innerHTML = '';
    if (!user) {
      header().hidden = true;
      renderAuth();
      return;
    }
    header().hidden = false;
    whoami().textContent = user.role === 'admin'
      ? `${user.ownerName} · Admin`
      : `${user.ownerName} · ${user.businessName}`;

    const routes = ROUTES[user.role] || [];
    const defaultHash = routes[0].hash;
    if (!location.hash) {
      location.hash = defaultHash;
      return; // will trigger hashchange
    }

    // Handle dynamic admin client detail route
    let matched = routes.find(r => r.hash === location.hash);
    let renderFn = matched ? matched.render : null;
    let clientId = null;
    if (!matched && user.role === 'admin') {
      const m = location.hash.match(/^#\/admin\/clients\/(.+)$/);
      if (m) { clientId = m[1]; renderFn = (v) => Admin.renderClientDetail(v, clientId); matched = { hash: '#/admin/clients' }; }
    }
    if (!matched) {
      location.hash = defaultHash;
      return;
    }
    // nav
    nav().innerHTML = routes.map(r => {
      const active = (r.hash === matched.hash) ? ' active' : '';
      return `<a href="${r.hash}" class="${active.trim()}">${r.label}</a>`;
    }).join('');

    try {
      renderFn(view(), user);
    } catch (e) {
      console.error(e);
      view().innerHTML = `<div class="panel" style="padding:16px"><h2>Something went wrong</h2><pre>${Utils.escapeHtml(e.stack || e.message)}</pre></div>`;
    }
  }

  function renderAuth() {
    nav().innerHTML = '';
    const tpl = document.getElementById('tpl-auth').content.cloneNode(true);
    view().appendChild(tpl);

    const loginForm = view().querySelector('#loginForm');
    const registerForm = view().querySelector('#registerForm');
    const tabs = view().querySelectorAll('.tab');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('active', x === t));
      const tab = t.dataset.tab;
      loginForm.hidden = tab !== 'login';
      registerForm.hidden = tab !== 'register';
    }));

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = loginForm.querySelector('[data-role=error]');
      err.textContent = '';
      const data = Object.fromEntries(new FormData(loginForm).entries());
      try {
        await Auth.login(data.email, data.password);
        location.hash = '';
        render();
      } catch (ex) {
        err.textContent = ex.message;
      }
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = registerForm.querySelector('[data-role=error]');
      err.textContent = '';
      const data = Object.fromEntries(new FormData(registerForm).entries());
      try {
        await Auth.register(data);
        location.hash = '';
        render();
      } catch (ex) {
        err.textContent = ex.message;
      }
    });
  }

  // Modal helper
  App.openModal = function ({ title, bodyHtml, footer = [], onOpen }) {
    const root = modalRoot();
    root.hidden = false;
    root.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-head"><h3>${Utils.escapeHtml(title || '')}</h3>
        <button class="btn btn-ghost btn-sm" data-close aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${bodyHtml || ''}</div>
      <div class="modal-foot"></div>`;
    root.appendChild(modal);
    const foot = modal.querySelector('.modal-foot');
    footer.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.primary ? ' btn-primary' : '') + (b.danger ? ' btn-danger' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', async () => {
        let result = true;
        if (b.onClick) {
          try { result = await b.onClick(modal); } catch (e) { console.error(e); result = false; }
        }
        if (b.close || result === true) App.closeModal();
      });
      foot.appendChild(btn);
    });
    modal.querySelector('[data-close]').addEventListener('click', () => App.closeModal());
    root.addEventListener('click', backdrop);
    function backdrop(e) { if (e.target === root) App.closeModal(); }

    if (onOpen) onOpen(modal);
  };

  App.closeModal = function () {
    const root = modalRoot();
    root.innerHTML = '';
    root.hidden = true;
  };

  App.rerender = function () { render(); };

  global.App = App;
  document.addEventListener('DOMContentLoaded', App.init);
})(window);
