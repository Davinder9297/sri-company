import { esc } from '../util.js';
import { state } from '../state.js';
import { fillingPhoto } from '../ui.js';

const BLURB = {
  'Regular': 'Classic dry fruits, plain and salted, packed fresh.',
  'Flavoured': 'Roasted and coated nuts and raisins in lively flavours.',
  'Berries & Seeds': 'Berries, mixes and seeds for a lighter, fruity bite.',
  'Bites & Chocolates': 'Sweet bites, pastries and treats to finish the box.'
};

/** "Our Range": one row per category, alternating photo left/right. No prices. */
export default async function ourRange() {
  const cats = [...new Set(state.fillings.map(f => f.group))];
  const rows = cats.map((g, i) => {
    const items = state.fillings.filter(f => f.group === g);
    const left = i % 2 === 0;
    const withPic = items.filter(f => f.image).slice(0, 4);
    const media = `<div class="rng-media${withPic.length < 2 ? ' one' : ''}">${withPic.length ? withPic.map(f => `<div class="rng-ph">${fillingPhoto(f)}</div>`).join('') : `<div class="rng-ph rng-empty"><b>${esc(g)}</b></div>`}</div>`;
    const text = `<div class="rng-text"><div class="eyebrow">${String(i + 1).padStart(2, '0')}</div><h2>${esc(g)}</h2><p>${esc(BLURB[g] || '')}</p>
      <ul class="rng-list">${items.map(f => `<li>${f.image ? `<span class="thumb">${fillingPhoto(f)}</span>` : '<span class="dot"></span>'}${esc(f.name)}</li>`).join('')}</ul></div>`;
    return `<section class="rng-row ${left ? 'photo-left' : 'photo-right'}"><div class="wrap rng-in">${left ? media + text : text + media}</div></section>`;
  }).join('');
  const html = `
  <section class="page-head"><div class="wrap"><div class="crumbs"><a href="/" data-link>Home</a><span>/</span>Our Range</div><h1 style="font-size:clamp(2.2rem,4vw,3.2rem)">Our Range</h1><p>Everything you can put into your gift box, grouped by type.</p></div></section>
  ${rows}
  <div class="wrap" style="padding:10px 0 84px"><a class="btn btn-primary" href="/shop" data-link>Choose a box and start filling</a></div>`;
  return { html, title: 'Our Range' };
}
