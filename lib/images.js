import fs from 'node:fs';
import path from 'node:path';
import { db, ROOT } from './db.js';
import { normalizeProductPhotos } from './normalize.js';

const UP = path.join(ROOT, 'public', 'uploads');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const LOCAL_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Photos can simply be dropped into public/uploads/products or public/uploads/fillings.
 * A file called  <id>.jpg  (for example  sc01-8x8.jpg  or  badam.jpg ) is picked up automatically
 * on the next start. Photos uploaded in Admin are stored the same way.
 */
export function linkLocalPhotos() {
  let linked = 0;
  const scan = (table, folder, urlBase) => {
    const dir = path.join(UP, folder);
    if (!fs.existsSync(dir)) return;
    const files = new Map(fs.readdirSync(dir)
      .filter(f => LOCAL_EXTS.includes(path.extname(f).toLowerCase()))
      .map(f => [path.basename(f, path.extname(f)).toLowerCase(), f]));
    for (const row of db.prepare(`SELECT id, ${table === 'products' ? 'code,' : ''} image FROM ${table}`).all()) {
      const hit = files.get(row.id.toLowerCase()) || (row.code && files.get(String(row.code).toLowerCase()));
      if (hit && row.image !== `${urlBase}/${hit}` && (!row.image || row.image.startsWith('http'))) {
        db.prepare(`UPDATE ${table} SET image=? WHERE id=?`).run(`${urlBase}/${hit}`, row.id);
        linked++;
      }
    }
  };
  scan('products', 'products', '/uploads/products');
  scan('fillings', 'fillings', '/uploads/fillings');
  return linked;
}

/** Download remote (Google Drive) photos once and serve them from this server. */
export async function cacheRemoteImages({ log = console.log, force = false } = {}) {
  const rows = db.prepare("SELECT id, image, source_image FROM products WHERE active=1 AND image LIKE 'http%'").all();
  if (!rows.length) return { done: 0, failed: 0, total: 0 };
  fs.mkdirSync(path.join(UP, 'products'), { recursive: true });
  let done = 0, failed = 0, i = 0;

  async function worker() {
    while (i < rows.length) {
      const row = rows[i++];
      try {
        const res = await fetch(row.image, { redirect: 'follow', signal: AbortSignal.timeout(25000) });
        const type = (res.headers.get('content-type') || '').split(';')[0].trim();
        if (!res.ok || !EXT[type]) throw new Error(`HTTP ${res.status} ${type || 'no content-type'}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 2048) throw new Error('image too small');
        const file = `${row.id}${EXT[type]}`;
        fs.writeFileSync(path.join(UP, 'products', file), buf);
        db.prepare('UPDATE products SET image=?, source_image=? WHERE id=?').run(`/uploads/products/${file}`, row.source_image || row.image, row.id);
        done++;
      } catch (e) {
        failed++;
        log(`  ! ${row.id}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  await normalizeProductPhotos({ log });
  return { done, failed, total: rows.length };
}

/* ---------- shared photos for fillings ----------
   One photo per base ingredient is reused for its flavoured / coated variants (the filling's own
   name is always shown next to the photo). A photo you upload for a specific filling always wins:
   this only fills in fillings that have no photo yet. Fillings with no suitable photo stay blank. */
const BASE = f => {
  const n = f.name.toLowerCase();
  if (n.includes('khurbani')) return null;                 // dried apricot — no photo yet
  if (n.includes('akrot')) return 'walnut';
  if (n.includes('anjeer')) return 'fig';
  if (n.includes('khajoor') || n.includes('dates pastry')) return 'dates';
  if (n.includes('blueberry') && !n.includes('badam') && !n.includes('kaju')) return 'blueberry';
  if (n.includes('cranberry')) return 'cranberry';
  if (n.includes('kaju')) return 'cashew';
  if (n.includes('pista')) return 'pistachio';
  if (n.includes('badam') || n.includes('almond')) return 'almond';
  if (n.includes('kishmish green')) return 'raisin-green';
  if (n.includes('kishmish') || n.includes('raisin')) return 'raisin-golden';
  if (f.grp === 'Bites & mixes') return 'mixed-bites';
  return null;
};
export function applyBasePhotos() {
  const dir = path.join(ROOT, 'public', 'assets', 'fillings');
  let n = 0;
  /* A photo named after the filling (assets/fillings/<id>.jpg) beats the shared base photo.
     Photos uploaded in Admin (/uploads/...) are never replaced. */
  for (const f of db.prepare("SELECT id,name,grp,image FROM fillings WHERE image='' OR image LIKE '/assets/fillings/%'").all()) {
    const own = fs.existsSync(path.join(dir, `${f.id}.jpg`)) ? f.id : null;
    const key = own || BASE(f);
    const url = key && fs.existsSync(path.join(dir, `${key}.jpg`)) ? `/assets/fillings/${key}.jpg` : '';
    if (url && url !== f.image) {
      db.prepare('UPDATE fillings SET image=? WHERE id=?').run(url, f.id);
      n++;
    }
  }
  return n;
}
