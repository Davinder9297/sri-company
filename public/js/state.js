import { api } from './util.js';

export const state = { store: null, payment: null, products: [], fillings: [], pById: {}, fById: {}, cart: [] };
const KEY = 'sc_cart_v2';
export const GRAM_STEP = 25;
const listeners = new Set();
export const onCart = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => fn());

export async function load() {
  const d = await api('/api/store');
  state.store = d.store;
  state.payment = d.payment;
  // largest-area boxes last; within a size keep design order
  state.products = d.products.slice().sort((a, b) => (a.category === 'Special boxes') - (b.category === 'Special boxes') || area(a.size) - area(b.size) || a.size.localeCompare(b.size) || a.design.localeCompare(b.design, undefined, { numeric: true }));
  state.fillings = d.fillings;
  state.pById = Object.fromEntries(state.products.map(p => [p.id, p]));
  state.fById = Object.fromEntries(state.fillings.map(f => [f.id, f]));
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    state.cart = saved.filter(i => state.pById[i.productId] && Array.isArray(i.fillings) && i.fillings.every(f => state.fById[f.fillingId]));
  } catch { state.cart = []; }
}

export const area = s => { s = String(s || ''); if (s.includes('+')) return s.split('+').reduce((t, n) => t + (Number(n) || 0), 0); const [a, b] = s.split('x').map(Number); return (a || 0) * (b || 0); };
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state.cart)); } catch {} emit(); }

export function cartAdd(item) {
  const key = item.key || Math.random().toString(36).slice(2, 10);
  const i = state.cart.findIndex(c => c.key === key);
  const entry = { key, productId: item.productId, quantity: item.quantity, fillings: item.fillings.map(f => ({ fillingId: f.fillingId, grams: f.grams })) };
  if (i >= 0) state.cart[i] = entry; else state.cart.push(entry);
  persist();
}
export function cartQty(key, qty) {
  const c = state.cart.find(x => x.key === key);
  if (c) { c.quantity = Math.max(1, Math.min(99, qty)); persist(); }
}
export function cartRemove(key) { state.cart = state.cart.filter(c => c.key !== key); persist(); }
export function cartClear() { state.cart = []; persist(); }
export const cartCount = () => state.cart.reduce((s, c) => s + c.quantity, 0);

const r2 = n => Math.round(n * 100) / 100;
/** Display-only pricing; the server always re-prices the order itself. */
export function calc(item) {
  const product = state.pById[item.productId];
  const lines = item.fillings.map(f => {
    const filling = state.fById[f.fillingId];
    return { filling, grams: f.grams, amount: filling && f.grams ? r2(filling.ratePerKg * f.grams / 1000) : 0 };
  });
  const fillTotal = r2(lines.reduce((s, l) => s + l.amount, 0));
  const unit = r2((product?.price || 0) + fillTotal);
  return { product, lines, boxPrice: product?.price || 0, fillTotal, unit, total: r2(unit * (item.quantity || 1)), totalGrams: item.fillings.reduce((s, f) => s + (f.grams || 0), 0) };
}
export const cartTotal = () => r2(state.cart.reduce((s, c) => s + calc(c).total, 0));
