import { esc, money, sizeLabel, icon, tel, wa } from '../util.js';
import { state } from '../state.js';
import { boxPhoto, fillingPhoto, productCard, sizeGroups, categoryTile } from '../ui.js';

export default async function home() {
  const { products, fillings, payment } = state;
  const groups = sizeGroups(products);
  const sizes = [...groups.keys()];
  const minPrice = Math.min(...products.map(p => p.price).filter(p => p > 0));

  const pick = (size, i = 0) => (groups.get(size) || products)[i] || products[0];
  const withPhoto = (size, i = 0) => { const g = groups.get(size) || products; return g.find(p => p.image) || g[i] || products[0]; };
  const hero = [withPhoto('12x12'), withPhoto('8x8'), withPhoto('10x15')].filter(Boolean);
  const tile = (p, cls) => p ? `<a class="tile ${cls}" href="/box/${esc(p.id)}" data-link>${boxPhoto(p, { loading: 'eager' })}<span class="tag">${esc(p.design)} · ${esc(sizeLabel(p.size))}</span></a>` : '';

  // featured: round-robin across sizes so the first row shows variety
  const featured = []; const lists = sizes.map(s => groups.get(s));
  for (let i = 0; featured.length < 8 && i < 4; i++) for (const l of lists) if (l[i] && featured.length < 8) featured.push(l[i]);

  const featFillIds = ['kaju', 'badam', 'mamra-badam', 'flavoured-pista', 'anjeer', 'akrot-magaz', 'cranberry', 'dates-pastry'];
  const featFill = featFillIds.map(id => state.fById[id]).filter(Boolean);

  const html = `
  <section class="hero"><div class="wrap">
    <div>
      <div class="eyebrow light">Festive &amp; corporate gifting</div>
      <h1>Personalised dry-fruit gift boxes, <em>filled your way.</em></h1>
      <p class="lead">Pick one of ${products.length} box designs, choose a filling for every compartment and set the weight. The price updates as you build — no surprises at checkout.</p>
      <div class="actions"><a class="btn btn-accent" href="/shop" data-link>Shop gift boxes</a><a class="btn btn-outline-light" href="/#how" data-link>How it works</a></div>
      <div class="hero-meta">
        <div><b>${products.length}</b><span>Box designs</span></div>
        <div><b>${fillings.length}</b><span>Fillings to choose</span></div>
        <div><b>${sizes.length}</b><span>Box sizes</span></div>
      </div>
    </div>
    <div class="mosaic">${tile(hero[0], 'm1')}${tile(hero[1], 'm2')}${tile(hero[2], 'm3')}</div>
  </div></section>

  <section class="strip"><div class="wrap">
    <div class="item"><span class="ic">${icon('box')}</span><div><b>Choose your own box</b><small>${products.length} designs in ${sizes.length} sizes</small></div></div>
    <div class="item"><span class="ic">${icon('scale')}</span><div><b>Set every weight</b><small>Fillings by the gram, in 25 g steps</small></div></div>
    <div class="item"><span class="ic">${icon('rupee')}</span><div><b>Live price</b><small>Box + fillings, calculated as you build</small></div></div>
    <div class="item"><span class="ic">${icon('wallet')}</span><div><b>UPI &amp; bank transfer</b><small>Google Pay, UPI ID or NEFT/IMPS</small></div></div>
  </div></section>

  <section class="section" id="sizes"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Shop by size</div><h2>Find the right box</h2><p>Each size has its own capacity and compartment layout. Boxes start from ${money(minPrice)}; fillings are added on top.</p></div></div>
    <div class="grid grid-3">${sizes.map(s => categoryTile(s, groups.get(s))).join('')}</div>
  </div></section>

  <section class="section tint"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Gift boxes</div><h2>Popular designs</h2><p>Open any box to choose what goes into each compartment.</p></div><a class="btn btn-outline" href="/shop" data-link>Browse the full collection</a></div>
    <div class="grid grid-4">${featured.map(productCard).join('')}</div>
  </div></section>

  <section class="section" id="how"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">How it works</div><h2>Four simple steps</h2></div></div>
    <div class="steps">
      <div class="step"><div class="n">1</div><h3>Choose a box</h3><p>Pick a size and design. Each box shows its capacity and how many compartments it has.</p></div>
      <div class="step"><div class="n">2</div><h3>Fill every compartment</h3><p>Choose from ${fillings.length} dry fruits and savoury or sweet mixes, and set the weight for each one.</p></div>
      <div class="step"><div class="n">3</div><h3>Place your order</h3><p>Add your delivery details. You will get an order number and the payment details straight away.</p></div>
      <div class="step"><div class="n">4</div><h3>Pay &amp; confirm</h3><p>Pay by Google Pay, UPI or bank transfer, then share the transaction ID. We confirm your order once payment is received.</p></div>
    </div>
  </div></section>

  <section class="section tint"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Fillings</div><h2>${fillings.length} fillings to choose from</h2><p>Dry fruits, flavoured nuts, berries and bites. You choose the weight for each compartment.</p></div><a class="btn btn-outline" href="/our-range" data-link>See our range</a></div>
    <div class="fill-grid">${featFill.map(f => `<div class="fcard"><div class="thumb">${fillingPhoto(f)}</div><div class="t"><b>${esc(f.name)}</b><small>${esc(f.group)}</small></div></div>`).join('')}</div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section-head"><div><div class="eyebrow">Ordering &amp; payment</div><h2>Simple, direct payment</h2><p>No card forms and no third-party checkout. Pay straight to Sri Company.</p></div><a class="btn btn-outline" href="/payment" data-link>View payment details</a></div>
    <div class="pay-grid">
      <div class="pay-card"><div class="ic">${icon('phoneup')}</div><h3>Google Pay / UPI</h3><p>Scan the Google Pay QR code or pay to our UPI ID using any UPI app — Google Pay, PhonePe, Paytm or BHIM.</p></div>
      <div class="pay-card"><div class="ic">${icon('bank')}</div><h3>Bank transfer</h3><p>Pay by NEFT, IMPS or RTGS to our ${esc(payment.bankName.split(',')[0])} account. Full account details are shown after you order.</p></div>
      <div class="pay-card"><div class="ic">${icon('shield')}</div><h3>Confirmation</h3><p>Share your UTR / transaction ID on the order page or on WhatsApp. Our team verifies the payment and confirms your order.</p></div>
    </div>
  </div></section>

  <section class="cta-band"><div class="wrap">
    <div><h2>Need help choosing a box?</h2><p>Call or message us on WhatsApp. We will help you pick the right size and fillings for your occasion.</p></div>
    <div class="cta-actions"><a class="btn btn-accent" href="${tel(state.store.phone1)}">Call ${esc(state.store.phone1)}</a><a class="btn btn-wa" target="_blank" rel="noopener" href="${wa(state.store.phone1, 'Hello Sri Company, I need help choosing a gift box.')}">${icon('whatsapp')} WhatsApp</a></div>
  </div></section>`;
  return { html };
}
