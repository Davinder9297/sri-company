import { esc, icon, tel, wa } from '../util.js';
import { state } from '../state.js';
import { upiBox, bankBox } from './paymentui.js';

const head = (title, lead, crumb) => `<section class="page-head"><div class="wrap"><div class="crumbs"><a href="/" data-link>Home</a><span>/</span>${esc(crumb || title)}</div><h1 style="font-size:clamp(2.2rem,4vw,3.2rem)">${esc(title)}</h1>${lead ? `<p>${lead}</p>` : ''}</div></section>`;

export async function payment() {
  const pay = state.payment;
  return { title: 'Payment details', html: `${head('Payment details', 'We accept payment directly to Sri Company by Google Pay / UPI or bank transfer. There is no card checkout. Place your order first — you will then see the exact amount to pay.')}
  <div class="wrap" style="padding-top:36px;padding-bottom:84px">
    <div class="pay-cols">${upiBox(pay)}${bankBox(pay)}</div>
    <div class="notice">${icon('info')}<span>Always use the order number as the payment note or remark. After paying, enter the UTR / transaction ID on your order page, or send a screenshot to us on WhatsApp.</span></div>
    <div style="margin-top:28px"><a class="btn btn-primary" href="/shop" data-link>Choose a gift box</a></div>
  </div>` };
}

const FAQ = [
  ['How is the price calculated?', 'Your price is the box price plus the cost of each filling. Every filling has a rate per kg; you pay only for the grams you choose for each compartment. The total updates live as you build, and our server re-checks it when you place the order.'],
  ['Can I choose different fillings for each compartment?', 'Yes. Every compartment can hold a different filling, and you set the weight for each one in 25 g steps, up to the capacity of the box.'],
  ['How do I pay?', 'Pay by Google Pay / UPI (scan our QR code or use our UPI ID) or by bank transfer (NEFT, IMPS or RTGS). The full details appear on your order page right after you place the order, and on the Payment details page.'],
  ['When is my order confirmed?', 'Your order is confirmed once we have received and verified your payment. Enter your UTR / transaction ID on your order page, or send us a screenshot on WhatsApp, so we can match it quickly.'],
  ['What about delivery charges and delivery time?', 'These depend on your location and the quantity ordered. Our team will confirm them with you by phone or WhatsApp after you place your order.'],
  ['Can I order in bulk or for corporate gifting?', 'Yes. Call or WhatsApp us with the box sizes, fillings and quantities you need and we will help you place the order.'],
  ['Can I change my order after placing it?', 'Please contact us as soon as possible on +91 98490 14152 or +91 99899 07808 with your order number and we will do our best to help.']
];
export async function faq() {
  return { title: 'FAQs', html: `${head('Frequently asked questions', '', 'FAQs')}<div class="wrap" style="padding-top:28px;padding-bottom:84px"><div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div></div>` };
}

export async function contact() {
  const s = state.store;
  const card = (label, num) => `<div class="contact-card"><span class="eyebrow">${label}</span><a class="big" href="${tel(num)}">${esc(num)}</a><div style="display:flex;gap:.7rem;flex-wrap:wrap"><a class="btn btn-primary" href="${tel(num)}">${icon('phone')} Call now</a><a class="btn btn-wa" target="_blank" rel="noopener" href="${wa(num, 'Hello Sri Company, I would like to know more about your gift boxes.')}">${icon('whatsapp')} WhatsApp</a></div></div>`;
  return { title: 'Contact', html: `${head('Contact us', 'Questions about boxes, fillings, bulk orders or an existing order? Call or message us.')}
  <div class="wrap" style="padding-top:36px;padding-bottom:84px"><div class="contact-cards">${card('Phone & WhatsApp', s.phone1)}${card('Phone & WhatsApp', s.phone2)}</div>
  ${s.email ? `<p style="margin-top:28px">Email: <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>` : ''}</div>` };
}

export async function notFound() {
  return { title: 'Page not found', html: `<div class="wrap"><div class="empty" style="margin:72px 0"><h2 style="margin-bottom:.6rem">We could not find that page</h2><p>The box or page you are looking for may have moved.</p><a class="btn btn-primary" href="/shop" data-link>Browse gift boxes</a></div></div>` };
}
