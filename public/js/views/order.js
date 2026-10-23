import { $, esc, money, grams, sizeLabel, icon, api, toast, wa, tel } from '../util.js';
import { statusPill, bill, billFromOrder } from '../ui.js';
import { upiBox, bankBox } from './paymentui.js';

export default async function order(ctx) {
  const id = ctx.params[0], token = ctx.query.get('t') || '';
  let data;
  try { data = await api(`/api/orders/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`); }
  catch (e) { return { title: 'Order', html: `<div class="wrap"><div class="empty" style="margin:64px 0"><h2 style="margin-bottom:.6rem">Order not found</h2><p>${esc(e.message)}</p><a class="btn btn-primary" href="/contact" data-link>Contact us</a></div></div>` }; }

  const { order: o, payment: pay, store } = data;
  const cancelled = o.status === 'Cancelled';
  const verified = o.paymentStatus === 'Verified';
  const boxesSum = Math.round(o.items.reduce((s, i) => s + (i.boxPrice || 0) * i.quantity, 0) * 100) / 100;
  const showPay = !cancelled && !verified && o.paymentMethod !== 'COD';
  const first = o.customer.name.split(' ')[0];
  const waText = `Hello Sri Company, I have paid for order ${o.id} (${money(o.total)}). Transaction ID: ${o.paymentRef || '________'}`;

  const payForm = () => `<form id="payform" novalidate>
      <div class="two">
        <div class="f"><label for="ref">UTR / transaction ID</label><input id="ref" name="reference" placeholder="e.g. 412345678901" autocomplete="off" value="${esc(o.paymentRef || '')}"><small>12-digit reference shown in your payment app.</small></div>
        <div class="f"><label for="proof">Payment screenshot or receipt</label>
          <label class="drop" for="proof"><input id="proof" name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><span class="drop-t"><b>Choose a file</b> or take a photo</span><span class="drop-s" id="fname">JPG, PNG, WEBP or PDF · up to 6 MB</span></label>
          <img id="fprev" class="hidden" alt="Screenshot preview"></div>
      </div>
      <p class="muted" style="font-size:.86rem;margin:0 0 14px">Enter the transaction ID, upload a screenshot, or both — either one is enough.</p>
      <div id="payerr" class="form-error hidden"></div>
      <button class="btn btn-primary" type="submit" id="paybtn">Submit payment details</button></form>`;

  const confirmPanel = () => {
    if (!showPay) return '';
    if (o.paymentStatus === 'Reported') return `<div class="panel confirm-pay"><h3>Payment details received</h3>
      <p>Thank you. Our team will verify your payment and confirm your order shortly.</p>
      <ul class="ticks"><li>${o.paymentRef ? `Transaction ID: <b>${esc(o.paymentRef)}</b>` : 'No transaction ID entered'}</li><li>${o.hasProof ? 'Payment screenshot / receipt: <b>uploaded</b>' : 'No screenshot uploaded'}</li></ul>
      <details style="margin:16px 0"><summary class="link-btn" style="cursor:pointer">Add or replace the screenshot / transaction ID</summary><div style="margin-top:16px">${payForm()}</div></details>
      <a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${wa(store.phone1, waText)}">${icon('whatsapp')} Message us on WhatsApp</a></div>`;
    return `<div class="panel confirm-pay"><h3>${o.paymentStatus === 'Failed' ? 'We could not verify your payment — please send the details again' : 'Already paid? Send us your payment proof'}</h3>
      <p class="muted">After paying, upload a screenshot of the payment (or the bank receipt) and/or enter the UTR so we can match it to this order quickly.</p>
      ${payForm()}
      <p class="muted" style="margin:16px 0 8px;font-size:.9rem">Prefer WhatsApp?</p>
      <a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${wa(store.phone1, waText)}">${icon('whatsapp')} Send screenshot on WhatsApp</a></div>`;
  };

  const html = `
  <section class="order-head"><div class="wrap">
    <h1>${cancelled ? 'Order cancelled' : verified ? 'Payment received — thank you!' : `Thank you, ${esc(first)}`}</h1>
    <p>${cancelled ? 'This order has been cancelled. Please call us if you have any questions.' : verified ? 'Your order is confirmed and our team is preparing it.' : o.paymentMethod === 'COD' ? 'Your order has been received. Our team will call you to confirm it.' : 'Your order has been received. Complete the payment below and your order will be confirmed.'}</p>
    <span class="ref">Order ${esc(o.id)}</span>
  </div></section>
  <div class="wrap" style="padding-top:32px;padding-bottom:84px">
    ${showPay ? `<div class="amount-due"><span>Amount to pay</span><b>${money(o.total)}</b></div>` : ''}
    <p style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:24px"><b>Order status</b> ${statusPill(o.status)} <b style="margin-left:.8rem">Payment</b> ${statusPill(o.paymentStatus === 'Pending' ? 'Awaiting payment' : o.paymentStatus === 'Reported' ? 'Awaiting verification' : o.paymentStatus)}</p>
    ${showPay ? `<div class="pay-cols">${upiBox(pay, { amount: o.total, orderId: o.id, chosen: o.paymentMethod === 'UPI' })}${bankBox(pay, { amount: o.total, orderId: o.id, chosen: o.paymentMethod === 'BANK' })}</div>` : ''}
    ${confirmPanel()}
    <div class="panel" style="margin-top:24px"><h3>Order details</h3>
      <table class="items-table"><thead><tr><th>Box &amp; fillings</th><th>Qty</th><th>Amount</th></tr></thead><tbody>
        ${o.items.map(i => `<tr><td><b>${esc(i.name)}</b>${bill(billFromOrder(i))}</td><td>${i.quantity}</td><td>${money(i.lineTotal)}</td></tr>`).join('')}
        <tr><td colspan="2" style="text-align:right">Boxes</td><td>${money(boxesSum)}</td></tr><tr><td colspan="2" style="text-align:right">Fillings</td><td>${money(Math.round((o.subtotal - boxesSum) * 100) / 100)}</td></tr><tr><td colspan="2" style="text-align:right"><b>Total</b></td><td><b style="font-size:1.1rem">${money(o.total)}</b></td></tr></tbody></table>
      <div class="two" style="margin-top:22px"><div><h4 style="font-family:var(--font);font-size:.76rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Deliver to</h4><p style="margin-top:.4rem">${esc(o.customer.name)}<br>${esc(o.customer.address)}<br>${esc(o.customer.city)}${o.customer.state ? ', ' + esc(o.customer.state) : ''} ${esc(o.customer.pin)}<br>${esc(o.customer.phone)}</p></div>
      ${o.note ? `<div><h4 style="font-family:var(--font);font-size:.76rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)">Your note</h4><p style="margin-top:.4rem">${esc(o.note)}</p></div>` : ''}</div>
    </div>
    <div class="notice no-print">${icon('info')}<span>Save or bookmark this page — it is your order link. Questions? Call <a href="${tel(store.phone1)}">${esc(store.phone1)}</a> or <a href="${tel(store.phone2)}">${esc(store.phone2)}</a>.</span></div>
    <p class="no-print" style="margin-top:18px"><button class="btn btn-outline btn-sm" type="button" data-print>Print this order</button></p>
  </div>`;

  function mount(app) {
    const form = $('#payform', app);
    if (!form) return;
    const file = $('#proof', form), prev = $('#fprev', form), fname = $('#fname', form), err = $('#payerr', form);
    const fail = m => { err.textContent = m; err.classList.remove('hidden'); };
    file.addEventListener('change', () => {
      err.classList.add('hidden'); prev.classList.add('hidden');
      const f = file.files[0];
      if (!f) { fname.textContent = 'JPG, PNG, WEBP or PDF · up to 6 MB'; return; }
      if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) { file.value = ''; fname.textContent = 'JPG, PNG, WEBP or PDF · up to 6 MB'; return fail('Please choose a JPG, PNG, WEBP image or a PDF.'); }
      if (f.size > 6 * 1024 * 1024) { file.value = ''; fname.textContent = 'JPG, PNG, WEBP or PDF · up to 6 MB'; return fail('That file is larger than 6 MB. Please choose a smaller screenshot.'); }
      fname.textContent = `${f.name} · ${(f.size / 1024 < 1024 ? Math.round(f.size / 1024) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB')}`;
      if (f.type.startsWith('image/')) { prev.src = URL.createObjectURL(f); prev.classList.remove('hidden'); }
    });
    form.addEventListener('submit', async e => {
      e.preventDefault(); err.classList.add('hidden');
      const ref = form.reference.value.trim(), f = file.files[0];
      if (!ref && !f) return fail('Please enter the UTR / transaction ID or choose a screenshot to upload.');
      if (ref && ref.length < 6) return fail('The UTR / transaction ID should be at least 6 characters.');
      const fd = new FormData(); fd.append('token', token); fd.append('reference', ref); if (f) fd.append('proof', f);
      const btn = $('#paybtn', form); btn.disabled = true; const label = btn.textContent; btn.textContent = 'Uploading…';
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(id)}/payment`, { method: 'POST', body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'Could not send your payment details. Please try again.');
        toast('Thank you — we have received your payment details.');
        ctx.navigate(`/order/${id}?t=${token}`, { replace: true });
      } catch (e2) { fail(e2.message); btn.disabled = false; btn.textContent = label; }
    });
  }
  return { html, title: `Order ${o.id}`, mount };
}
