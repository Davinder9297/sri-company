# Sri Company — Gift Box Store

Full-stack website for Sri Company: customers pick a gift box, fill each compartment with dry fruits
(by weight), see the live price, and pay by **Google Pay / UPI or bank transfer**. No payment gateway.

* Front end: vanilla JS single-page storefront (no build step), fonts self-hosted
* Back end: Node.js + Express + SQLite (one file, `data/store.sqlite`)
* Admin panel: `/admin` — orders, payment verification, boxes, fillings, photos, payment details

## Run it
```bash
npm install
cp .env.example .env        # then edit .env (admin email/password, SESSION_SECRET)
npm start
```
Open http://localhost:3000 — admin at http://localhost:3000/admin.
Requires Node.js 20 or newer. The first start loads the 41 boxes and 55 fillings automatically.

## Photos (important)
* **Boxes:** your Google Drive photos are downloaded to the server automatically on start
  (`AUTO_CACHE_IMAGES=true`) so they load fast. Each Drive file must be shared as
  *Anyone with the link – Viewer*. Run `npm run images` to retry, or use Admin → Gift boxes → upload.
* **Uniform look:** every box photo is automatically converted to a 1200 × 1200 square on the same white background,
  with extra border trimmed and the box centred at the same scale (originals are kept in `data/originals/`). This runs
  on start, after Drive download, and after every admin upload. Run `npm run normalize` to redo all photos.
  Works best when the original photos have a plain, even background.
* **Fillings:** 12 base-ingredient photos (cashew, almond, pistachio, golden/green raisin, cranberry, blueberry,
  fig, dates, walnut, mixed bites) are in `public/assets/fillings/` and are shared by each ingredient's flavoured
  variants. Khurbani has no photo yet. A photo you upload for one specific filling (Admin → Fillings, or a file named
  after the filling id in `public/uploads/fillings/`, e.g. `mamra-badam.jpg`) always replaces the shared one.
* Box photos can also be dropped into `public/uploads/products/` named like the box id (`sc01-8x8.jpg`).

## Payments
Details live in Admin → Settings & payments (editable any time) and are shown on the order page, the
Payment details page and the footer. Customers pay, then upload a payment screenshot/receipt (JPG, PNG, WEBP or PDF, up to 6 MB) and/or enter the UTR on
their order page. Screenshots are stored privately in `data/payment-proofs/` (never publicly reachable) and open from
Admin → Orders → *View screenshot*. In Admin → Orders, set *Payment* to **Verified** — the order moves to *Confirmed*.

## Pricing rules
Price = box retail price + Σ (filling ₹/kg × grams ÷ 1000). Weights are in 25 g steps and cannot exceed the
box capacity. The server recalculates every order; browser prices are never trusted.
Retail box prices were set from your purchase cost × 1.3 (rounded to ₹5) — **review them in Admin → Gift boxes**.

## Going live checklist
1. Set `ADMIN_PASSWORD`, `SESSION_SECRET` in `.env`; set `COOKIE_SECURE=true` and `TRUST_PROXY=1` behind HTTPS.
2. Use a host with a persistent disk (keep `data/` and `public/uploads/`) and back them up.
3. Put nginx/Caddy (HTTPS) in front, or use any Node host (Render, Railway, a VPS).

## 2026 Diwali catalogue update

- **Boxes** (`data/products.json`, 117 entries) and **filling rates** (`data/fillings.json`, 59 entries) come from `New_Diwali_Boxes_Working_File_-_2026.xlsx` (copy in `data/source-catalogue.xlsx`).
- On the first start after this update the server refreshes all filling rates and box prices from those two JSON files once (`CATALOGUE_VERSION` in `server.js`). After that, Admin edits are kept. To push new Excel prices later, edit the JSON and bump `CATALOGUE_VERSION`.
- **Retail box price**: boxes with a price in the RATES sheet use it. The 2026 cardboard and special boxes use cost × 1.3, rounded to ₹5. Change any price in Admin → Gift boxes.
- **Boxes without a photo are hidden from the shop** until you add one (Admin → Gift boxes → upload, or drop `public/uploads/products/<code>.jpg`, e.g. `s01-2x1.jpg`).
- **Photos**: each filling photo is `public/assets/fillings/<filling-id>.jpg`. Shared base photos are used only for fillings without their own.
- **Box photos** are processed to a studio look: auto-levels, sharpening, soft backdrop and contact shadow, 1200×1200, centred. Originals stay in `data/originals/products/`. Bump `PIPELINE` in `lib/normalize.js` to rebuild every photo.
- **Billing** shows the box price, each filling (grams × rate/kg), price per box and boxes/fillings totals in the bag, checkout, order page and Admin.

## Going live (checklist)

1. Copy `.env.example` to `.env` and set `ADMIN_EMAIL`, a strong `ADMIN_PASSWORD` and a long random `SESSION_SECRET`. With `NODE_ENV=production` the server refuses to start until both are set. Nothing about the admin login is shown on the login page.
2. The `.env.example` is set for a live HTTPS server behind Caddy or Nginx (`COOKIE_SECURE=true`, `TRUST_PROXY=1`). To test on your own computer over plain http, use `NODE_ENV=development` and `COOKIE_SECURE=false`.
3. The box prices, stock, weights and compartments come from the "2026 - NEW" sheet (column "PRICE" is the selling price). Box photos are in `public/uploads/products/<code>.jpg`; boxes with a Google Drive link in the sheet also fetch that photo on the server.
4. Back up the `data/` folder (orders, payment proofs, database) regularly.

## Compartment rules (checked against the box photos)

- Normal boxes (`Nx1`): N compartments. Cardboard sizes follow the PART column (8×8 = 4, 8×12 = 6, 10×10 = 4, 10×15 = 6, 12×12 = 4, 12×18 = 6).
- Layouts written `A+B` (4+2, 4+1, 4+4, 2+2): **A** = fillable jars/compartments. The extra B items are candles or a chocolate tray, not dry-fruit compartments. Example: 1205/1215/1225 = 4 jars (+ 2 candle tins).
- MN29 (11×11) has 6 cells. 404 (10×15) is an open tray; set to 6 partitions at ₹450 as requested.
- To change any box, edit `compartments` in `data/products.json` and bump `CATALOGUE_VERSION` in `server.js`.

- Fillings hidden from customers (`"active": false` in `data/fillings.json`): Almond Roca, Almond Florentine Round, and every individual flavour (Achari/Barbeque/... Kaju, Masala/Paan/... Badam, Bubble Gum/... Kishmish, Coated). Customers see only Flavoured Badam, Flavoured Kaju, Flavoured Kishmish and Flavoured Pista. They can be switched back on in Admin > Fillings, but the next catalogue refresh follows the JSON file.

## Update: categories, GST and packing (v5)

* **Box categories:** `/shop` lists categories (sizes); each opens `/shop/<size>` with only that category's boxes.
* **Our Range** (`/our-range`, old `/fillings` still works): fillings in four categories — Regular, Flavoured, Berries & Seeds, Bites & Chocolates — alternating left/right, no prices. Fillings not on the sheet are hidden.
* **Billing:** box + fillings (by weight) + packing per box, then 5% GST on the subtotal. Packing per size is in `data/products.json` (`packingPrice`); the GST rate is the `gstPercent` setting (default 5).

## Update (v6)
* Admin → Fillings: the name is editable, and "Show on Our Range" controls whether a filling is listed on the public Our Range page (hidden ones still work in boxes).
* Every box capacity is 25% higher (200 g → 250 g, rounded down to a 25 g step).
