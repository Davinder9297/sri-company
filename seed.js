import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { db, ROOT, ensureAdmin } from './lib/db.js';
import { linkLocalPhotos, applyBasePhotos } from './lib/images.js';

/* The catalogue files (data/products.json, data/fillings.json) and the Admin panel can both change the same values.
   The database (Admin) always wins:
   • a box or filling that is not in the database yet is added from the JSON;
   • for one that exists, a JSON value is copied in only when it changed in the JSON since it was last applied
     AND nobody has changed that value in Admin since then.
   What was last applied from the JSON is remembered in the catalogue_applied table. Runs on every start. */
const PRODUCT_FIELDS = {
  code: p => p.code, name: p => p.name, category: p => p.category ?? 'Gift boxes',
  purchase_price: p => p.purchasePrice ?? 0, selling_price: p => p.sellingPrice ?? 0, packing_price: p => p.packingPrice ?? 0,
  weight: p => p.weight ?? '', capacity_grams: p => p.capacityGrams ?? 0, design: p => p.design ?? '', size: p => p.size ?? '',
  compartments: p => p.compartments ?? 4
};
const FILLING_FIELDS = {
  name: f => f.name, grp: f => f.group ?? 'Specialities', rate_per_kg: f => f.ratePerKg ?? 0, active: f => (f.active === false ? 0 : 1)
};
const same = (a, b) => String(a ?? '') === String(b ?? '');

function sync(kind, table, items, fields, insert) {
  const getRow = db.prepare(`SELECT * FROM ${table} WHERE id=?`);
  const getApplied = db.prepare('SELECT data FROM catalogue_applied WHERE kind=? AND id=?');
  const setApplied = db.prepare('INSERT INTO catalogue_applied(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data');
  let added = 0, updated = 0;
  for (const item of items) {
    const want = Object.fromEntries(Object.entries(fields).map(([col, get]) => [col, get(item)]));
    const row = getRow.get(item.id);
    if (!row) {
      insert(item, want);
      added++;
    } else {
      const applied = JSON.parse(getApplied.get(kind, item.id)?.data || 'null');
      // no record yet (first run of this logic): keep the database exactly as it is
      const cols = applied ? Object.keys(want).filter(c => !same(want[c], applied[c]) && same(row[c], applied[c])) : [];
      if (cols.length) {
        db.prepare(`UPDATE ${table} SET ${cols.map(c => `${c}=?`).join(',')} WHERE id=?`).run(...cols.map(c => want[c]), item.id);
        updated++;
      }
    }
    setApplied.run(kind, item.id, JSON.stringify(want));
  }
  return { added, updated };
}

export function seedCatalogue() {
  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
  const fillings = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fillings.json'), 'utf8'));

  const addP = db.prepare(`
    INSERT INTO products(id,code,name,category,purchase_price,selling_price,packing_price,weight,capacity_grams,design,size,compartments,stock,track_stock,image,source_image,active)
    VALUES(@id,@code,@name,@category,@purchase_price,@selling_price,@packing_price,@weight,@capacity_grams,@design,@size,@compartments,@stock,@track_stock,@image,@image,1)`);
  const addF = db.prepare(`
    INSERT INTO fillings(id,name,grp,rate_per_kg,image,active) VALUES(@id,@name,@grp,@rate_per_kg,'',@active)`);
  /* a box photo from the JSON only fills an empty slot; photos uploaded in Admin are never replaced */
  const fillImage = db.prepare(`UPDATE products SET image=CASE WHEN image='' THEN @image ELSE image END,
    source_image=CASE WHEN source_image='' THEN @image ELSE source_image END WHERE id=@id`);

  const r = db.transaction(() => {
    const p = sync('product', 'products', products, PRODUCT_FIELDS, (item, want) =>
      addP.run({ ...want, id: item.id, stock: item.stock ?? 0, track_stock: item.trackStock ? 1 : 0, image: item.image || '' }));
    for (const item of products) if (item.image) fillImage.run({ id: item.id, image: item.image });
    const f = sync('filling', 'fillings', fillings, FILLING_FIELDS, (item, want) => addF.run({ ...want, id: item.id }));
    return { added: p.added + f.added, updated: p.updated + f.updated };
  })();
  const linked = linkLocalPhotos() + applyBasePhotos();
  return { products: products.length, fillings: fillings.length, linked, ...r };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = seedCatalogue();
  ensureAdmin();
  console.log(`Catalogue: ${r.products} gift boxes and ${r.fillings} fillings in data/*.json — ${r.added} added, ${r.updated} updated (${r.linked} local photos linked).`);
}
