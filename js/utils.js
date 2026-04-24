// Utility helpers for Phoenix Accounting app
(function (global) {
  const Utils = {};

  Utils.uid = function () {
    return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  };

  Utils.formatKina = function (n) {
    const num = Number(n) || 0;
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    return sign + 'K' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  Utils.formatDate = function (iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  Utils.formatMonth = function (ym) {
    // ym format "YYYY-MM"
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
  };

  Utils.todayISO = function () {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  Utils.ymKey = function (iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  Utils.periodRange = function (period) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let start, end;
    if (period === 'this_month') {
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0, 23, 59, 59);
    } else if (period === 'last_month') {
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0, 23, 59, 59);
    } else if (period === 'this_year') {
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59);
    } else {
      start = new Date(1970, 0, 1);
      end = new Date(2999, 11, 31);
    }
    return { start, end };
  };

  Utils.inRange = function (iso, range) {
    const d = new Date(iso);
    return d >= range.start && d <= range.end;
  };

  Utils.escapeHtml = function (s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  Utils.el = function (tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v != null) el.setAttribute(k, v);
      });
    }
    children.flat().forEach(c => {
      if (c == null) return;
      if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  };

  Utils.readFileAsDataURL = function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  Utils.hash = async function (text) {
    // Simple SHA-256 hash using SubtleCrypto for demo-level password handling
    if (global.crypto && global.crypto.subtle) {
      const enc = new TextEncoder().encode(text);
      const buf = await global.crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback (non-crypto) - only used if SubtleCrypto unavailable
    let h = 0;
    for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    return 'fb_' + (h >>> 0).toString(16);
  };

  global.Utils = Utils;
})(window);
