import { esc, money, grams, sizeLabel, icon } from './util.js';

/* Photo with an always-present neutral fallback underneath. If the image is missing or fails
   to load, app.js hides the <img> and the fallback shows — never a broken-image icon. */
const boxGlyph = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>';
export function boxPhoto(p, { sm = false, loading = 'lazy' } = {}) {
  return `<div class="ph box${sm ? ' sm' : ''}"><div class="ph-empty">${boxGlyph}<b>${esc(p.design || p.code)}</b><small>Photo coming soon</small></div>${p.image ? `<img src="${esc(p.image)}" alt="Gift box ${esc(p.design)} ${esc(sizeLabel(p.size))}" loading="${loading}" decoding="async" referrerpolicy="no-referrer">` : ''}</div>`;
}
export function fillingPhoto(f, { sm = true } = {}) {
  return `<div class="ph filling${sm ? ' sm' : ''}"><div class="ph-empty"><b>${esc(f.name)}</b></div>${f.image ? `<img src="${esc(f.image)}" alt="${esc(f.name)}" loading="lazy" decoding="async">` : ''}</div>`;
}

export function productCard(p) {
  return `<a class="pcard" href="/box/${esc(p.id)}" data-link>
    <div class="pic">${boxPhoto(p)}<div class="badges"><span class="badge">${esc(sizeLabel(p.size))}</span>${!p.inStock ? '<span class="badge red">Sold out</span>' : p.stockLeft != null && p.stockLeft <= 10 ? `<span class="badge yellow">Only ${p.stockLeft} left</span>` : ''}</div></div>
    <div class="body">
      <span class="code">${esc(p.code)}</span>
      <h3>${esc(p.design)} gift box</h3>
      <span class="specs">${p.compartments} compartment${p.compartments > 1 ? 's' : ''} · holds up to ${p.capacityGrams} g</span>
      <div class="foot"><span class="price"><small>Box from</small>${money(p.price)}</span><span class="go">Customise →</span></div>
    </div></a>`;
}

export function statusPill(text) {
  const ok = ['Verified', 'Confirmed', 'Delivered', 'Shipped', 'Packed'].includes(text);
  const bad = ['Failed', 'Cancelled'].includes(text);
  return `<span class="status${ok ? ' ok' : bad ? ' bad' : ''}">${esc(text)}</span>`;
}

export const sizeGroups = products => {
  const m = new Map();
  for (const p of products) {
    if (!m.has(p.size)) m.set(p.size, []);
    m.get(p.size).push(p);
  }
  return m;
};
/** One box-category (size) tile; links to that category's own page. */
export const categoryTile = (s, g) => {
  const rep = g.find(p => p.image) || g[0];
  const lo = Math.min(...g.map(p => p.price));
  return `<a class="size-tile" href="/shop/${encodeURIComponent(s)}" data-link><div class="pic">${boxPhoto(rep)}</div>
    <div class="body"><div><h3>${esc(sizeLabel(s))}</h3><p>Holds up to ${rep.capacityGrams} g · ${rep.compartments} compartments · ${g.length} designs</p></div><div class="from">Box from<b>${money(lo)}</b></div></div></a>`;
};
/** Itemised bill for one configured box: box price, every filling (weight × rate) and the per-box subtotal.
 *  b = { boxLabel, boxPrice, fillings:[{name, grams, ratePerKg, amount}], qty, total } */
export function bill(b, { compact = false } = {}) {
  const fillSum = Math.round(b.fillings.reduce((s, f) => s + f.amount, 0) * 100) / 100;
  const pack = b.packingPrice || 0;
  const unit = Math.round((b.boxPrice + fillSum + pack) * 100) / 100;
  return `<div class="bill${compact ? ' compact' : ''}">
    <div class="b-row b-box"><span>Gift box<small>${esc(b.boxLabel)}</small></span><b>${money(b.boxPrice)}</b></div>
    ${b.fillings.map(f => `<div class="b-row"><span>${esc(f.name)}<small>${grams(f.grams)} × ${money(f.ratePerKg)}/kg</small></span><span>${money(f.amount)}</span></div>`).join('')}
    <div class="b-row"><span>Packing<small>per box</small></span><span>${money(pack)}</span></div>
    <div class="b-row b-sub"><span>Price per box<small>box + fillings + packing</small></span><b>${money(unit)}</b></div>
    ${b.qty > 1 ? `<div class="b-row b-qty"><span>${money(unit)} × ${b.qty} boxes</span><b>${money(b.total)}</b></div>` : ''}
  </div>`;
}
/** Convert a cart item (client-side calc) into the shape `bill` expects. */
export const billFromCalc = (c, qty) => ({
  boxLabel: `${c.product.design} · ${sizeLabel(c.product.size)}`, boxPrice: c.boxPrice, packingPrice: c.packing,
  fillings: c.lines.map(l => ({ name: l.filling.name, grams: l.grams, ratePerKg: l.filling.ratePerKg, amount: l.amount })), qty, total: c.total
});
/** Same for an order line returned by the server. */
export const billFromOrder = i => ({
  boxLabel: i.name, boxPrice: i.boxPrice ?? 0, packingPrice: i.packingPrice ?? 0,
  fillings: i.fillings.map(f => ({ name: f.name, grams: f.grams, ratePerKg: f.ratePerKg ?? 0, amount: f.amount ?? 0 })), qty: i.quantity, total: i.lineTotal
});
export { icon };
