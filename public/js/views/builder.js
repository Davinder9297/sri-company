import { $, $$, esc, money, sizeLabel, grams as gLabel, icon, toast, tel } from '../util.js';
import { state, calc, cartAdd, GRAM_STEP } from '../state.js';
import { boxPhoto, fillingPhoto } from '../ui.js';
import { openOverlay, closeOverlay } from '../overlay.js';
import { openCart } from '../cart.js';
import { notFound } from './pages.js';

export default async function builder(ctx) {
  const p = state.pById[ctx.params[0]];
  if (!p) return notFound();
  const n = p.compartments, cap = p.capacityGrams || 0;
  const editing = state.cart.find(c => c.key === ctx.query.get('edit') && c.productId === p.id);
  const even = Math.max(GRAM_STEP, Math.floor(cap / n / GRAM_STEP) * GRAM_STEP || 50);
  const b = {
    picks: editing ? editing.fillings.map(f => ({ ...f })) : Array.from({ length: n }, () => ({ fillingId: '', grams: even })),
    qty: editing ? editing.quantity : 1
  };
  const cols = n === 4 ? 2 : n <= 3 ? n : n % 3 === 0 ? 3 : Math.ceil(n / 2);
  const used = () => b.picks.reduce((s, x) => s + x.grams, 0);
  const left = () => cap ? cap - used() : Infinity;
  const filled = () => b.picks.filter(x => x.fillingId).length;

  const html = `
  <div class="wrap">
    <div class="crumbs" style="padding-top:22px"><a href="/" data-link>Home</a><span>/</span><a href="/shop" data-link>Gift boxes</a><span>/</span><a href="/shop/${encodeURIComponent(p.size)}" data-link>${esc(sizeLabel(p.size))}</a><span>/</span>${esc(p.design)}</div>
    <div class="builder" id="builder">
      <div class="b-visual">
        <div class="b-photo">${boxPhoto(p, { loading: 'eager' })}</div>
        <div class="inside">
          <div class="inside-head"><h3>Inside your box</h3><span>Top view · tap a compartment to choose</span></div>
          <div class="tray" id="tray" style="grid-template-columns:repeat(${cols},1fr);max-width:${cols > 2 ? '100%' : '460px'}"></div>
          <p class="note">Images are for illustration. Photos show the base ingredient — flavour, coating and arrangement may vary; the filling name shown is what you will receive.</p>
        </div>
      </div>
      <div class="b-panel">
        <div class="eyebrow">${esc(p.code)}</div>
        <h1>${esc(p.design)} gift box</h1>
        <div class="specs-row"><span class="spec">${esc(sizeLabel(p.size))}</span><span class="spec">${n} compartment${n > 1 ? 's' : ''}</span>${cap ? `<span class="spec">Holds up to ${gLabel(cap)}</span>` : ''}<span class="spec">Box ${money(p.price)}</span></div>
        <div class="rows" id="rows"></div>
        <div class="meter" id="meter"></div>
        <div class="sum" id="sum"></div>
        <div id="cta"></div>
      </div>
    </div>
  </div>`;

  function mount(app) {
    const root = $('#builder', app);
    const rowsEl = $('#rows', root), trayEl = $('#tray', root);

    function draw() {
      const active = document.activeElement?.dataset?.focusId;
      const c = calc({ productId: p.id, quantity: b.qty, fillings: b.picks });
      const fl = filled();

      trayEl.innerHTML = b.picks.map((x, i) => {
        const f = state.fById[x.fillingId];
        return `<button class="slot" type="button" data-pick="${i}" aria-label="Compartment ${i + 1}${f ? ': ' + esc(f.name) : ': choose a filling'}">
          <span class="num">${i + 1}</span>
          ${f ? `${fillingPhoto(f, { sm: false })}<span class="cap">${esc(f.name)}<small>${gLabel(x.grams)}</small></span>` : `<span class="empty-slot">${icon('plus')}Choose filling</span>`}
        </button>`;
      }).join('');

      rowsEl.innerHTML = b.picks.map((x, i) => {
        const f = state.fById[x.fillingId];
        const canUp = left() >= GRAM_STEP, canDown = x.grams > GRAM_STEP;
        return `<div class="crow${f ? ' done' : ''}">
          <span class="n">${i + 1}</span>
          <button class="pickbtn${f ? '' : ' empty'}" type="button" data-pick="${i}" data-focus-id="pick${i}">
            <span class="thumb">${f ? fillingPhoto(f) : icon('plus')}</span>
            <span class="tx"><b>${f ? esc(f.name) : 'Choose a filling'}</b><small>${f ? `${money(f.ratePerKg)}/kg · ${money(f.ratePerKg * x.grams / 1000)}` : `Compartment ${i + 1}`}</small></span>
          </button>
          <div class="stepper" role="group" aria-label="Weight for compartment ${i + 1}">
            <button type="button" data-g="${i}" data-d="-1" ${canDown ? '' : 'disabled'} aria-label="Less">−</button><output>${gLabel(x.grams)}</output><button type="button" data-g="${i}" data-d="1" ${canUp ? '' : 'disabled'} aria-label="More" data-focus-id="up${i}">+</button>
          </div></div>`;
      }).join('');

      const pct = cap ? Math.min(100, Math.round(used() / cap * 100)) : 0;
      $('#meter', root).innerHTML = cap ? `<div class="top"><span>Box capacity</span><span>${gLabel(used())} of ${gLabel(cap)}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
        ${n > 1 ? `<small>${left() > 0 ? `${gLabel(left())} still available — add it to any compartment.` : 'Weight is shared across the compartments. To give one more, reduce another.'} <button class="link-btn" type="button" id="resetW" style="font-size:.8rem">Split evenly</button></small>` : ''}` : '';

      const fillLabel = fl ? `${fl} filling${fl > 1 ? 's' : ''}` : 'Fillings';
      $('#sum', root).innerHTML = `
        <div class="line"><span>Empty box (${esc(p.design)})</span><span>${money(c.boxPrice)}</span></div>
        <div class="line"><span>${fillLabel}</span><span>${money(c.fillTotal)}</span></div>
        <div class="line"><span>Packing</span><span>${money(c.packing)}</span></div>
        <div class="line"><span>Price per box</span><span>${money(c.unit)}</span></div>
        <div class="line"><span>Quantity</span><span class="stepper"><button type="button" id="qm" ${b.qty <= 1 ? 'disabled' : ''} aria-label="Fewer boxes">−</button><output>${b.qty}</output><button type="button" id="qp" ${b.qty >= 99 ? 'disabled' : ''} aria-label="More boxes">+</button></span></div>
        <div class="line total"><span>Total</span><b>${money(c.total)}</b></div>`;

      const missing = n - fl;
      $('#cta', root).innerHTML = `
        <div class="buyrow"><button class="btn btn-accent" type="button" id="add" ${missing || !p.inStock || !(p.price > 0) ? 'disabled' : ''}>${editing ? 'Update bag' : 'Add to bag'} · ${money(c.total)}</button></div>
        ${!p.inStock ? '<p class="hint warn">This box is currently out of stock. Please call us.</p>' : missing ? `<p class="hint">${icon('info')}<span>Choose a filling for ${missing} more compartment${missing > 1 ? 's' : ''} to add this box to your bag.</span></p>` : `<p class="hint">${icon('check')}<span>All compartments filled. You will pay after placing your order.</span></p>`}
        <p class="hint">${icon('phone')}<span>Prefer to order by phone? Call <a href="${tel(state.store.phone1)}">${esc(state.store.phone1)}</a>.</span></p>`;

      if (active) root.querySelector(`[data-focus-id="${active}"]`)?.focus({ preventScroll: true });
    }

    function openPicker(idx) {
      let group = 'All', term = '';
      const groups = ['All', ...new Set(state.fillings.map(f => f.group))];
      const shell = () => `<div class="scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="Choose a filling">
        <div class="m-top"><div class="row"><h3>Compartment ${idx + 1} — choose a filling</h3><button class="x-btn" data-close aria-label="Close">${icon('close')}</button></div>
          <div class="search" style="max-width:none;margin-bottom:12px">${icon('search')}<input id="fq" type="search" placeholder="Search fillings, e.g. kaju, pista, cranberry" autofocus></div>
          <div class="chips" id="fchips"></div></div>
        <div class="m-body" id="flist"></div></div></div>`;
      const root2 = openOverlay(shell());
      const chips = () => { $('#fchips', root2).innerHTML = groups.map(g => `<button class="chip${g === group ? ' on' : ''}" type="button" data-grp="${esc(g)}">${esc(g)}</button>`).join(''); };
      const item = f => `<button class="pick${b.picks[idx].fillingId === f.id ? ' on' : ''}" type="button" data-fill="${esc(f.id)}"><span class="thumb">${fillingPhoto(f)}</span><span><b>${esc(f.name)}</b><small>${esc(f.group)}</small><span class="rate">${money(f.ratePerKg)} / kg</span></span></button>`;
      const list = () => {
        const q = term.toLowerCase();
        const items = state.fillings.filter(f => (group === 'All' || f.group === group) && (!q || f.name.toLowerCase().includes(q)));
        if (!items.length) { $('#flist', root2).innerHTML = '<div class="empty">No fillings match your search.</div>'; return; }
        const by = new Map(); items.forEach(f => by.set(f.group, [...(by.get(f.group) || []), f]));
        $('#flist', root2).innerHTML = [...by].map(([g, fs]) => `<div class="group-title">${esc(g)}</div><div class="pick-grid">${fs.map(item).join('')}</div>`).join('');
      };
      chips(); list();
      $('#fq', root2).addEventListener('input', e => { term = e.target.value.trim(); list(); });
      // Listen on the modal's own element (re-created every time), never on the shared #overlay container,
      // otherwise handlers from earlier pickers pile up and overwrite other compartments.
      root2.firstElementChild.addEventListener('click', e => {
        const c = e.target.closest('[data-grp]');
        if (c) { group = c.dataset.grp; chips(); list(); }
        const f = e.target.closest('[data-fill]');
        if (f) { b.picks[idx].fillingId = f.dataset.fill; closeOverlay(); draw(); }
      });
    }

    root.addEventListener('click', e => {
      const pick = e.target.closest('[data-pick]');
      if (pick) return openPicker(Number(pick.dataset.pick));
      const g = e.target.closest('[data-g]');
      if (g) {
        const i = Number(g.dataset.g), d = Number(g.dataset.d) * GRAM_STEP;
        if (d > 0 && left() < d) return;
        b.picks[i].grams = Math.max(GRAM_STEP, b.picks[i].grams + d); return draw();
      }
      if (e.target.closest('#qm')) { b.qty = Math.max(1, b.qty - 1); return draw(); }
      if (e.target.closest('#qp')) { b.qty = Math.min(99, b.qty + 1); return draw(); }
      if (e.target.closest('#resetW')) { b.picks.forEach(x => { x.grams = even; }); return draw(); }
      if (e.target.closest('#add')) {
        if (filled() < n) return toast('Please choose a filling for every compartment.', true);
        cartAdd({ key: editing?.key, productId: p.id, quantity: b.qty, fillings: b.picks });
        toast(editing ? 'Bag updated.' : 'Added to your bag.');
        if (editing) ctx.navigate('/box/' + p.id, { replace: true });
        openCart();
        if (!editing) { b.picks.forEach(x => { x.fillingId = ''; x.grams = even; }); b.qty = 1; draw(); }
      }
    });
    draw();
  }
  return { html, title: `${p.design} ${sizeLabel(p.size)} gift box`, mount };
}
