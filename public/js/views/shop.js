import { esc, sizeLabel, icon, $, $$ } from '../util.js';
import { state } from '../state.js';
import { productCard, sizeGroups } from '../ui.js';

export default async function shop({ query }) {
  const groups = sizeGroups(state.products);
  const sizes = [...groups.keys()];
  const cats = [...new Set(state.products.map(p => p.category).filter(Boolean))];
  const comps = [...new Set(state.products.map(p => p.compartments))].sort((a, b) => a - b);
  const f = {
    cats: new Set((query.get('type') || '').split(',').filter(Boolean)),
    sizes: new Set((query.get('size') || '').split(',').filter(s => groups.has(s))),
    comps: new Set((query.get('comp') || '').split(',').map(Number).filter(n => comps.includes(n))),
    q: query.get('q') || '', sort: query.get('sort') || 'size'
  };

  const html = `
  <section class="page-head"><div class="wrap"><div class="crumbs"><a href="/" data-link>Home</a><span>/</span>Gift boxes</div><h1 style="font-size:clamp(2.2rem,4vw,3.2rem)">Gift boxes</h1><p>Choose a box, then fill each compartment your way. Prices shown are for the empty box — fillings are added when you customise.</p></div></section>
  <div class="wrap"><div class="shop">
    <aside class="filters" id="filters" aria-label="Filters">
      ${cats.length > 1 ? `<div><h4>Box type</h4>${cats.map(c => `<label class="opt"><input type="checkbox" data-f="type" value="${esc(c)}"> ${esc(c)}<span class="n">${state.products.filter(p => p.category === c).length}</span></label>`).join('')}</div>` : ''}
      <div><h4>Box size</h4>${sizes.map(s => `<label class="opt"><input type="checkbox" data-f="size" value="${esc(s)}"> ${esc(sizeLabel(s))}<span class="n">${groups.get(s).length}</span></label>`).join('')}</div>
      <div><h4>Compartments</h4>${comps.map(c => `<label class="opt"><input type="checkbox" data-f="comp" value="${c}"> ${c} compartment${c > 1 ? 's' : ''}<span class="n">${state.products.filter(p => p.compartments === c).length}</span></label>`).join('')}</div>
      <button class="btn btn-outline btn-sm" id="clearF" type="button">Clear filters</button>
    </aside>
    <div>
      <div class="toolbar">
        <button class="btn btn-outline btn-sm filter-toggle" id="ftoggle" type="button">${icon('filter')} Filters</button>
        <div class="search">${icon('search')}<input id="q" type="search" placeholder="Search by design or code, e.g. SC05" aria-label="Search boxes"></div>
        <span class="result-count" id="count" aria-live="polite"></span>
        <select class="select" id="sort" aria-label="Sort"><option value="size">Sort: Size (small to large)</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="design">Design code</option></select>
      </div>
      <div class="grid grid-shop" id="grid"></div>
    </div>
  </div></div>`;

  function mount(app) {
    const root = $('.shop', app);
    const sync = () => {
      $$('[data-f="type"]', root).forEach(i => { i.checked = f.cats.has(i.value); });
      $$('[data-f="size"]', root).forEach(i => { i.checked = f.sizes.has(i.value); });
      $$('[data-f="comp"]', root).forEach(i => { i.checked = f.comps.has(Number(i.value)); });
      $('#q', root).value = f.q; $('#sort', root).value = f.sort;
    };
    sync();

    function draw() {
      let list = state.products.filter(p =>
        (!f.cats.size || f.cats.has(p.category)) && (!f.sizes.size || f.sizes.has(p.size)) && (!f.comps.size || f.comps.has(p.compartments)) &&
        (!f.q || `${p.code} ${p.design} ${p.size} ${sizeLabel(p.size)}`.toLowerCase().includes(f.q.toLowerCase())));
      if (f.sort === 'price-asc') list = list.sort((a, b) => a.price - b.price || 0);
      if (f.sort === 'price-desc') list = list.sort((a, b) => b.price - a.price);
      if (f.sort === 'design') list = list.sort((a, b) => a.design.localeCompare(b.design, undefined, { numeric: true }));
      $('#count', root).textContent = `${list.length} of ${state.products.length} boxes`;
      $('#grid', root).innerHTML = list.length ? list.map(productCard).join('') : `<div class="empty" style="grid-column:1/-1"><h3>No boxes match your filters</h3><p>Try removing a filter or searching for a different code.</p></div>`;
      const qs = new URLSearchParams();
      if (f.cats.size) qs.set('type', [...f.cats].join(','));
      if (f.sizes.size) qs.set('size', [...f.sizes].join(','));
      if (f.comps.size) qs.set('comp', [...f.comps].join(','));
      if (f.q) qs.set('q', f.q);
      if (f.sort !== 'size') qs.set('sort', f.sort);
      history.replaceState({}, '', location.pathname + (qs.toString() ? '?' + qs : ''));
    }
    root.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.f === 'type') t.checked ? f.cats.add(t.value) : f.cats.delete(t.value);
      if (t.dataset.f === 'size') t.checked ? f.sizes.add(t.value) : f.sizes.delete(t.value);
      if (t.dataset.f === 'comp') t.checked ? f.comps.add(Number(t.value)) : f.comps.delete(Number(t.value));
      if (t.id === 'sort') f.sort = t.value;
      draw();
    });
    $('#q', root).addEventListener('input', e => { f.q = e.target.value.trim(); draw(); });
    $('#clearF', root).addEventListener('click', () => { f.cats.clear(); f.sizes.clear(); f.comps.clear(); f.q = ''; f.sort = 'size'; sync(); draw(); });
    $('#ftoggle', root).addEventListener('click', () => $('#filters', root).classList.toggle('open'));
    draw();
  }
  return { html, title: 'Gift boxes', mount };
}
