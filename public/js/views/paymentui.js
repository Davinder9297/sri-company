import { esc, money, icon } from '../util.js';

const kv = (label, value, { copy = true, raw = false } = {}) => `<div class="kv"><dt>${esc(label)}</dt><dd>${raw ? value : esc(value)}</dd>${copy ? `<button class="copy" type="button" data-copy="${esc(value)}" data-label="${esc(label)} copied">Copy</button>` : ''}</div>`;

export function upiBox(pay, { amount, orderId, chosen } = {}) {
  const deep = amount ? `upi://pay?pa=${encodeURIComponent(pay.upiId)}&pn=${encodeURIComponent(pay.gpayName)}&am=${Number(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(orderId || 'Gift box order')}` : '';
  return `<div class="pay-box"><h3>${icon('phoneup')} Google Pay / UPI ${chosen ? '<span class="pill">Your choice</span>' : ''}</h3>
    <div class="qr"><img src="${esc(pay.qrImage)}" alt="Google Pay QR code for ${esc(pay.gpayName)}" width="300"></div>
    <p class="muted" style="text-align:center;font-size:.88rem;margin-bottom:12px">Scan with Google Pay, PhonePe, Paytm or any UPI app</p>
    <dl class="kvs">${kv('Google Pay number', pay.gpayNumber)}${kv('UPI ID', pay.upiId)}${kv('Account name', pay.gpayName, { copy: false })}</dl>
    ${deep ? `<a class="btn btn-primary btn-block only-touch" style="margin-top:14px" href="${deep}">Pay ${money(amount)} in your UPI app</a>` : ''}
    ${amount ? `<div class="notice">${icon('info')}<span>Enter exactly <b>${money(amount)}</b> and add <b>${esc(orderId || '')}</b> as the payment note.</span></div>` : ''}</div>`;
}

export function bankBox(pay, { amount, orderId, chosen } = {}) {
  return `<div class="pay-box"><h3>${icon('bank')} Bank transfer ${chosen ? '<span class="pill">Your choice</span>' : ''}</h3>
    <dl class="kvs">${kv('Bank & branch', pay.bankName)}${kv('Account name', pay.accountName)}${kv('Account number', pay.accountNumber)}${kv('IFSC code', pay.ifsc)}</dl>
    <p class="muted" style="font-size:.9rem;margin:14px 0 0">Use NEFT, IMPS, RTGS or UPI bank transfer.</p>
    ${amount ? `<div class="notice">${icon('info')}<span>Transfer exactly <b>${money(amount)}</b> and quote <b>${esc(orderId || '')}</b> as the remark / reference.</span></div>` : ''}</div>`;
}
