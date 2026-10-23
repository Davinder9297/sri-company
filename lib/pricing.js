import crypto from 'node:crypto';
import { db } from './db.js';

export const GRAM_STEP = 25;
const r2 = n => Math.round(n * 100) / 100;

export class OrderError extends Error {}

/**
 * Validates a cart sent by the browser and re-prices it from the database.
 * The browser's prices are never trusted: only product ids, filling ids and grams are read.
 */
export function priceCart(items) {
  if (!Array.isArray(items) || !items.length) throw new OrderError('Your bag is empty.');
  if (items.length > 30) throw new OrderError('Too many items in one order. Please split it into two orders.');

  const productStmt = db.prepare('SELECT * FROM products WHERE id=? AND active=1');
  const fillingStmt = db.prepare('SELECT * FROM fillings WHERE id=? AND active=1');
  const wanted = new Map(); // product id -> total quantity (for stock checks)
  const lines = [];
  let subtotal = 0;

  for (const item of items) {
    const p = productStmt.get(String(item?.productId || ''));
    if (!p) throw new OrderError('One of the boxes in your bag is no longer available. Please remove it and try again.');
    const quantity = Math.floor(Number(item.quantity));
    if (!(quantity >= 1 && quantity <= 99)) throw new OrderError('Quantity must be between 1 and 99.');
    if (!(p.selling_price > 0)) throw new OrderError(`The price for ${p.name} is not available yet. Please call us to order this box.`);

    const picks = Array.isArray(item.fillings) ? item.fillings : [];
    if (picks.length !== p.compartments) throw new OrderError(`${p.name} has ${p.compartments} compartments — please choose a filling for each one.`);

    let grams = 0, fillCost = 0;
    const fillings = picks.map((pick, i) => {
      const f = fillingStmt.get(String(pick?.fillingId || ''));
      if (!f) throw new OrderError('One of the selected fillings is no longer available.');
      const g = Number(pick.grams);
      if (!Number.isInteger(g) || g < GRAM_STEP || g > 5000 || g % GRAM_STEP !== 0)
        throw new OrderError(`Weight for compartment ${i + 1} must be in steps of ${GRAM_STEP} g.`);
      grams += g;
      const amount = r2((f.rate_per_kg * g) / 1000);
      fillCost += amount;
      return { compartment: i + 1, fillingId: f.id, name: f.name, grams: g, ratePerKg: f.rate_per_kg, amount };
    });
    if (p.capacity_grams > 0 && grams > p.capacity_grams)
      throw new OrderError(`${p.name} holds up to ${p.capacity_grams} g, but ${grams} g was selected.`);

    const unitPrice = r2(p.selling_price + fillCost);
    const lineTotal = r2(unitPrice * quantity);
    subtotal = r2(subtotal + lineTotal);
    wanted.set(p.id, (wanted.get(p.id) || 0) + quantity);
    lines.push({
      productId: p.id, code: p.code, name: p.name, size: p.size, image: p.image,
      quantity, boxPrice: p.selling_price, fillingsPrice: r2(fillCost), totalGrams: grams, unitPrice, lineTotal, fillings
    });
  }

  for (const [id, qty] of wanted) {
    const p = productStmt.get(id);
    if (p.track_stock && qty > p.stock)
      throw new OrderError(p.stock > 0 ? `Only ${p.stock} of ${p.name} are in stock.` : `${p.name} is currently out of stock.`);
  }
  return { lines, subtotal, shipping: 0, total: r2(subtotal) };
}

export function newOrderId() {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SC-${ymd}-${rand}`;
}
