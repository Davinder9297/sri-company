import { $, esc, money, sizeLabel, grams, icon } from './util.js';
import { state, calc, cartQty, cartRemove, cartTotal, cartTotals, cartCount, onCart } from './state.js';
import { boxPhoto, bill, billFromCalc } from './ui.js';
import { openOverlay, closeOverlay, overlayOpen } from './overlay.js';

let navigate = () => {};
export const setNavigate = fn => { navigate = fn; };

function body() {
  if (!state.cart.length) {
    return `<div class="d-body"><div class="bag-empty"><div style="color:var(--indigo-200);margin-bottom:12px">${icon('bag', 'icon big')}</div><h3>Your bag is empty</h3><p>Pick a box, choose the fillings and it will appear here.</p><a class="btn btn-primary" href="/shop" data-link data-close>Browse gift boxes</a></div></div>`;
  }
  const items = state.cart.map(item => {
    const c = calc(item);
    return `<div class="bag-item">
      <div class="pic">${boxPhoto(c.product, { sm: true })}</div>
      <div>
        <h4>${esc(c.product.design)} · ${esc(sizeLabel(c.product.size))}</h4>
        ${bill(billFromCalc(c, item.quantity), { compact: true })}
        <div class="ctl">
          <div class="stepper" aria-label="Quantity"><button data-qty="${item.key}" data-d="-1" aria-label="Decrease">−</button><output>${item.quantity}</output><button data-qty="${item.key}" data-d="1" aria-label="Increase">+</button></div>
          <strong>${money(c.total)}</strong>
        </div>
        <div class="ctl" style="margin-top:.55rem"><span class="acts"><a href="/box/${esc(item.productId)}?edit=${item.key}" data-link data-close class="link-btn">Edit</a><button class="link-btn" style="color:var(--red-700)" data-remove="${item.key}">Remove</button></span><small class="muted">${money(c.unit)} each</small></div>
      </div></div>`;
  }).join('');
  return `<div class="d-body">${items}</div>
    <div class="d-foot">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><span style="font-weight:600">Subtotal <small class="muted" style="font-weight:400">(boxes + fillings + packing)</small></span><span>${money(cartTotals().subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span>GST (${cartTotals().pct}%)</span><span>${money(cartTotals().gst)}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;border-top:1px solid var(--line);padding-top:8px"><span style="font-weight:700">Total</span><span class="price">${money(cartTotals().total)}</span></div>
      <p class="muted" style="font-size:.82rem;margin:0 0 14px">Delivery charges, if any, are confirmed by our team. You will see the payment details after placing the order.</p>
      <a href="/checkout" class="btn btn-accent btn-block" data-link data-close>Proceed to checkout</a>
    </div>`;
}
const shell = () => `<div class="scrim"><aside class="drawer" role="dialog" aria-modal="true" aria-label="Your bag">
  <div class="d-head"><h3>Your bag <span class="muted" style="font-size:1rem;font-family:var(--font)">(${cartCount()})</span></h3><button class="x-btn" data-close aria-label="Close bag">${icon('close')}</button></div>${body()}</aside></div>`;

let open = false;
export function openCart() { open = true; openOverlay(shell(), { onClose: () => { open = false; } }); }
function refresh() {
  const n = cartCount();
  document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = n; });
  if (open && overlayOpen()) { const sc = $('#overlay .d-body')?.scrollTop || 0; $('#overlay').innerHTML = shell(); const b = $('#overlay .d-body'); if (b) b.scrollTop = sc; const scrim = $('#overlay').firstElementChild; scrim?.addEventListener('mousedown', e => { if (e.target === scrim) closeOverlay(); }); }
}
onCart(refresh);

document.addEventListener('click', e => {
  const q = e.target.closest('[data-qty]');
  if (q) { const it = state.cart.find(c => c.key === q.dataset.qty); if (it) cartQty(it.key, it.quantity + Number(q.dataset.d)); }
  const r = e.target.closest('[data-remove]');
  if (r) cartRemove(r.dataset.remove);
});
