import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { db, ROOT, allSettings, getSetting, setSetting, ensureAdmin, SqliteStore, DEFAULT_SETTINGS } from './lib/db.js';
import { priceCart, newOrderId, OrderError } from './lib/pricing.js';
import { linkLocalPhotos, cacheRemoteImages, applyBasePhotos } from './lib/images.js';
import { seedCatalogue } from './seed.js';
import { normalizeProductPhotos } from './lib/normalize.js';

const CATALOGUE_VERSION = '2026-diwali-v4';
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(ROOT, 'public');
const app = express();

/* ---------- first-run setup ---------- */
if (!db.prepare('SELECT COUNT(*) n FROM products').get().n) {
  const r = seedCatalogue();
  console.log(`First run: loaded ${r.products} gift boxes and ${r.fillings} fillings.`);
}
if (getSetting('catalogueVersion', '') !== CATALOGUE_VERSION) {
  const r = seedCatalogue({ refreshPrices: true });
  setSetting('catalogueVersion', CATALOGUE_VERSION);
  console.log(`Catalogue updated to ${CATALOGUE_VERSION}: ${r.products} boxes, ${r.fillings} fillings (filling rates and box prices refreshed from data/*.json).`);
}
const admin = ensureAdmin();
if (process.env.NODE_ENV === 'production' && (admin.usingDefaultPassword || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 24)) {
  console.error('\nRefusing to start in production: set ADMIN_PASSWORD and a long random SESSION_SECRET (24+ characters) in .env first.\n');
  process.exit(1);
}
linkLocalPhotos();
applyBasePhotos();

/* ---------- middleware ---------- */
app.disable('x-powered-by');
if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== '0') app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:', 'https://drive.google.com', 'https://*.googleusercontent.com'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"]
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '1mb' }));

const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
  name: 'sc.sid',
  secret: sessionSecret,
  store: new SqliteStore(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 3600 * 1000 }
}));

/* tiny in-memory rate limiter */
const hits = new Map();
const limit = (name, max, windowMs) => (req, res, next) => {
  const key = `${name}:${req.ip}`, now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
  arr.push(now); hits.set(key, arr); next();
};
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

app.use('/assets', express.static(path.join(PUBLIC, 'assets'), { maxAge: '7d' }));
app.use('/fonts', express.static(path.join(PUBLIC, 'fonts'), { maxAge: '365d', immutable: true }));
app.use('/uploads', express.static(path.join(PUBLIC, 'uploads'), { maxAge: '1d' }));
app.use(express.static(PUBLIC, { index: false, extensions: ['html'], maxAge: 0 }));

/* ---------- helpers ---------- */
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const auth = (req, res, next) => (req.session.adminId ? next() : res.status(401).json({ error: 'Please sign in.' }));

const publicProduct = p => ({
  id: p.id, code: p.code, name: p.name, category: p.category, design: p.design, size: p.size, weight: p.weight,
  capacityGrams: p.capacity_grams, compartments: p.compartments, price: p.selling_price, image: p.image || '',
  inStock: !p.track_stock || p.stock > 0, stockLeft: p.track_stock ? p.stock : null
});
const adminProduct = p => ({
  ...publicProduct(p), purchasePrice: p.purchase_price, stock: p.stock, trackStock: !!p.track_stock,
  active: !!p.active, category: p.category
});
const publicFilling = f => ({ id: f.id, name: f.name, group: f.grp, ratePerKg: f.rate_per_kg, image: f.image || '' });
const adminFilling = f => ({ ...publicFilling(f), active: !!f.active });

function paymentInfo() {
  const s = allSettings();
  return {
    gpayName: s.gpayName, gpayNumber: s.gpayNumber, upiId: s.upiId, qrImage: s.qrImage, qrUpiId: s.qrUpiId,
    bankName: s.bankName, accountName: s.accountName, accountNumber: s.accountNumber, ifsc: s.ifsc
  };
}
function storeInfo() {
  const s = allSettings();
  return { name: s.storeName, tagline: s.tagline, phone1: s.phone1, phone2: s.phone2, email: s.storeEmail, codEnabled: s.codEnabled === 'true' };
}

/* ---------- public API ---------- */
app.get('/api/store', (req, res) => {
  res.json({
    store: storeInfo(),
    payment: paymentInfo(),
    products: db.prepare('SELECT * FROM products WHERE active=1 AND length(image) > 0 ORDER BY (size IS NULL), design, id').all().map(publicProduct),
    fillings: db.prepare('SELECT * FROM fillings WHERE active=1 ORDER BY grp, name').all().map(publicFilling)
  });
});

