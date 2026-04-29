// Financial statements: schemas, editor (admin), viewer (shared)
(function (global) {
  const Statements = {};

  // ---------- Schemas ----------
  // Each section is a list of {label, amount} lines.
  // sign +1 = added to total, -1 = subtracted.
  const SCHEMAS = {
    income_statement: {
      type: 'income_statement',
      title: 'Income Statement',
      shortTitle: 'Income Statement',
      description: 'Profit & loss for the period.',
      sections: [
        { key: 'revenue',           label: 'Revenue',              sign: 1, defaults: ['Sales revenue', 'Service revenue', 'Other revenue'] },
        { key: 'cogs',              label: 'Cost of Goods Sold',   sign: -1, defaults: ['Opening inventory', 'Purchases', 'Less: closing inventory'] },
        { key: 'operating_expenses',label: 'Operating Expenses',   sign: -1, defaults: ['Rent', 'Salaries & wages', 'Utilities', 'Transport', 'Marketing', 'Office supplies', 'Depreciation'] },
        { key: 'other_income',      label: 'Other Income',         sign: 1, defaults: ['Interest income'] },
        { key: 'other_expenses',    label: 'Other Expenses',       sign: -1, defaults: ['Interest expense', 'Income tax'] }
      ],
      // Subtotals to display while rendering
      subtotals: [
        { afterSection: 'cogs', label: 'Gross Profit', from: ['revenue', 'cogs'] },
        { afterSection: 'operating_expenses', label: 'Operating Profit', from: ['revenue', 'cogs', 'operating_expenses'] }
      ],
      totalLabel: 'Net Profit / (Loss)',
      totalFrom: ['revenue', 'cogs', 'operating_expenses', 'other_income', 'other_expenses']
    },
    balance_sheet: {
      type: 'balance_sheet',
      title: 'Balance Sheet',
      shortTitle: 'Balance Sheet',
      description: 'Snapshot of assets, liabilities and equity at a point in time.',
      sections: [
        { key: 'current_assets',         label: 'Current Assets',         sign: 1, defaults: ['Cash on hand', 'Bank account', 'Accounts receivable', 'Inventory'] },
        { key: 'non_current_assets',     label: 'Non-current Assets',     sign: 1, defaults: ['Equipment', 'Vehicles', 'Buildings', 'Less: accumulated depreciation'] },
        { key: 'current_liabilities',    label: 'Current Liabilities',    sign: 1, defaults: ['Accounts payable', 'Short-term loans', 'Tax payable'] },
        { key: 'non_current_liabilities',label: 'Non-current Liabilities',sign: 1, defaults: ['Long-term loans'] },
        { key: 'equity',                 label: 'Equity',                 sign: 1, defaults: ["Owner's capital", 'Retained earnings'] }
      ],
      subtotals: [
        { afterSection: 'non_current_assets', label: 'Total Assets', from: ['current_assets', 'non_current_assets'] },
        { afterSection: 'non_current_liabilities', label: 'Total Liabilities', from: ['current_liabilities', 'non_current_liabilities'] },
        { afterSection: 'equity', label: 'Total Liabilities + Equity', from: ['current_liabilities', 'non_current_liabilities', 'equity'] }
      ],
      // For balance sheet, "balanced" check shown alongside
      balanceCheck: {
        leftLabel: 'Total Assets',
        leftFrom: ['current_assets', 'non_current_assets'],
        rightLabel: 'Total Liabilities + Equity',
        rightFrom: ['current_liabilities', 'non_current_liabilities', 'equity']
      }
    },
    cash_flow: {
      type: 'cash_flow',
      title: 'Cash Flow Statement',
      shortTitle: 'Cash Flow',
      description: 'Movement of cash in and out of the business.',
      sections: [
        { key: 'operating', label: 'Cash Flow from Operating Activities', sign: 1, defaults: ['Cash receipts from customers', 'Cash paid to suppliers', 'Cash paid to employees', 'Interest paid', 'Income tax paid'] },
        { key: 'investing', label: 'Cash Flow from Investing Activities', sign: 1, defaults: ['Purchase of equipment', 'Sale of equipment'] },
        { key: 'financing', label: 'Cash Flow from Financing Activities', sign: 1, defaults: ['Loan received', 'Loan repayments', "Owner's contributions", "Owner's withdrawals"] }
      ],
      extras: [
        { key: 'opening_cash', label: 'Cash at beginning of period' }
      ],
      subtotals: [
        { afterSection: 'financing', label: 'Net change in cash', from: ['operating', 'investing', 'financing'] }
      ],
      // closing = opening + net change
      totalLabel: 'Cash at end of period',
      totalFrom: ['operating', 'investing', 'financing'],
      addExtra: 'opening_cash'
    }
  };

  Statements.schema = function (type) { return SCHEMAS[type]; };
  Statements.allTypes = function () { return Object.values(SCHEMAS); };

  // ---------- Helpers ----------
  function sumSection(data, key) {
    const lines = (data && data[key]) || [];
    return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }
  function signedSum(schema, data, sectionKeys) {
    let total = 0;
    sectionKeys.forEach(k => {
      const sec = schema.sections.find(s => s.key === k);
      if (!sec) return;
      total += sec.sign * sumSection(data, k);
    });
    return total;
  }
  Statements.sumSection = sumSection;
  Statements.signedSum = signedSum;

  function emptyData(schema) {
    const data = {};
    schema.sections.forEach(s => {
      data[s.key] = s.defaults.map(label => ({ label, amount: 0 }));
    });
    if (schema.extras) schema.extras.forEach(e => { data[e.key] = 0; });
    return data;
  }

  // ---------- Statement viewer (shared) ----------
  Statements.openViewer = function (statementId, opts = {}) {
    const s = Store.findStatement(statementId);
    if (!s) return;
    const schema = SCHEMAS[s.type];
    const html = Statements.renderHTML(s, schema);

    const footer = [{ label: 'Close', close: true }];
    footer.push({ label: 'Print / Save PDF', onClick: () => {
      printStatement(s, schema);
      return false;
    }});
    if (s.attachment) {
      footer.push({ label: 'Open attachment', onClick: () => {
        const w = window.open();
        if (w) {
          w.document.title = s.attachment.filename || 'attachment';
          if ((s.attachment.mime || '').startsWith('image/')) {
            w.document.body.innerHTML = `<img src="${s.attachment.dataUrl}" style="max-width:100%">`;
          } else {
            w.document.body.innerHTML = `<iframe src="${s.attachment.dataUrl}" style="width:100%; height:100vh; border:none;"></iframe>`;
          }
        }
        return false;
      }});
    }
    if (opts.adminControls) {
      footer.push({ label: 'Edit', onClick: () => {
        App.closeModal();
        const client = Store.findUser(s.userId);
        Statements.openEditor(client, s.id, opts.onChange);
        return false;
      }});
      if (s.status === 'draft') {
        footer.push({ label: 'Publish', primary: true, onClick: () => {
          Store.updateStatement(s.id, { status: 'published', publishedAt: new Date().toISOString() });
          if (opts.onChange) opts.onChange();
          App.closeModal();
          return false;
        }});
      } else {
        footer.push({ label: 'Unpublish', onClick: () => {
          Store.updateStatement(s.id, { status: 'draft', publishedAt: null });
          if (opts.onChange) opts.onChange();
          App.closeModal();
          return false;
        }});
      }
      footer.push({ label: 'Delete', danger: true, onClick: () => {
        if (confirm('Delete this statement permanently?')) {
          Store.deleteStatement(s.id);
          if (opts.onChange) opts.onChange();
          App.closeModal();
        }
        return false;
      }});
    }

    App.openModal({ title: schema.title, bodyHtml: html, footer, size: 'wide' });
  };

  Statements.renderHTML = function (s, schema) {
    if (!schema) schema = SCHEMAS[s.type];
    const data = s.data || {};

    const headerRows = `
      <div class="stmt-header">
        <div>
          <div class="stmt-business">${Utils.escapeHtml(s.businessName || '')}</div>
          <div class="stmt-period">${Utils.escapeHtml(s.periodLabel || formatPeriod(s))}</div>
        </div>
        <div class="stmt-status"><span class="pill pill-${s.status}">${s.status}</span></div>
      </div>`;

    const subBefore = key => (schema.subtotals || []).filter(st => st.afterSection === key);

    let body = '';
    schema.sections.forEach(sec => {
      const lines = data[sec.key] || [];
      const total = sumSection(data, sec.key);
      body += `<div class="stmt-section">
        <div class="stmt-section-head">${Utils.escapeHtml(sec.label)}</div>
        <table class="stmt-table"><tbody>
          ${lines.length ? lines.map(l => `<tr><td>${Utils.escapeHtml(l.label || '')}</td><td class="num">${Utils.formatKina(l.amount)}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">—</td></tr>'}
          <tr class="stmt-subtotal"><td>Total ${Utils.escapeHtml(sec.label)}</td><td class="num">${Utils.formatKina(total)}</td></tr>
        </tbody></table>
      </div>`;
      subBefore(sec.key).forEach(st => {
        const v = signedSum(schema, data, st.from);
        body += `<div class="stmt-running"><span>${Utils.escapeHtml(st.label)}</span><span class="num">${Utils.formatKina(v)}</span></div>`;
      });
    });

    if (schema.extras) {
      schema.extras.forEach(e => {
        body += `<div class="stmt-running"><span>${Utils.escapeHtml(e.label)}</span><span class="num">${Utils.formatKina(data[e.key] || 0)}</span></div>`;
      });
    }

    if (schema.totalLabel) {
      const main = signedSum(schema, data, schema.totalFrom);
      const extra = schema.addExtra ? Number(data[schema.addExtra] || 0) : 0;
      const total = main + extra;
      body += `<div class="stmt-total"><span>${Utils.escapeHtml(schema.totalLabel)}</span><span class="num" style="color:${total < 0 ? 'var(--danger)' : 'var(--success)'}">${Utils.formatKina(total)}</span></div>`;
    }

    if (schema.balanceCheck) {
      const left = signedSum(schema, data, schema.balanceCheck.leftFrom);
      const right = signedSum(schema, data, schema.balanceCheck.rightFrom);
      const ok = Math.abs(left - right) < 0.01;
      body += `<div class="stmt-balance ${ok ? 'ok' : 'bad'}">
        <strong>${ok ? 'Balanced ✓' : 'Not balanced ⚠'}</strong> ·
        ${Utils.escapeHtml(schema.balanceCheck.leftLabel)} ${Utils.formatKina(left)}
        vs.
        ${Utils.escapeHtml(schema.balanceCheck.rightLabel)} ${Utils.formatKina(right)}
        (diff ${Utils.formatKina(left - right)})
      </div>`;
    }

    if (s.notes) {
      body += `<div class="stmt-notes"><strong>Notes from your accountant:</strong><div>${Utils.escapeHtml(s.notes)}</div></div>`;
    }

    if (s.attachment) {
      body += `<div class="stmt-attachment">📎 Attached: ${Utils.escapeHtml(s.attachment.filename || 'file')}</div>`;
    }

    return headerRows + body;
  };

  function formatPeriod(s) {
    if (s.periodLabel) return s.periodLabel;
    if (s.type === 'balance_sheet' && s.periodEnd) return 'As at ' + Utils.formatDate(s.periodEnd);
    if (s.periodStart && s.periodEnd) return Utils.formatDate(s.periodStart) + ' – ' + Utils.formatDate(s.periodEnd);
    return '';
  }

  function printStatement(s, schema) {
    const w = window.open('', '_blank');
    if (!w) { alert('Pop-up blocked. Please allow pop-ups to print.'); return; }
    // copy current stylesheet
    const styles = Array.from(document.styleSheets)
      .map(ss => { try { return Array.from(ss.cssRules).map(r => r.cssText).join('\n'); } catch (e) { return ''; } })
      .join('\n');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${schema.title} — ${Utils.escapeHtml(s.businessName || '')}</title>
      <style>${styles}\n@media print{body{margin:0}}</style></head>
      <body><div class="view"><div class="panel" style="padding:24px">
      <h1 style="margin-top:0">${schema.title}</h1>
      ${Statements.renderHTML(s, schema)}
      </div></div>
      <script>window.onload = () => setTimeout(() => window.print(), 200);<\/script>
      </body></html>`);
    w.document.close();
  }

  // ---------- Admin editor ----------
  Statements.openEditor = function (client, statementId, onSave) {
    const isEdit = !!statementId;
    const existing = isEdit ? Store.findStatement(statementId) : null;
    if (isEdit && !existing) return;

    let type = existing ? existing.type : 'income_statement';
    let schema = SCHEMAS[type];
    let data = existing ? JSON.parse(JSON.stringify(existing.data || {})) : emptyData(schema);
    let attachment = existing ? existing.attachment : null;
    let pendingAttachment = null; // file selected but not yet read
    let pendingClearAttachment = false;

    const today = Utils.todayISO();
    const defaultEnd = existing ? existing.periodEnd : today;
    const defaultStart = existing ? existing.periodStart : firstOfMonth(defaultEnd);

    const bodyHtml = `
      <div class="stmt-editor">
        <div class="form-grid">
          <label>Statement type
            <select id="stmtType">
              ${Object.values(SCHEMAS).map(s => `<option value="${s.type}" ${s.type === type ? 'selected' : ''}>${s.title}</option>`).join('')}
            </select>
          </label>
          <label id="periodStartWrap">Period start<input type="date" id="periodStart" value="${defaultStart || ''}"></label>
          <label>Period end (or "as at")<input type="date" id="periodEnd" value="${defaultEnd || ''}"></label>
          <label class="full">Period label (optional, overrides above)<input type="text" id="periodLabel" placeholder="e.g. Year ended 31 December 2025" value="${Utils.escapeHtml(existing ? (existing.periodLabel || '') : '')}"></label>
        </div>
        <div id="stmtSections"></div>
        <div id="stmtExtras"></div>
        <div id="stmtSummary" class="stmt-summary"></div>
        <label class="full" style="margin-top:12px;">Notes for the SME (optional)
          <textarea id="stmtNotes" rows="3">${Utils.escapeHtml(existing ? (existing.notes || '') : '')}</textarea>
        </label>
        <label class="full" style="margin-top:8px;">Attach a file (optional, e.g. signed PDF)
          <input type="file" id="stmtFile" accept="application/pdf,image/*">
        </label>
        <div id="attachInfo" style="font-size:13px; color:var(--muted); margin-top:4px;"></div>
      </div>`;

    App.openModal({
      title: (isEdit ? 'Edit ' : 'New ') + 'statement · ' + client.businessName,
      bodyHtml,
      size: 'wide',
      footer: [
        { label: 'Cancel', close: true },
        { label: 'Save as draft', onClick: (modal) => commit(modal, 'draft') },
        { label: isEdit && existing.status === 'published' ? 'Save & keep published' : 'Save & publish', primary: true, onClick: (modal) => commit(modal, 'published') }
      ],
      onOpen: (modal) => {
        const typeSel = modal.querySelector('#stmtType');
        const sectionsEl = modal.querySelector('#stmtSections');
        const extrasEl = modal.querySelector('#stmtExtras');
        const summaryEl = modal.querySelector('#stmtSummary');
        const periodStartWrap = modal.querySelector('#periodStartWrap');

        function renderEditor() {
          sectionsEl.innerHTML = schema.sections.map(sec => sectionMarkup(sec, data[sec.key])).join('');
          extrasEl.innerHTML = (schema.extras || []).map(e => `
            <div class="stmt-section">
              <div class="stmt-section-head">${Utils.escapeHtml(e.label)}</div>
              <div class="stmt-extra-row">
                <input type="number" step="0.01" data-extra="${e.key}" value="${Number(data[e.key] || 0)}">
              </div>
            </div>`).join('');
          // Period start is hidden for balance sheet (single date)
          periodStartWrap.style.display = (schema.type === 'balance_sheet') ? 'none' : '';
          attachLineHandlers();
          updateSummary();
        }

        function sectionMarkup(sec, lines = []) {
          return `<div class="stmt-section" data-section="${sec.key}">
            <div class="stmt-section-head"><span>${Utils.escapeHtml(sec.label)}</span><button class="btn btn-sm" data-add-line="${sec.key}" type="button">+ Add line</button></div>
            <div class="stmt-lines">
              ${lines.map((l, i) => lineMarkup(sec.key, i, l)).join('')}
            </div>
            <div class="stmt-section-total">Subtotal: <span data-subtotal="${sec.key}">${Utils.formatKina(sumSection(data, sec.key))}</span></div>
          </div>`;
        }
        function lineMarkup(secKey, i, line) {
          return `<div class="stmt-line" data-line="${i}">
            <input type="text" placeholder="Description" data-section="${secKey}" data-field="label" value="${Utils.escapeHtml(line.label || '')}">
            <input type="number" step="0.01" placeholder="0.00" data-section="${secKey}" data-field="amount" value="${Number(line.amount || 0)}">
            <button type="button" class="btn btn-sm btn-danger" data-remove="${secKey}" data-i="${i}">×</button>
          </div>`;
        }

        function attachLineHandlers() {
          sectionsEl.querySelectorAll('input[data-section]').forEach(input => {
            input.addEventListener('input', () => {
              const secKey = input.dataset.section;
              const lineEl = input.closest('.stmt-line');
              const i = Array.from(lineEl.parentElement.children).indexOf(lineEl);
              const field = input.dataset.field;
              if (!data[secKey]) data[secKey] = [];
              if (!data[secKey][i]) data[secKey][i] = { label: '', amount: 0 };
              data[secKey][i][field] = field === 'amount' ? Number(input.value || 0) : input.value;
              updateSubtotal(secKey);
              updateSummary();
            });
          });
          sectionsEl.querySelectorAll('button[data-add-line]').forEach(btn => {
            btn.addEventListener('click', () => {
              const secKey = btn.dataset.addLine;
              data[secKey] = data[secKey] || [];
              data[secKey].push({ label: '', amount: 0 });
              renderEditor();
            });
          });
          sectionsEl.querySelectorAll('button[data-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
              const secKey = btn.dataset.remove;
              const i = Number(btn.dataset.i);
              data[secKey].splice(i, 1);
              renderEditor();
            });
          });
          extrasEl.querySelectorAll('input[data-extra]').forEach(input => {
            input.addEventListener('input', () => {
              data[input.dataset.extra] = Number(input.value || 0);
              updateSummary();
            });
          });
        }
        function updateSubtotal(secKey) {
          const el = sectionsEl.querySelector(`[data-subtotal="${secKey}"]`);
          if (el) el.textContent = Utils.formatKina(sumSection(data, secKey));
        }
        function updateSummary() {
          let html = '';
          (schema.subtotals || []).forEach(st => {
            const v = signedSum(schema, data, st.from);
            html += `<div><span>${Utils.escapeHtml(st.label)}</span><span class="num">${Utils.formatKina(v)}</span></div>`;
          });
          if (schema.totalLabel) {
            const main = signedSum(schema, data, schema.totalFrom);
            const extra = schema.addExtra ? Number(data[schema.addExtra] || 0) : 0;
            const total = main + extra;
            html += `<div class="grand"><strong>${Utils.escapeHtml(schema.totalLabel)}</strong><span class="num">${Utils.formatKina(total)}</span></div>`;
          }
          if (schema.balanceCheck) {
            const left = signedSum(schema, data, schema.balanceCheck.leftFrom);
            const right = signedSum(schema, data, schema.balanceCheck.rightFrom);
            const ok = Math.abs(left - right) < 0.01;
            html += `<div class="grand"><strong>${ok ? '✓ Balanced' : '⚠ Not balanced'}</strong><span class="num" style="color:${ok ? 'var(--success)' : 'var(--danger)'}">diff ${Utils.formatKina(left - right)}</span></div>`;
          }
          summaryEl.innerHTML = html;
        }

        typeSel.addEventListener('change', () => {
          const hasUserData = Object.keys(data).some(k => Array.isArray(data[k]) && data[k].some(l => Number(l.amount) !== 0));
          if (hasUserData) {
            if (!confirm('Switching type will reset the line items. Continue?')) {
              typeSel.value = type;
              return;
            }
          }
          type = typeSel.value;
          schema = SCHEMAS[type];
          data = emptyData(schema);
          renderEditor();
        });

        // Attachment handling
        const fileInput = modal.querySelector('#stmtFile');
        const attachInfo = modal.querySelector('#attachInfo');
        function refreshAttachInfo() {
          if (pendingAttachment) {
            attachInfo.innerHTML = `Selected: ${Utils.escapeHtml(pendingAttachment.name)}`;
          } else if (attachment && !pendingClearAttachment) {
            attachInfo.innerHTML = `Attached: ${Utils.escapeHtml(attachment.filename)} <button type="button" class="btn btn-sm btn-danger" id="clearAttach">Remove</button>`;
            const btn = attachInfo.querySelector('#clearAttach');
            if (btn) btn.addEventListener('click', () => { pendingClearAttachment = true; pendingAttachment = null; fileInput.value = ''; refreshAttachInfo(); });
          } else {
            attachInfo.textContent = '';
          }
        }
        fileInput.addEventListener('change', () => {
          pendingAttachment = fileInput.files[0] || null;
          if (pendingAttachment) pendingClearAttachment = false;
          refreshAttachInfo();
        });
        refreshAttachInfo();

        renderEditor();
      }
    });

    async function commit(modal, status) {
      const periodEnd = modal.querySelector('#periodEnd').value || null;
      const periodStart = modal.querySelector('#periodStart').value || null;
      const periodLabel = modal.querySelector('#periodLabel').value.trim();
      const notes = modal.querySelector('#stmtNotes').value.trim();

      if (!periodEnd) {
        alert('Please set the period end date.');
        return false;
      }

      let finalAttachment = attachment;
      if (pendingClearAttachment) finalAttachment = null;
      if (pendingAttachment) {
        try {
          const dataUrl = await Utils.readFileAsDataURL(pendingAttachment);
          finalAttachment = {
            filename: pendingAttachment.name,
            mime: pendingAttachment.type,
            size: pendingAttachment.size,
            dataUrl
          };
        } catch (e) { console.error(e); alert('Could not read the attachment.'); return false; }
      }

      const payload = {
        type,
        userId: client.id,
        businessName: client.businessName,
        periodStart: schema.type === 'balance_sheet' ? null : periodStart,
        periodEnd,
        periodLabel: periodLabel || null,
        data,
        notes,
        status,
        attachment: finalAttachment,
        publishedAt: status === 'published' ? new Date().toISOString() : null
      };

      if (isEdit) {
        Store.updateStatement(existing.id, payload);
      } else {
        Store.addStatement({
          id: Utils.uid(),
          createdBy: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...payload
        });
      }
      if (onSave) onSave();
      return true;
    }
  };

  function firstOfMonth(iso) {
    if (!iso) return iso;
    return iso.slice(0, 8) + '01';
  }

  // ---------- Statement list (used by both admin & SME) ----------
  Statements.renderList = function (list, opts = {}) {
    if (!list.length) return '<div class="empty">No statements yet.</div>';
    const rows = list.map(s => {
      const schema = SCHEMAS[s.type];
      const period = s.periodLabel || formatPeriod(s);
      const total = schema.totalLabel
        ? signedSum(schema, s.data || {}, schema.totalFrom) + (schema.addExtra ? Number((s.data || {})[schema.addExtra] || 0) : 0)
        : (schema.balanceCheck ? signedSum(schema, s.data || {}, schema.balanceCheck.leftFrom) : null);
      const totalLabel = schema.totalLabel || (schema.balanceCheck ? schema.balanceCheck.leftLabel : '');
      return `<tr>
        <td><a href="#" data-view-statement="${s.id}"><strong>${Utils.escapeHtml(schema.shortTitle)}</strong></a></td>
        <td>${Utils.escapeHtml(period)}</td>
        <td class="num">${total != null ? `<span style="color:var(--muted); font-size:12px">${Utils.escapeHtml(totalLabel)}</span><br>${Utils.formatKina(total)}` : ''}</td>
        <td><span class="pill pill-${s.status}">${s.status}</span></td>
        <td>${s.attachment ? '📎' : ''}</td>
        <td>${Utils.formatDate(s.updatedAt || s.createdAt)}</td>
      </tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="data">
      <thead><tr><th>Statement</th><th>Period</th><th class="num">Total</th><th>Status</th><th></th><th>Updated</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  };

  Statements.attachListHandlers = function (root, opts = {}) {
    root.querySelectorAll('a[data-view-statement]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        Statements.openViewer(a.dataset.viewStatement, opts);
      });
    });
  };

  global.Statements = Statements;
})(window);
