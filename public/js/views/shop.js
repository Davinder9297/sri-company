import { esc, sizeLabel, icon, $ } from '../util.js';
import { state } from '../state.js';
import { productCard, sizeGroups, categoryTile } from '../ui.js';

/** /shop            → list of box categories (sizes), no boxes.
 *  /shop/:size      → only the boxes of that category. */
export default async function shop({ params, query }) {
  const groups = sizeGroups(state.products);
  const wanted = params[0] || (query.get('size') || '').split(',')[0] || '';

  if (!wanted) {
    const html = `
    <section class="page-head"><div class="wrap"><div class="crumbs"><a href="/" data-link>Home</a><span>/</span>Gift boxes</div><h1 style="font-size:clamp(2.2rem,4vw,3.2rem)">Gift boxes</h1><p>Choose a box category to see the designs in it.</p></div></section>
    <section class="section"><div class="wrap"><div class="grid grid-3">${[...groups.keys()].map(s => categoryTile(s, groups.get(s))).join('')}</div></div></section>`;
    return { html, title: 'Gift boxes' };
  }

  const list0 = groups.get(wanted);
  if (!list0) {
    return { title: 'Category not found', html: `<div class="wrap"><div class="empty" style="margin:72px 0"><h2 style="margin-bottom:.6rem">We could not find that category</h2><a class="btn btn-primary" href="/shop" data-link>See all categories</a></div></div>` };
  }
  const label = sizeLabel(wanted);
  const html = `
  <section class="page-head"><div class="wrap"><div class="crumbs"><a href="/" data-link>Home</a><span>/</span><a href="/shop" data-link>Gift boxes</a><span>/</span>${esc(label)}</div>
    <h1 style="font-size:clamp(2.2rem,4vw,3.2rem)">${esc(label)} boxes</h1><p>${list0.length} design${list0.length > 1 ? 's' : ''} · holds up to ${list0[0].capacityGrams} g. Open a box to choose what goes into each compartment.</p></div></section>
  <div class="wrap" style="padding-top:22px">
    <div class="chips" style="margin-bottom:18px">${[...groups.keys()].map(s => `<a class="chip${s === wanted ? ' on' : ''}" href="/shop/${encodeURIComponent(s)}" data-link>${esc(sizeLabel(s))}</a>`).join('')}</div>
    <div class="toolbar">
      <div class="search">${icon('search')}<input id="q" type="search" placeholder="Search by design or code" aria-label="Search boxes"></div>
      <span class="result-count" id="count" aria-live="polite"></span>
      <select class="select" id="sort" aria-label="Sort"><option value="design">Sort: Design code</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select>
    </div>
    <div class="grid grid-4" id="grid" style="margin-bottom:60px"></div>
  </div>`;

  function mount(app) {
    let q = '', sort = 'design';
    const draw = () => {
      let list = list0.filter(p => !q || `${p.code} ${p.design}`.toLowerCase().includes(q.toLowerCase()));
      if (sort === 'price-asc') list = list.sort((a, b) => a.price - b.price);
      else if (sort === 'price-desc') list = list.sort((a, b) => b.price - a.price);
      else list = list.sort((a, b) => a.design.localeCompare(b.design, undefined, { numeric: true }));
      $('#count', app).textContent = `${list.length} of ${list0.length} boxes`;
      $('#grid', app).innerHTML = list.length ? list.map(productCard).join('') : `<div class="empty" style="grid-column:1/-1"><h3>No box matches</h3><p>Try a different code.</p></div>`;
    };
    $('#q', app).addEventListener('input', e => { q = e.target.value.trim(); draw(); });
    $('#sort', app).addEventListener('change', e => { sort = e.target.value; draw(); });
    draw();
  }
  return { html, title: `${label} boxes`, mount };
}
