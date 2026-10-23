import { $, $$, esc, money, grams, sizeLabel, icon, api, toast } from '../util.js';
import { state, calc, cartTotal, cartClear } from '../state.js';
import { boxPhoto, bill, billFromCalc } from '../ui.js';

export default async function checkout(ctx) {
  if (!state.cart.length) {
    return { title: 'Checkout', html: `<div class="wrap"><div class="empty" style="margin:64px 0"><h2 style="margin-bottom:.6rem">Your bag is empty</h2><p>Choose a gift box and fill it before checking out.</p><a class="btn btn-primary" href="/shop" data-link>Browse gift boxes</a></div></div>` };
  }
  const total = cartTotal();
  const boxesTotal = Math.round(state.cart.reduce((s, i) => s + calc(i).boxPrice * i.quantity, 0) * 100) / 100;
  const fillTotal = Math.round((total - boxesTotal) * 100) / 100;
  const cod = state.store.codEnabled;
  const html = `
  <section class="page-head"><div class="wrap"><div class="crumbs"><a href="/" data-link>Home</a><span>/</span>Checkout</div><h1 style="font-size:clamp(2.2rem,4vw,3.2rem)">Checkout</h1></div></section>
  <div class="wrap"><form class="checkout" id="form" novalidate>
    <div>
      <div class="panel"><h3><span class="num">1</span> Contact details</h3>
        <div class="f"><label for="name">Full name <i>*</i></label><input id="name" name="name" autocomplete="name" required></div>
        <div class="two">
          <div class="f"><label for="phone">Mobile number <i>*</i></label><input id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="10-digit mobile number" required></div>
          <div class="f"><label for="email">Email (optional)</label><input id="email" name="email" type="email" autocomplete="email"></div>
        </div></div>
      <div class="panel"><h3><span class="num">2</span> Delivery address</h3>
        <div class="f"><label for="address">Address <i>*</i></label><textarea id="address" name="address" autocomplete="street-address" placeholder="House / flat no., street, area, landmark" required></textarea></div>
        <div class="three">
          <div class="f"><label for="city">City <i>*</i></label><input id="city" name="city" autocomplete="address-level2" required></div>
          <div class="f"><label for="state">State</label><input id="state" name="state" autocomplete="address-level1"></div>
          <div class="f"><label for="pin">PIN code <i>*</i></label><input id="pin" name="pin" inputmode="numeric" maxlength="6" autocomplete="postal-code" required></div>
        </div>
        <div class="f" style="margin-bottom:0"><label for="note">Gift message or instructions (optional)</label><textarea id="note" name="note" placeholder="Anything we should know about this order?"></textarea></div></div>
      <div class="panel"><h3><span class="num">3</span> Payment method</h3>
        <label class="radio-card"><input type="radio" name="method" value="UPI" checked><div><b>Google Pay / UPI</b><span>Scan our QR code or pay to our UPI ID from any UPI app.</span></div></label>
        <label class="radio-card"><input type="radio" name="method" value="BANK"><div><b>Bank transfer (NEFT / IMPS / RTGS)</b><span>Transfer to our ${esc(state.payment.bankName.split(',')[0])} account.</span></div></label>
        ${cod ? '<label class="radio-card"><input type="radio" name="method" value="COD"><div><b>Cash on delivery</b><span>Pay when your order arrives.</span></div></label>' : ''}
        <p class="muted" style="font-size:.88rem;margin:0">You will see the payment details and QR code on the next screen. Your order is confirmed once we receive your payment.</p></div>
    </div>
    <aside class="panel summary" aria-label="Order summary"><h3>Order summary</h3>
      ${state.cart.map(item => { const c = calc(item); return `<div class="o-item"><div class="o-head"><div class="pic">${boxPhoto(c.product, { sm: true })}</div><div><b>${esc(c.product.design)} · ${esc(sizeLabel(c.product.size))}</b><small>${c.totalGrams} g of fillings · ${item.quantity} ${item.quantity > 1 ? 'boxes' : 'box'}</small></div><b>${money(c.total)}</b></div>${bill(billFromCalc(c, item.quantity), { compact: true })}</div>`; }).join('')}
      <div class="sum"><div class="line"><span>Boxes</span><span>${money(boxesTotal)}</span></div><div class="line"><span>Fillings</span><span>${money(fillTotal)}</span></div><div class="line"><span>Subtotal</span><span>${money(total)}</span></div><div class="line"><span>Delivery</span><span class="muted">Confirmed by our team</span></div><div class="line total"><span>Total</span><b>${money(total)}</b></div></div>
      <div id="err" class="form-error hidden" role="alert" style="margin-top:14px"></div>
      <button class="btn btn-accent btn-block" id="place" type="submit" style="margin-top:18px">Place order · ${money(total)}</button>
      <p class="muted" style="font-size:.8rem;margin:12px 0 0">Prices are re-checked on our server when you place the order. Your details are used only to process and deliver this order.</p>
    </aside>
  </form></div>`;

  function mount(app) {
    const form = $('#form', app);
    const rules = {
      name: v => v.trim().length >= 2 || 'Please enter your full name.',
      phone: v => /^[6-9]\d{9}$/.test(v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')) || 'Enter a valid 10-digit mobile number.',
      email: v => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || 'That email address does not look right.',
      address: v => v.trim().length >= 8 || 'Please enter your full delivery address.',
      city: v => v.trim().length >= 2 || 'Please enter your city.',
      pin: v => /^\d{6}$/.test(v) || 'Enter a valid 6-digit PIN code.'
    };
    const check = el => {
      const f = el.closest('.f'); f.querySelector('.err')?.remove(); f.classList.remove('bad');
      const r = rules[el.name]?.(el.value);
      if (r !== undefined && r !== true) { f.classList.add('bad'); f.insertAdjacentHTML('beforeend', `<span class="err">${r}</span>`); return false; }
      return true;
    };
    $$('input,textarea', form).forEach(el => el.addEventListener('blur', () => rules[el.name] && check(el)));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const errBox = $('#err', form); errBox.classList.add('hidden');
      const bad = $$('input,textarea', form).filter(el => rules[el.name]).map(check).includes(false);
      if (bad) { $('.f.bad input, .f.bad textarea', form)?.focus(); return; }
      const fd = Object.fromEntries(new FormData(form));
      const btn = $('#place', form); btn.disabled = true; const label = btn.textContent; btn.textContent = 'Placing your order…';
      try {
        const r = await api('/api/orders', { method: 'POST', body: {
          customer: { name: fd.name, phone: fd.phone, email: fd.email, address: fd.address, city: fd.city, state: fd.state, pin: fd.pin },
          note: fd.note, paymentMethod: fd.method,
          items: state.cart.map(c => ({ productId: c.productId, quantity: c.quantity, fillings: c.fillings }))
        } });
        cartClear();
        ctx.navigate(`/order/${r.orderId}?t=${r.token}`, { replace: true });
      } catch (err) {
        errBox.textContent = err.message; errBox.classList.remove('hidden'); errBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
        btn.disabled = false; btn.textContent = label;
      }
    });
  }
  return { html, title: 'Checkout', mount };
}
