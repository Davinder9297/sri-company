import { $, esc, money, icon } from '../util.js';
import { state } from '../state.js';
import { fillingPhoto } from '../ui.js';

export default async function fillings() {
  const groups = ['All', ...new Set(state.fillings.map(f => f.group))];
  const html = `
  <section class="page-head"><div class="wrap"><div class="crumbs"><a href="/" data-link>Home</a><span>/</span>Fillings &amp; rates</div><h1 style="font-size:clamp(2.2rem,4vw,3.2rem)">Fillings &amp; rates</h1><p>Every filling is priced per kg. In the box builder you choose the weight for each compartment and pay only for that quantity. Rates are in Indian rupees.</p></div></section>
  <div class="wrap" style="padding-top:32px;padding-bottom:84px">
    <div class="toolbar"><div class="search">${icon('search')}<input id="fq" type="search" placeholder="Search fillings" aria-label="Search fillings"></div><div class="chips" id="chips"></div></div>
    <div class="tbl-wrap"><table class="rate-table"><thead><tr><th>Filling</th><th>Type</th><th>Per 100 g</th><th>Per kg</th></tr></thead><tbody id="rows"></tbody></table></div>
    <p class="muted" style="margin-top:16px;font-size:.88rem">Prices of fillings may change with market rates. The price shown while you build your box is the price used for your order.</p>
    <div style="margin-top:28px"><a class="btn btn-primary" href="/shop" data-link>Choose a box and start filling</a></div>
  </div>`;
  function mount(app) {
    let group = 'All', term = '';
    const draw = () => {
      $('#chips', app).innerHTML = groups.map(g => `<button class="chip${g === group ? ' on' : ''}" type="button" data-g="${esc(g)}">${esc(g)}</button>`).join('');
      const q = term.toLowerCase();
      const list = state.fillings.filter(f => (group === 'All' || f.group === group) && (!q || f.name.toLowerCase().includes(q)));
      $('#rows', app).innerHTML = list.length ? list.map(f => `<tr><td><span class="thumb">${fillingPhoto(f)}</span><b>${esc(f.name)}</b></td><td>${esc(f.group)}</td><td>${money(f.ratePerKg / 10)}</td><td><b>${money(f.ratePerKg)}</b></td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--muted)">No fillings found.</td></tr>';
    };
    $('#fq', app).addEventListener('input', e => { term = e.target.value.trim(); draw(); });
    $('#chips', app).addEventListener('click', e => { const c = e.target.closest('[data-g]'); if (c) { group = c.dataset.g; draw(); } });
    draw();
  }
  return { html, title: 'Fillings & rates', mount };
}
