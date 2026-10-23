import { $, $$, esc, money, api, toast, grams, tel } from '/js/util.js';

let tab = 'orders', data = { products: [], fillings: [], orders: [], settings: {} }, defaultPw = false;
const app = $('#app');
const apiForm = async (url, fd) => { const r = await fetch(url, { method: 'POST', body: fd }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Upload failed'); return d; };
const STATUS = ['Awaiting payment', 'New', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
const PAY = ['Pending', 'Reported', 'Verified', 'Failed'];

async function boot() {
  const me = await api('/api/admin/me').catch(() => ({}));
  if (me.authenticated) { defaultPw = me.defaultPassword; await refresh(); } else login();
}
function login() {
  app.innerHTML = `<form class="login" id="login"><img src="/assets/logo-sm.png" alt="Sri Company"><h1 style="font-size:2.2rem">Store admin</h1><p class="muted">Sign in to manage orders, boxes, fillings and payment details.</p>
  <div class="f"><label>Email</label><input name="email" type="email" required autocomplete="username"></div>
  <div class="f"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>
  <div id="lerr" class="form-error hidden"></div><button class="btn btn-primary btn-block">Sign in</button></form>`;
}
async function refresh() {
  [data.products, data.fillings, data.orders, data.settings] = await Promise.all(['products', 'fillings', 'orders', 'settings'].map(k => api('/api/admin/' + k)));
  render();
}
function render() {
  const open = data.orders.filter(o => !['Delivered', 'Cancelled'].includes(o.status)).length;
  const toVerify = data.orders.filter(o => o.paymentStatus === 'Reported').length;
  app.innerHTML = `<div class="a-top"><div class="wrap"><a href="/"><img src="/assets/logo-sm.png" alt="Sri Company"></a><div class="r"><a href="/" target="_blank">View store ↗</a><button id="logout">Sign out</button></div></div></div>
  <div class="wrap" style="padding-bottom:60px">
    ${defaultPw ? '<div class="banner"><b>Security:</b> you are using the default admin password. Change it under Settings → Admin password, and set ADMIN_PASSWORD in .env.</div>' : ''}
    <div class="stats"><div class="stat"><small>Open orders</small><b>${open}</b></div><div class="stat ${toVerify ? 'alert' : ''}"><small>Payments to verify</small><b>${toVerify}</b></div><div class="stat"><small>Gift boxes</small><b>${data.products.filter(p => p.active).length}</b></div><div class="stat"><small>Fillings</small><b>${data.fillings.filter(f => f.active).length}</b></div></div>
    <div class="tabs">${[['orders', 'Orders'], ['products', 'Gift boxes'], ['fillings', 'Fillings & rates'], ['settings', 'Settings & payments']].map(([k, v]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${v}</button>`).join('')}</div>
    <div id="pane">${{ orders, products, fillings, settings }[tab]()}</div></div>`;
}

function orders() {
  if (!data.orders.length) return '<div class="empty">No orders yet. New orders appear here.</div>';
  return `<div class="card scroll"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Note</th></tr></thead><tbody>${data.orders.map(o => `<tr data-o="${esc(o.id)}">
    <td><b>${esc(o.id)}</b><span class="tiny">${esc(o.createdAt)} UTC</span></td>
    <td>${esc(o.customer.name)}<span class="tiny"><a href="${tel(o.customer.phone)}">${esc(o.customer.phone)}</a>${o.customer.email ? '<br>' + esc(o.customer.email) : ''}<br>${esc(o.customer.address)}, ${esc(o.customer.city)} ${esc(o.customer.pin)}</span>${o.note ? `<span class="tiny"><i>“${esc(o.note)}”</i></span>` : ''}</td>
    <td class="oitems">${o.items.map(i => `<b>${esc(i.name)} × ${i.quantity}</b><br>Box ${money(i.boxPrice || 0)} + ${i.fillings.map(f => esc(f.name) + ' ' + grams(f.grams) + ' (' + money(f.amount || 0) + ')').join(' + ')}<br><b>= ${money(i.unitPrice || 0)} each</b>`).join('<hr>')}</td>
    <td><b>${money(o.total)}</b></td>
    <td>${esc(o.paymentMethod)}<br><select data-f="paymentStatus">${PAY.map(s => `<option ${o.paymentStatus === s ? 'selected' : ''}>${s}</option>`).join('')}</select>${o.paymentRef ? `<span class="tiny">UTR: <b>${esc(o.paymentRef)}</b></span>` : ''}${o.proofFile ? `<span class="tiny"><a href="/api/admin/orders/${encodeURIComponent(o.id)}/proof" target="_blank" rel="noopener"><b>View screenshot / receipt (${esc(o.proofFile)})</b></a></span>` : ''}</td>
    <td><select data-f="status">${STATUS.map(s => `<option ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
    <td><input type="text" data-f="adminNote" value="${esc(o.adminNote || '')}" placeholder="Internal note"><button class="btn btn-primary btn-sm" data-save-order style="margin-top:6px">Save</button></td></tr>`).join('')}</tbody></table></div>
    <button class="btn btn-outline btn-sm" id="csv">Export CSV</button>`;
}
function products() {
  return `<div class="bar-row"><h2>Gift boxes</h2><span><button class="btn btn-outline btn-sm" id="cache">Download Drive photos to server</button> <button class="btn btn-primary btn-sm" id="addP">+ Add box</button></span></div>
  <p class="muted">Retail price is what the customer pays for the empty box (fillings are added on top). Photos can also be dropped into <code>public/uploads/products/</code> named like the box id.</p>
  <div class="card scroll"><table class="tbl"><thead><tr><th>Box</th><th>Retail ₹</th><th>Cost ₹</th><th>Capacity g</th><th>Compart.</th><th>Track stock</th><th>Stock</th><th>Active</th><th>Photo</th><th></th></tr></thead><tbody>${data.products.map(p => `<tr data-p="${esc(p.id)}" style="${p.active ? '' : 'opacity:.55'}">
    <td><span class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="" style="width:100%;height:100%;object-fit:cover" referrerpolicy="no-referrer">` : ''}</span><b>${esc(p.code)}</b></td>
    <td><input type="number" data-f="price" min="0" step="1" value="${p.price}"></td><td><input type="number" data-f="purchasePrice" min="0" step="0.01" value="${p.purchasePrice}"></td>
    <td><input type="number" data-f="capacityGrams" min="0" step="25" value="${p.capacityGrams}"></td><td><input type="number" data-f="compartments" min="1" max="12" value="${p.compartments}"></td>
    <td><input type="checkbox" data-f="trackStock" ${p.trackStock ? 'checked' : ''}></td><td><input type="number" data-f="stock" min="0" value="${p.stock}"></td>
    <td><input type="checkbox" data-f="active" ${p.active ? 'checked' : ''}></td>
    <td><label class="up">Upload<input hidden type="file" accept="image/jpeg,image/png,image/webp" data-up="product" data-id="${esc(p.id)}"></label></td>
    <td><button class="btn btn-primary btn-sm" data-save-p>Save</button></td></tr>`).join('')}</tbody></table></div>`;
}
function fillings() {
  return `<div class="bar-row"><h2>Fillings &amp; rates</h2><button class="btn btn-primary btn-sm" id="addF">+ Add filling</button></div>
  <p class="muted">Rate is ₹ per kg. Photos can also be dropped into <code>public/uploads/fillings/</code> named like the filling id (e.g. <code>badam.jpg</code>).</p>
  <div class="card scroll"><table class="tbl"><thead><tr><th>Filling</th><th>Type</th><th>₹ per kg</th><th>Active</th><th>Photo</th><th></th></tr></thead><tbody>${data.fillings.map(f => `<tr data-fl="${esc(f.id)}" style="${f.active ? '' : 'opacity:.55'}">
    <td><span class="thumb">${f.image ? `<img src="${esc(f.image)}" alt="" style="width:100%;height:100%;object-fit:cover">` : ''}</span><b>${esc(f.name)}</b><span class="tiny">${esc(f.id)}</span></td>
    <td><input type="text" data-f="group" value="${esc(f.group)}"></td><td><input type="number" data-f="ratePerKg" min="0" step="1" value="${f.ratePerKg}"></td>
    <td><input type="checkbox" data-f="active" ${f.active ? 'checked' : ''}></td>
    <td><label class="up">Upload<input hidden type="file" accept="image/jpeg,image/png,image/webp" data-up="filling" data-id="${esc(f.id)}"></label></td>
    <td><button class="btn btn-primary btn-sm" data-save-f>Save</button></td></tr>`).join('')}</tbody></table></div>`;
}
function settings() {
  const s = data.settings;
  const fld = (k, l, t = 'text') => `<div class="f"><label>${l}</label><input name="${k}" type="${t}" value="${esc(s[k])}"></div>`;
  return `<form id="sform"><div class="set-grid">
    <div class="card"><h3>Store</h3>${fld('storeName', 'Store name')}${fld('tagline', 'Tagline')}${fld('phone1', 'Phone / WhatsApp 1')}${fld('phone2', 'Phone / WhatsApp 2')}${fld('storeEmail', 'Public email (optional)', 'email')}
      <label class="opt"><input type="checkbox" name="codEnabled" ${s.codEnabled === 'true' ? 'checked' : ''}> Offer cash on delivery at checkout</label></div>
    <div class="card"><h3>UPI &amp; Google Pay</h3>${fld('gpayName', 'Account name')}${fld('gpayNumber', 'Google Pay number')}${fld('upiId', 'UPI ID (shown to customers)')}${fld('qrUpiId', 'UPI ID inside the QR image (for your reference)')}
      <div class="f"><label>Google Pay QR image</label><img src="${esc(s.qrImage)}" alt="QR" style="max-width:150px;border:1px solid var(--line);border-radius:8px;margin-bottom:8px"><label class="up" style="align-self:flex-start">Replace QR image<input hidden type="file" accept="image/jpeg,image/png,image/webp" data-up="qr" data-id="qr"></label></div></div>
    <div class="card"><h3>Bank account</h3>${fld('bankName', 'Bank name & branch')}${fld('accountName', 'Account name')}${fld('accountNumber', 'Account number')}${fld('ifsc', 'IFSC code')}</div>
    <div class="card"><h3>Admin password</h3><div class="f"><label>Current password</label><input id="pw1" type="password" autocomplete="current-password"></div><div class="f"><label>New password (10+ characters)</label><input id="pw2" type="password" autocomplete="new-password"></div><button class="btn btn-outline btn-sm" type="button" id="pwbtn">Change password</button></div>
  </div><button class="btn btn-primary" type="submit">Save settings</button></form>`;
}

async function guard(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }
const rowData = tr => Object.fromEntries($$('[data-f]', tr).map(el => [el.dataset.f, el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value]));

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'login') guard(async () => {
    const fd = new FormData(e.target);
    try { await api('/api/admin/login', { method: 'POST', body: Object.fromEntries(fd) }); } catch (err) { const b = $('#lerr'); b.textContent = err.message; b.classList.remove('hidden'); return; }
    const me = await api('/api/admin/me'); defaultPw = me.defaultPassword; await refresh();
  });
  if (e.target.id === 'sform') guard(async () => {
    const o = Object.fromEntries(new FormData(e.target)); o.codEnabled = e.target.codEnabled.checked ? 'true' : 'false';
    await api('/api/admin/settings', { method: 'PATCH', body: o }); toast('Settings saved.'); await refresh();
  });
});
document.addEventListener('click', e => guard(async () => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.tab) { tab = t.dataset.tab; await refresh(); }
  if (t.id === 'logout') { await api('/api/admin/logout', { method: 'POST' }); login(); }
  if (t.dataset.saveOrder !== undefined) { const tr = t.closest('tr'); await api('/api/admin/orders/' + encodeURIComponent(tr.dataset.o), { method: 'PATCH', body: rowData(tr) }); toast('Order updated.'); await refresh(); }
  if (t.dataset.saveP !== undefined) { const tr = t.closest('tr'); await api('/api/admin/products/' + encodeURIComponent(tr.dataset.p), { method: 'PATCH', body: rowData(tr) }); toast('Box saved.'); await refresh(); }
  if (t.dataset.saveF !== undefined) { const tr = t.closest('tr'); await api('/api/admin/fillings/' + encodeURIComponent(tr.dataset.fl), { method: 'PATCH', body: rowData(tr) }); toast('Filling saved.'); await refresh(); }
  if (t.id === 'addP') { const code = prompt('Box code (e.g. SC13-8x8)'); if (!code) return; const price = Number(prompt('Retail price of the empty box (₹)') || 0); const cap = Number(prompt('Capacity in grams (e.g. 200)') || 0); const comp = Number(prompt('Number of compartments') || 4); const size = prompt('Size, e.g. 8x8') || ''; await api('/api/admin/products', { method: 'POST', body: { code, design: code.split('-')[0], size, price, capacityGrams: cap, weight: cap + 'G', compartments: comp } }); await refresh(); }
  if (t.id === 'addF') { const name = prompt('Filling name'); if (!name) return; const rate = Number(prompt('Rate per kg (₹)') || 0); await api('/api/admin/fillings', { method: 'POST', body: { name, ratePerKg: rate } }); await refresh(); }
  if (t.id === 'cache') { toast('Downloading photos…'); const r = await api('/api/admin/cache-images', { method: 'POST' }); toast(`Saved ${r.done} of ${r.total} photos${r.failed ? `, ${r.failed} failed (check Drive sharing)` : ''}.`); await refresh(); }
  if (t.id === 'pwbtn') { await api('/api/admin/password', { method: 'POST', body: { current: $('#pw1').value, next: $('#pw2').value } }); defaultPw = false; toast('Password changed.'); $('#pw1').value = $('#pw2').value = ''; }
  if (t.id === 'csv') {
    const rows = [['Order', 'Date', 'Customer', 'Phone', 'Email', 'Address', 'City', 'PIN', 'Items', 'Box total', 'Fillings total', 'Total', 'Payment method', 'Payment status', 'UTR', 'Screenshot', 'Status'], ...data.orders.map(o => [o.id, o.createdAt, o.customer.name, o.customer.phone, o.customer.email, o.customer.address, o.customer.city, o.customer.pin, o.items.map(i => `${i.name} x${i.quantity} (${i.fillings.map(f => f.name + ' ' + f.grams + 'g').join('; ')})`).join(' | '), o.items.reduce((s, i) => s + (i.boxPrice || 0) * i.quantity, 0), o.subtotal - o.items.reduce((s, i) => s + (i.boxPrice || 0) * i.quantity, 0), o.total, o.paymentMethod, o.paymentStatus, o.paymentRef, o.proofFile ? 'uploaded' : '', o.status])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'orders.csv'; a.click();
  }
}));
document.addEventListener('change', e => guard(async () => {
  const t = e.target; if (!t.dataset.up) return;
  const fd = new FormData(); fd.append('image', t.files[0]);
  await apiForm(`/api/admin/upload/${t.dataset.up}/${encodeURIComponent(t.dataset.id)}`, fd); toast('Photo uploaded.'); await refresh();
}));
boot();
