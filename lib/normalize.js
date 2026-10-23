import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { db, ROOT, getSetting, setSetting } from './db.js';

/* Every gift-box photo is converted to the same look:
   • square 1200 × 1200 JPEG, identical white background
   • extra empty border around the photo is trimmed away
   • the box is scaled to fill the same area (max 86% of the frame) and centred
   so the grid and the box page show all boxes at the same size and alignment. */
export const CANVAS = 1200;
export const FILL = 0.84;
export const BG = { r: 255, g: 255, b: 255 };
export const PIPELINE = 'studio-v3';   // bump to re-process every photo from its saved original

/* Soft studio backdrop (bright centre, slightly cooler edges) – the box photo is multiplied onto it,
   so the photo's own white background disappears and only the box remains. */
const backdrop = () => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}">
  <defs><radialGradient id="g" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.65" stop-color="#f7f8fb"/><stop offset="1" stop-color="#eceef5"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/></svg>`);
const shadow = (w, h, top) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}">
  <defs><filter id="b" x="-30%" y="-300%" width="160%" height="700%"><feGaussianBlur stdDeviation="${Math.round(CANVAS * 0.016)}"/></filter></defs>
  <ellipse cx="${CANVAS / 2}" cy="${top + h - Math.round(h * 0.015)}" rx="${Math.round(w * 0.44)}" ry="${Math.round(CANVAS * 0.02)}" fill="#1b1f4a" fill-opacity="0.30" filter="url(#b)"/></svg>`);

/* Is the photo on a (near) white background, like a catalogue cut-out? */
async function hasWhiteBackground(buf) {
  const { data, info } = await sharp(buf).resize(40, 40, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
    if (x > 1 && x < 38 && y > 1 && y < 38) continue;
    const i = (y * 40 + x) * info.channels;
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3; n++;
  }
  return sum / n >= 232;
}

export async function normalizeBuffer(input) {
  const base = sharp(input, { failOn: 'none' }).rotate().flatten({ background: BG });
  const flat = await base.clone().jpeg({ quality: 95 }).toBuffer();
  const enhance = img => img.normalise({ lower: 1, upper: 99 }).modulate({ brightness: 1.015, saturation: 1.08 }).sharpen({ sigma: 0.9, m1: 0.6, m2: 2 });

  if (!(await hasWhiteBackground(flat))) {
    /* Ordinary photo (box on a table or wall): show the whole photo, centred, on a soft blurred
       extension of itself so every box fills the same square frame with no cropping. */
    const bg = await sharp(flat).resize(CANVAS, CANVAS, { fit: 'cover' }).blur(38).modulate({ brightness: 1.08, saturation: 0.85 }).jpeg().toBuffer();
    const fg = await enhance(sharp(flat).resize(Math.round(CANVAS * 0.94), Math.round(CANVAS * 0.94), { fit: 'inside', kernel: 'lanczos3' })).toBuffer();
    return sharp(bg).composite([{ input: fg, gravity: 'centre' }]).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  }

  const meta = await base.metadata();
  let work = base;
  try {
    const trimmed = await sharp(await base.clone().png().toBuffer()).trim({ threshold: 22 }).toBuffer({ resolveWithObject: true });
    // Only accept the trim if something sensible is left (never crop away the box itself).
    if (trimmed.info.width >= meta.width * 0.25 && trimmed.info.height >= meta.height * 0.25) work = sharp(trimmed.data);
  } catch { /* nothing to trim */ }
  const target = Math.round(CANVAS * FILL);
  const { data: fitted, info } = await enhance(work.resize(target, target, { fit: 'inside', kernel: 'lanczos3' })).toBuffer({ resolveWithObject: true });
  const left = Math.round((CANVAS - info.width) / 2), top = Math.round((CANVAS - info.height) / 2);
  return sharp(backdrop())
    .composite([
      { input: shadow(info.width, info.height, top), blend: 'multiply' },
      { input: fitted, left, top, blend: 'multiply' }
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

const PRODUCT_DIR = path.join(ROOT, 'public', 'uploads', 'products');
const ORIGINALS = path.join(ROOT, 'data', 'originals', 'products');

/** Normalises every locally stored box photo that is new or changed. Originals are kept in data/originals. */
let chain = Promise.resolve();
export const normalizeProductPhotos = opts => (chain = chain.then(() => run(opts), () => run(opts)));

async function run({ log = () => {} } = {}) {
  let seen = {};
  try { seen = JSON.parse(getSetting('normalizedPhotos', '{}')); } catch {}
  const reprocess = seen.__pipeline !== PIPELINE;   // new look: rebuild everything from the saved originals
  if (reprocess) seen = { __pipeline: PIPELINE };
  fs.mkdirSync(ORIGINALS, { recursive: true });
  let done = 0, failed = 0;
  for (const p of db.prepare("SELECT id,image FROM products WHERE image LIKE '/uploads/products/%'").all()) {
    const file = path.join(PRODUCT_DIR, path.basename(p.image.split('?')[0]));
    if (!fs.existsSync(file)) continue;
    const mtime = fs.statSync(file).mtimeMs;
    if (seen[p.id] === mtime) continue;
    try {
      const saved = fs.readdirSync(ORIGINALS).find(f => path.basename(f, path.extname(f)) === p.id);
      let source = file;
      if (!(reprocess && saved)) {   // already a finished 1200 × 1200 studio photo (e.g. copied from another install): keep as is
        const m = await sharp(file, { failOn: 'none' }).metadata();
        if (m.width === CANVAS && m.height === CANVAS && m.format === 'jpeg') { seen[p.id] = mtime; continue; }
      }
      if (reprocess && saved) source = path.join(ORIGINALS, saved);          // rebuild from the untouched original
      else {                                                                 // a new or replaced photo: keep it as the original
        if (saved) fs.rmSync(path.join(ORIGINALS, saved), { force: true });
        fs.copyFileSync(file, path.join(ORIGINALS, path.basename(file)));
      }
      const out = await normalizeBuffer(fs.readFileSync(source));
      const outName = `${p.id}.jpg`;
      fs.writeFileSync(path.join(PRODUCT_DIR, outName), out);
      if (path.basename(file) !== outName) fs.rmSync(file, { force: true });
      db.prepare('UPDATE products SET image=? WHERE id=?').run(`/uploads/products/${outName}?v=${Date.now().toString(36)}`, p.id);
      seen[p.id] = fs.statSync(path.join(PRODUCT_DIR, outName)).mtimeMs;
      done++;
    } catch (e) { failed++; log(`  ! ${p.id}: ${e.message}`); }
  }
  setSetting('normalizedPhotos', JSON.stringify(seen));
  return { done, failed };
}
