import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { db, ROOT, ensureAdmin } from './lib/db.js';
import { linkLocalPhotos, applyBasePhotos } from './lib/images.js';

export function seedCatalogue({ refreshPrices = false } = {}) {
  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
  const fillings = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fillings.json'), 'utf8'));

  /* Re-running the seed refreshes catalogue facts but never overwrites what you edited in Admin
     (retail price, stock, photos, active flag). */
  const addP = db.prepare(`
    INSERT INTO products(id,code,name,category,purchase_price,selling_price,weight,capacity_grams,design,size,compartments,stock,track_stock,image,source_image,active)
    VALUES(@id,@code,@name,@category,@purchasePrice,@sellingPrice,@weight,@capacityGrams,@design,@size,@compartments,@stock,@trackStock,@image,@image,1)
    ON CONFLICT(id) DO UPDATE SET
      code=excluded.code, name=excluded.name, category=excluded.category, purchase_price=excluded.purchase_price,
      weight=excluded.weight, capacity_grams=excluded.capacity_grams, design=excluded.design, size=excluded.size,
      compartments=excluded.compartments,
      selling_price=CASE WHEN @refresh=0 AND products.selling_price>0 THEN products.selling_price ELSE excluded.selling_price END,
      source_image=CASE WHEN products.source_image='' THEN excluded.source_image ELSE products.source_image END,
      image=CASE WHEN products.image='' THEN excluded.image ELSE products.image END`);
  const addF = db.prepare(`
    INSERT INTO fillings(id,name,grp,rate_per_kg,image,active) VALUES(@id,@name,@group,@ratePerKg,'',@active)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, grp=excluded.grp,
      rate_per_kg=CASE WHEN @refresh=1 THEN excluded.rate_per_kg ELSE fillings.rate_per_kg END,
      active=CASE WHEN @refresh=1 THEN excluded.active ELSE fillings.active END`);

  db.transaction(() => {
    for (const p of products) addP.run({ stock: 0, trackStock: 0, ...p, trackStock: p.trackStock ? 1 : 0, image: p.image || '', refresh: refreshPrices ? 1 : 0 });
    for (const f of fillings) addF.run({ active: 1, ...f, active: f.active === false ? 0 : 1, refresh: refreshPrices ? 1 : 0 });
  })();
  const linked = linkLocalPhotos() + applyBasePhotos();
  return { products: products.length, fillings: fillings.length, linked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = seedCatalogue();
  ensureAdmin();
  console.log(`Seeded ${r.products} gift boxes and ${r.fillings} fillings (${r.linked} local photos linked).`);
}
