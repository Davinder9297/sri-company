export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const money = n => {
  n = Math.round((Number(n) || 0) * 100) / 100;
  return '₹' + (Number.isInteger(n) ? inr.format(n) : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
};

export const sizeLabel = s => { s = String(s || ''); return /^\d+x1$|\+/.test(s) ? s.replace('x', ' × ').replace('+', ' + ') + ' layout' : s.replace('x', ' × ') + ' in'; };
export const grams = g => g >= 1000 ? `${(g / 1000).toFixed(g % 1000 ? 2 : 0).replace(/0+$/, '').replace(/\.$/, '')} kg` : `${g} g`;
export const digits = p => String(p || '').replace(/\D/g, '');
export const tel = p => 'tel:+' + (digits(p).length === 10 ? '91' + digits(p) : digits(p));
export const wa = (p, text = '') => `https://wa.me/${digits(p).length === 10 ? '91' + digits(p) : digits(p)}${text ? '?text=' + encodeURIComponent(text) : ''}`;

let toastTimer;
export function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('err', isErr);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

export async function copyText(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  toast(`${label}: ${text}`);
}

export async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

const ICONS = {
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  whatsapp: '<path d="M3 21l1.65-4.9A8.5 8.5 0 1 1 8 19.4L3 21z"/><path d="M9 10c.5 2.2 2.8 4.5 5 5l1.4-1.2a.8.8 0 0 0 0-1.1l-1.2-.8a.8.8 0 0 0-1 .1l-.5.5c-.9-.4-1.7-1.2-2.1-2.1l.5-.5a.8.8 0 0 0 .1-1l-.8-1.2a.8.8 0 0 0-1.1 0z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  rupee: '<path d="M6 4h12M6 9h12M9 4c6 0 6 9 0 9H6l8 7"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16" cy="14" r="1.2"/>',
  bank: '<path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  phoneup: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
  scale: '<path d="M12 4v16M6 20h12M5 8h14M5 8l-3 7a3.5 3.5 0 0 0 6 0L5 8zm14 0-3 7a3.5 3.5 0 0 0 6 0l-3-7z"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
export const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