function orderView(o) {
  return {
    id: o.id, createdAt: o.created_at, status: o.status, paymentStatus: o.payment_status, paymentMethod: o.payment_method,
    paymentRef: o.payment_ref, hasProof: !!o.payment_proof, total: o.total, subtotal: o.subtotal, shipping: o.shipping,
    customer: { name: o.customer_name, phone: o.phone, email: o.email, address: o.address, city: o.city, state: o.state, pin: o.pin },
    note: o.note, items: JSON.parse(o.items_json)
  };
}

app.post('/api/orders', limit('order', 20, 3600e3), (req, res) => {
  try {
    const c = req.body?.customer || {};
    const customer = {
      name: String(c.name || '').trim().slice(0, 120), phone: String(c.phone || '').replace(/[^\d+]/g, '').slice(0, 15),
      email: String(c.email || '').trim().slice(0, 160), address: String(c.address || '').trim().slice(0, 400),
      city: String(c.city || '').trim().slice(0, 80), state: String(c.state || '').trim().slice(0, 80), pin: String(c.pin || '').trim()
    };
    if (!customer.name || !customer.address || !customer.city) throw new OrderError('Please enter your name, delivery address and city.');
    const mobile = customer.phone.replace(/^\+?91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(mobile)) throw new OrderError('Please enter a valid 10-digit mobile number.');
    customer.phone = mobile;
    if (!/^\d{6}$/.test(customer.pin)) throw new OrderError('Please enter a valid 6-digit PIN code.');
    if (customer.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) throw new OrderError('That email address does not look right.');
    const method = String(req.body?.paymentMethod || 'UPI');
    const allowed = ['UPI', 'BANK'].concat(allSettings().codEnabled === 'true' ? ['COD'] : []);
    if (!allowed.includes(method)) throw new OrderError('Please choose a payment method.');
    const note = String(req.body?.note || '').trim().slice(0, 500);

    const priced = priceCart(req.body?.items);
    const id = newOrderId();
    const token = crypto.randomBytes(16).toString('hex');

    db.transaction(() => {
      db.prepare(`INSERT INTO orders(id,access_token,customer_name,phone,email,address,city,state,pin,note,items_json,subtotal,shipping,total,payment_method,payment_status,status)
                  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, token, customer.name, customer.phone, customer.email, customer.address, customer.city, customer.state, customer.pin, note,
          JSON.stringify(priced.lines), priced.subtotal, priced.shipping, priced.total, method, 'Pending', method === 'COD' ? 'New' : 'Awaiting payment');
      for (const l of priced.lines) {
        db.prepare('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price,configuration_json) VALUES(?,?,?,?,?,?)')
          .run(id, l.productId, l.name, l.quantity, l.unitPrice, JSON.stringify(l.fillings));
        db.prepare('UPDATE products SET stock=MAX(0,stock-?) WHERE id=? AND track_stock=1').run(l.quantity, l.productId);
      }
    })();
    res.json({ ok: true, orderId: id, token, total: priced.total });
  } catch (e) {
    if (e instanceof OrderError) return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Something went wrong while placing your order. Please try again or call us.' });
  }
});

function loadOrder(req) {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(String(req.params.id));
  const t = String(req.query.t || req.body?.token || '');
  if (!o || !o.access_token || t.length !== o.access_token.length ||
    !crypto.timingSafeEqual(Buffer.from(t), Buffer.from(o.access_token))) return null;
  return o;
}
app.get('/api/orders/:id', limit('orderview', 60, 600e3), (req, res) => {
  const o = loadOrder(req);
  if (!o) return res.status(404).json({ error: 'We could not find that order. Please check your link or call us.' });
  res.json({ order: orderView(o), payment: paymentInfo(), store: storeInfo() });
});
/* Payment proof (screenshot / receipt) — stored OUTSIDE the public folder; only the admin can open it. */
const PROOF_DIR = path.join(ROOT, 'data', 'payment-proofs');
fs.mkdirSync(PROOF_DIR, { recursive: true });
const PROOF_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' };
const proofUpload = multer({
  storage: multer.diskStorage({
    destination: PROOF_DIR,
    filename: (req, file, cb) => cb(null, `${String(req.params.id).replace(/[^A-Za-z0-9-]/g, '')}-${Date.now().toString(36)}${PROOF_EXT[file.mimetype] || '.bin'}`)
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, !!PROOF_EXT[file.mimetype])
}).single('proof');
/* Check the real file contents, not just the type the browser claims. */
function looksLikeProof(file) {
  const b = Buffer.alloc(12); const fd = fs.openSync(file, 'r'); fs.readSync(fd, b, 0, 12, 0); fs.closeSync(fd);
  const hex = b.toString('hex');
  return hex.startsWith('ffd8ff') || hex.startsWith('89504e47') || b.toString('latin1', 0, 4) === '%PDF' ||
    (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP');
}
app.post('/api/orders/:id/payment', limit('payref', 20, 600e3), (req, res) => {
  proofUpload(req, res, err => {
    const discard = () => { if (req.file) fs.rm(req.file.path, () => {}); };
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large. Please upload a screenshot under 6 MB.' : 'Could not read the uploaded file.' });
    const o = loadOrder(req);
    if (!o) { discard(); return res.status(404).json({ error: 'Order not found.' }); }
    if (o.status === 'Cancelled') { discard(); return res.status(400).json({ error: 'This order has been cancelled.' }); }
    if (o.payment_status === 'Verified') { discard(); return res.status(400).json({ error: 'Payment for this order is already confirmed.' }); }
    const ref = String(req.body?.reference || '').trim().slice(0, 60);
    if (ref && ref.length < 6) { discard(); return res.status(400).json({ error: 'The UTR / transaction ID should be at least 6 characters.' }); }
    if (req.file && !looksLikeProof(req.file.path)) { discard(); return res.status(400).json({ error: 'Please upload a JPG, PNG, WEBP image or a PDF receipt.' }); }
    if (!ref && !req.file) return res.status(400).json({ error: 'Please enter the UTR / transaction ID or upload your payment screenshot.' });
    if (req.file && o.payment_proof) fs.rm(path.join(PROOF_DIR, path.basename(o.payment_proof)), () => {});
    db.prepare("UPDATE orders SET payment_ref=?, payment_proof=?, payment_status='Reported', payment_reported_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(ref || o.payment_ref, req.file ? req.file.filename : o.payment_proof, o.id);
    res.json({ ok: true });
  });
});

/* ---------- admin API ---------- */
app.post('/api/admin/login', limit('login', 8, 15 * 60e3), (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const a = db.prepare('SELECT * FROM admins WHERE email=?').get(email);
  if (!a || !bcrypt.compareSync(String(req.body?.password || ''), a.password_hash))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Could not start a session.' });
    req.session.adminId = a.id;
    res.json({ ok: true, email: a.email });
  });
});
app.post('/api/admin/logout', auth, (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/admin/me', (req, res) => res.json({ authenticated: !!req.session.adminId, defaultPassword: admin.usingDefaultPassword && !!req.session.adminId }));

app.get('/api/admin/products', auth, (req, res) => res.json(db.prepare('SELECT * FROM products ORDER BY active DESC, design, id').all().map(adminProduct)));
app.post('/api/admin/products', auth, (req, res) => {
  const b = req.body || {};
  const code = String(b.code || b.name || '').trim();
  const id = slug(b.id || code);
  if (!id || !code) return res.status(400).json({ error: 'A box code is required.' });
  if (db.prepare('SELECT 1 FROM products WHERE id=?').get(id)) return res.status(400).json({ error: 'A box with this code already exists.' });
  const weight = String(b.weight || '');
  db.prepare(`INSERT INTO products(id,code,name,category,purchase_price,selling_price,weight,capacity_grams,design,size,compartments,stock,track_stock,image,active)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`)
    .run(id, code, String(b.name || code), 'Gift boxes', Math.max(0, num(b.purchasePrice)), Math.max(0, num(b.price)), weight,
      Math.max(0, Math.floor(num(b.capacityGrams, parseInt(weight) || 0))), String(b.design || code), String(b.size || ''),
      Math.max(1, Math.min(12, Math.floor(num(b.compartments, 4)))), Math.max(0, Math.floor(num(b.stock))), b.trackStock ? 1 : 0, '');
  res.json({ ok: true, id });
});
app.patch('/api/admin/products/:id', auth, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Box not found.' });
  const b = req.body || {};
  db.prepare(`UPDATE products SET name=?,code=?,selling_price=?,purchase_price=?,capacity_grams=?,compartments=?,stock=?,track_stock=?,active=?,image=? WHERE id=?`)
    .run(String(b.name ?? p.name), String(b.code ?? p.code), Math.max(0, num(b.price, p.selling_price)), Math.max(0, num(b.purchasePrice, p.purchase_price)),
      Math.max(0, Math.floor(num(b.capacityGrams, p.capacity_grams))), Math.max(1, Math.min(12, Math.floor(num(b.compartments, p.compartments)))),
      Math.max(0, Math.floor(num(b.stock, p.stock))), b.trackStock === undefined ? p.track_stock : (b.trackStock ? 1 : 0),
      b.active === undefined ? p.active : (b.active ? 1 : 0), String(b.image ?? p.image ?? ''), p.id);
  res.json({ ok: true });
});
app.delete('/api/admin/products/:id', auth, (req, res) => { db.prepare('UPDATE products SET active=0 WHERE id=?').run(req.params.id); res.json({ ok: true }); });

app.get('/api/admin/fillings', auth, (req, res) => res.json(db.prepare('SELECT * FROM fillings ORDER BY active DESC, grp, name').all().map(adminFilling)));
app.post('/api/admin/fillings', auth, (req, res) => {
  const b = req.body || {}; const id = slug(b.name);
  if (!id) return res.status(400).json({ error: 'A filling name is required.' });
  if (db.prepare('SELECT 1 FROM fillings WHERE id=?').get(id)) return res.status(400).json({ error: 'This filling already exists.' });
  db.prepare('INSERT INTO fillings(id,name,grp,rate_per_kg,image,active) VALUES(?,?,?,?,?,1)')
    .run(id, String(b.name).trim(), String(b.group || 'Specialities'), Math.max(0, num(b.ratePerKg)), '');
  res.json({ ok: true, id });
});
app.patch('/api/admin/fillings/:id', auth, (req, res) => {
  const f = db.prepare('SELECT * FROM fillings WHERE id=?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Filling not found.' });
  const b = req.body || {};
  db.prepare('UPDATE fillings SET name=?,grp=?,rate_per_kg=?,active=?,image=? WHERE id=?')
    .run(String(b.name ?? f.name), String(b.group ?? f.grp), Math.max(0, num(b.ratePerKg, f.rate_per_kg)),
      b.active === undefined ? f.active : (b.active ? 1 : 0), String(b.image ?? f.image ?? ''), f.id);
  res.json({ ok: true });
});
app.delete('/api/admin/fillings/:id', auth, (req, res) => { db.prepare('UPDATE fillings SET active=0 WHERE id=?').run(req.params.id); res.json({ ok: true }); });

/* image uploads — extension comes from the verified MIME type, never from the client's file name */
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(PUBLIC, 'uploads', req.params.kind === 'filling' ? 'fillings' : req.params.kind === 'qr' ? 'payment' : 'products');
      fs.mkdirSync(dir, { recursive: true }); cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${slug(req.params.id) || 'qr'}-${Date.now().toString(36)}${EXT[file.mimetype]}`)
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, !!EXT[file.mimetype])
});
app.post('/api/admin/upload/:kind/:id', auth, (req, res, next) => {
  if (!['product', 'filling', 'qr'].includes(req.params.kind)) return res.status(400).json({ error: 'Unknown upload type.' });
  next();
}, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please choose a JPG, PNG or WEBP image under 8 MB.' });
  const folder = req.params.kind === 'filling' ? 'fillings' : req.params.kind === 'qr' ? 'payment' : 'products';
  const url = `/uploads/${folder}/${req.file.filename}`;
  if (req.params.kind === 'product') {
    db.prepare('UPDATE products SET image=? WHERE id=?').run(url, req.params.id);
    await normalizeProductPhotos({ log: console.error }); // same size, background and centring as every other box
    return res.json({ ok: true, url: db.prepare('SELECT image FROM products WHERE id=?').get(req.params.id)?.image || url });
  }
  else if (req.params.kind === 'filling') db.prepare('UPDATE fillings SET image=? WHERE id=?').run(url, req.params.id);
  else setSetting('qrImage', url);
  res.json({ ok: true, url });
});

app.get('/api/admin/orders', auth, (req, res) =>
  res.json(db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500').all().map(o => ({ ...orderView(o), adminNote: o.admin_note, paymentReportedAt: o.payment_reported_at, proofFile: o.payment_proof ? path.extname(o.payment_proof).slice(1) : '' }))));
app.get('/api/admin/orders/:id/proof', auth, (req, res) => {
  const o = db.prepare('SELECT payment_proof FROM orders WHERE id=?').get(req.params.id);
  if (!o?.payment_proof) return res.status(404).type('text/plain').send('No payment proof uploaded for this order.');
  const file = path.join(PROOF_DIR, path.basename(o.payment_proof));
  if (!fs.existsSync(file)) return res.status(404).type('text/plain').send('File missing.');
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'", 'Cache-Control': 'private, no-store' });
  res.sendFile(file);
});
app.patch('/api/admin/orders/:id', auth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  const statuses = ['Awaiting payment', 'New', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
  const pays = ['Pending', 'Reported', 'Verified', 'Failed'];
  const b = req.body || {};
  if (b.status !== undefined && !statuses.includes(b.status)) return res.status(400).json({ error: 'Invalid order status.' });
  if (b.paymentStatus !== undefined && !pays.includes(b.paymentStatus)) return res.status(400).json({ error: 'Invalid payment status.' });
  const status = b.status ?? o.status, pay = b.paymentStatus ?? o.payment_status;
  db.transaction(() => {
    // Marking a payment verified moves an unpaid order forward automatically.
    const finalStatus = (b.paymentStatus === 'Verified' && b.status === undefined && o.status === 'Awaiting payment') ? 'Confirmed' : status;
    db.prepare('UPDATE orders SET status=?, payment_status=?, admin_note=? WHERE id=?').run(finalStatus, pay, String(b.adminNote ?? o.admin_note ?? '').slice(0, 1000), o.id);
    // Return stock when an order is cancelled (and take it back if it is reopened).
    if (finalStatus !== o.status && (finalStatus === 'Cancelled' || o.status === 'Cancelled')) {
      const sign = finalStatus === 'Cancelled' ? 1 : -1;
      for (const l of JSON.parse(o.items_json)) db.prepare('UPDATE products SET stock=MAX(0,stock+?) WHERE id=? AND track_stock=1').run(sign * l.quantity, l.productId);
    }
  })();
  res.json({ ok: true });
});

app.get('/api/admin/settings', auth, (req, res) => res.json(allSettings()));
app.patch('/api/admin/settings', auth, (req, res) => {
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (k === 'qrImage' || req.body?.[k] === undefined) continue;
    setSetting(k, String(req.body[k]).trim().slice(0, 200));
  }
  res.json({ ok: true });
});
app.post('/api/admin/password', auth, limit('pw', 10, 3600e3), (req, res) => {
  const { current, next } = req.body || {};
  const a = db.prepare('SELECT * FROM admins WHERE id=?').get(req.session.adminId);
  if (!bcrypt.compareSync(String(current || ''), a.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (String(next || '').length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters.' });
  db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(String(next), 12), a.id);
  res.json({ ok: true });
});
app.post('/api/admin/cache-images', auth, async (req, res) => {
  const r = await cacheRemoteImages({});
  res.json({ ok: true, ...r });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

/* ---------- pages ---------- */
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(PUBLIC, 'admin', 'index.html')));
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).type('text/plain').send('Not found');
  res.sendFile(path.join(PUBLIC, 'index.html'));
});
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.status === 413 ? 'That upload is too large.' : 'Something went wrong.' });
});

normalizeProductPhotos({ log: console.error }).then(r => r.done && console.log(`  Box photos standardised: ${r.done}`)).catch(() => {});
app.listen(PORT, () => {
  console.log(`\n  Sri Company store running at http://localhost:${PORT}`);
  console.log(`  Admin panel:               http://localhost:${PORT}/admin`);
  if (admin.usingDefaultPassword) console.log('\n  ! Using the default admin password. Set ADMIN_PASSWORD in .env before going live.');
  if (!process.env.SESSION_SECRET) console.log('  ! SESSION_SECRET is not set — set it in .env.');
  if (process.env.AUTO_CACHE_IMAGES !== 'false' && db.prepare("SELECT COUNT(*) n FROM products WHERE image LIKE 'http%'").get().n) {
    cacheRemoteImages({ log: () => {} }).then(r => r.total && console.log(`  Box photos cached locally: ${r.done}/${r.total}${r.failed ? ` (${r.failed} still loading from Drive)` : ''}`)).catch(() => {});
  }
});
