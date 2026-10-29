import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'store.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins(
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(
  id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, category TEXT DEFAULT 'Gift boxes',
  purchase_price REAL DEFAULT 0, selling_price REAL DEFAULT 0, weight TEXT, capacity_grams INTEGER DEFAULT 0,
  design TEXT, size TEXT, compartments INTEGER DEFAULT 4, stock INTEGER DEFAULT 0, track_stock INTEGER DEFAULT 0,
  image TEXT DEFAULT '', source_image TEXT DEFAULT '', active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS fillings(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, grp TEXT DEFAULT 'Specialities', rate_per_kg REAL DEFAULT 0,
  image TEXT DEFAULT '', active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS orders(
  id TEXT PRIMARY KEY, access_token TEXT, customer_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
  address TEXT NOT NULL, city TEXT NOT NULL, state TEXT DEFAULT '', pin TEXT NOT NULL, note TEXT DEFAULT '',
  items_json TEXT NOT NULL, subtotal REAL NOT NULL, shipping REAL DEFAULT 0, total REAL NOT NULL,
  payment_method TEXT NOT NULL, payment_status TEXT DEFAULT 'Pending', payment_ref TEXT DEFAULT '',
  payment_reported_at TEXT, admin_note TEXT DEFAULT '', status TEXT DEFAULT 'Awaiting payment',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(
  id INTEGER PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT, product_name TEXT, quantity INTEGER, unit_price REAL, configuration_json TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires INTEGER NOT NULL);
`);

/* Lightweight migrations so a database created by an older version keeps working. */
function addColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
addColumn('products', 'capacity_grams', 'INTEGER DEFAULT 0');
addColumn('products', 'track_stock', 'INTEGER DEFAULT 0');
addColumn('products', 'packing_price', 'REAL DEFAULT 0');
addColumn('fillings', 'show_range', 'INTEGER DEFAULT 1');
addColumn('orders', 'gst', 'REAL DEFAULT 0');
addColumn('products', 'source_image', "TEXT DEFAULT ''");
addColumn('fillings', 'grp', "TEXT DEFAULT 'Specialities'");
addColumn('orders', 'access_token', 'TEXT');
addColumn('orders', 'state', "TEXT DEFAULT ''");
addColumn('orders', 'note', "TEXT DEFAULT ''");
addColumn('orders', 'payment_ref', "TEXT DEFAULT ''");
addColumn('orders', 'payment_reported_at', 'TEXT');
addColumn('orders', 'admin_note', "TEXT DEFAULT ''");
addColumn('orders', 'payment_proof', "TEXT DEFAULT ''");

/* ---------- settings ---------- */
export const DEFAULT_SETTINGS = {
  storeName: 'Sri Company',
  tagline: 'Personalised dry-fruit gift boxes',
  phone1: '+91 98490 14152',
  phone2: '+91 99899 07808',
  storeEmail: '',
  gpayName: 'Sri Company',
  gpayNumber: '+91 98490 14152',
  upiId: 'sricompany.mk-1@okhdfcbank',
  qrImage: '/assets/gpay-qr-card.png',
  qrUpiId: '9849014152@okbizaxis',
  bankName: 'UNION BANK, SECRETRIAT BRANCH',
  accountName: 'Sri Company',
  accountNumber: '110315010000001',
  ifsc: 'UBIN0811033',
  codEnabled: 'false',
  gstPercent: '5'
};

export const getSetting = (key, fallback = DEFAULT_SETTINGS[key] ?? '') =>
  db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? fallback;

export const setSetting = (key, value) =>
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, String(value ?? ''));

export function allSettings() {
  const out = { ...DEFAULT_SETTINGS };
  for (const r of db.prepare('SELECT key,value FROM settings').all()) if (r.key in DEFAULT_SETTINGS) out[r.key] = r.value;
  return out;
}

/* Make sure the defaults exist in the table (never overwrite values an admin has edited). */
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(k, v);
}
if (process.env.STORE_EMAIL) db.prepare("UPDATE settings SET value=? WHERE key='storeEmail' AND value=''").run(process.env.STORE_EMAIL);

/* ---------- admin account ---------- */
export function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'admin@sricompany.in').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!';
  if (!db.prepare('SELECT id FROM admins WHERE email=?').get(email)) {
    db.prepare('INSERT INTO admins(email,password_hash) VALUES(?,?)').run(email, bcrypt.hashSync(password, 12));
  }
  return { email, usingDefaultPassword: !process.env.ADMIN_PASSWORD };
}

/* ---------- SQLite-backed session store (sessions survive restarts) ---------- */
import session from 'express-session';
export class SqliteStore extends session.Store {
  constructor() {
    super();
    this.purge = () => db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    this.purge();
    setInterval(this.purge, 60 * 60 * 1000).unref();
  }
  get(sid, cb) {
    try {
      const row = db.prepare('SELECT sess FROM sessions WHERE sid=? AND expires>=?').get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const expires = sess.cookie?.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 8 * 3600 * 1000;
      db.prepare('INSERT INTO sessions(sid,sess,expires) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expires=excluded.expires')
        .run(sid, JSON.stringify(sess), expires);
      cb?.(null);
    } catch (e) { cb?.(e); }
  }
  destroy(sid, cb) {
    try { db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); cb?.(null); } catch (e) { cb?.(e); }
  }
}
