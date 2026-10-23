import { $, $$, esc, icon, tel, wa, copyText, toast } from './util.js';
import { state, load, cartCount } from './state.js';
import { openCart, setNavigate } from './cart.js';
import { closeOverlay } from './overlay.js';
import home from './views/home.js';
import shop from './views/shop.js';
import builder from './views/builder.js';
import fillings from './views/fillings.js';
import checkout from './views/checkout.js';
import order from './views/order.js';
import { payment, faq, contact, notFound } from './views/pages.js';

const routes = [
  [/^\/$/, home], [/^\/shop\/?$/, shop], [/^\/box\/([^/]+)\/?$/, builder], [/^\/fillings\/?$/, fillings],
  [/^\/checkout\/?$/, checkout], [/^\/order\/([^/]+)\/?$/, order], [/^\/payment\/?$/, payment],
  [/^\/faq\/?$/, faq], [/^\/contact\/?$/, contact]
];
const TITLE = 'Sri Company';
const NAV = [['/shop', 'Gift boxes'], ['/fillings', 'Fillings & rates'], ['/#how', 'How it works'], ['/payment', 'Payment details'], ['/faq', 'FAQs'], ['/contact', 'Contact']];

function shell() {
  const s = state.store, p = state.payment;
  $('#shell').innerHTML = `
  <div class="announce"><div class="wrap">
    <div>Call or WhatsApp: <a href="${tel(s.phone1)}">${esc(s.phone1)}</a><span class="sep">|</span><a href="${tel(s.phone2)}">${esc(s.phone2)}</a></div>
    <div class="pay-note">Pay by UPI, Google Pay or bank transfer</div>
  </div></div>
  <header class="header"><div class="wrap">
    <a class="brand" href="/" data-link aria-label="Sri Company home"><img src="/assets/logo-sm.png" width="127" height="50" alt="Sri Company"></a>
    <nav class="nav" id="nav" aria-label="Main">${NAV.map(([h, l]) => `<a href="${h}" data-link data-nav="${h}">${l}</a>`).join('')}</nav>
    <div class="head-right">
      <div class="head-call"><span>Order by phone</span><a href="${tel(s.phone1)}">${esc(s.phone1)}</a></div>
      <button class="bag-btn" data-open-cart aria-label="Open bag">${icon('bag')}<span class="lbl">Bag</span><span class="count" data-cart-count>${cartCount()}</span></button>
      <button class="menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false">${icon('menu')}</button>
    </div>
  </div></header>
  <main id="app" tabindex="-1"></main>
  <footer class="footer"><div class="wrap">
    <div class="top">
      <div><img class="logo" src="/assets/logo-sm.png" alt="Sri Company"><p>${esc(s.tagline)}. Choose the box, fill every compartment, and we pack it for you.</p></div>
      <div><h4>Shop</h4><ul><li><a href="/shop" data-link>All gift boxes</a></li><li><a href="/shop?size=8x8" data-link>8 × 8 in</a></li><li><a href="/shop?size=10x10" data-link>10 × 10 in</a></li><li><a href="/shop?size=12x12" data-link>12 × 12 in</a></li><li><a href="/fillings" data-link>Fillings &amp; rates</a></li></ul></div>
      <div><h4>Help</h4><ul><li><a href="/#how" data-link>How it works</a></li><li><a href="/payment" data-link>Payment details</a></li><li><a href="/faq" data-link>FAQs</a></li><li><a href="/contact" data-link>Contact us</a></li></ul></div>
      <div><h4>Contact &amp; payments</h4><ul>
        <li><a href="${tel(s.phone1)}">${esc(s.phone1)}</a></li><li><a href="${tel(s.phone2)}">${esc(s.phone2)}</a></li>
        ${s.email ? `<li><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>` : ''}
        <li style="margin-top:.5rem">Google Pay: ${esc(p.gpayNumber)}</li><li>UPI: ${esc(p.upiId)}</li></ul></div>
    </div>
    <div class="bot"><span>© ${new Date().getFullYear()} ${esc(s.name)}. All rights reserved.</span><span>Payments by UPI, Google Pay &amp; bank transfer</span></div>
  </div></footer>
  <a class="wa-fab" href="${wa(s.phone1, 'Hello Sri Company, I would like to order a gift box.')}" target="_blank" rel="noopener">${icon('whatsapp')}<span>WhatsApp us</span></a>`;
}

async function render(path = location.pathname + location.search, { scroll = true } = {}) {
  const url = new URL(path, location.origin);
  const pathname = url.pathname;
  let view = notFound, params = [];
  for (const [re, v] of routes) { const m = pathname.match(re); if (m) { view = v; params = m.slice(1).map(decodeURIComponent); break; } }
  const ctx = { params, query: url.searchParams, navigate };
  const out = await view(ctx);
  $('#app').innerHTML = out.html;
  document.title = out.title ? `${out.title} — ${TITLE}` : `${TITLE} — Personalised Dry-Fruit Gift Boxes`;
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === pathname || (a.dataset.nav === '/shop' && pathname.startsWith('/box/'))));
  $('#nav')?.classList.remove('open');
  out.mount?.($('#app'), ctx);
  if (scroll) {
    const hash = url.hash && $(url.hash);
    if (hash) hash.scrollIntoView(); else window.scrollTo(0, 0);
  }
}

export function navigate(to, { replace = false } = {}) {
  closeOverlay();
  const u = new URL(to, location.origin);
  if (u.origin !== location.origin) { location.href = to; return; }
  history[replace ? 'replaceState' : 'pushState']({}, '', u.pathname + u.search + u.hash);
  render(u.pathname + u.search + u.hash);
}
setNavigate(navigate);

document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (a && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0 && !a.target && !a.hasAttribute('download')) {
    const u = new URL(a.href, location.origin);
    const internal = u.origin === location.origin && !/^\/(admin|uploads|assets|api)(\/|$)/.test(u.pathname);
    if (internal) { e.preventDefault(); navigate(a.getAttribute('href')); return; }
  }
  if (e.target.closest('[data-open-cart]')) openCart();
  const menu = e.target.closest('#menuBtn');
  if (menu) { const open = $('#nav').classList.toggle('open'); menu.setAttribute('aria-expanded', open); }
  if (e.target.closest('[data-print]')) window.print();
  const cp = e.target.closest('[data-copy]');
  if (cp) copyText(cp.dataset.copy, cp.dataset.label || 'Copied');
});
window.addEventListener('popstate', () => render(location.pathname + location.search + location.hash));
/* Missing/blocked photos: hide the <img> so the neutral fallback underneath shows. */
document.addEventListener('error', e => { if (e.target.tagName === 'IMG') e.target.classList.add('broken'); }, true);

(async function boot() {
  try {
    await load();
  } catch {
    $('#app').innerHTML = '<div class="loading">We could not load the store right now. Please refresh, or call +91 98490 14152.</div>';
    return;
  }
  shell();
  await render();
})();
