// Downloads the Google Drive box photos onto this server so they always load fast and never break.
import 'dotenv/config';
import { cacheRemoteImages } from '../lib/images.js';
import { seedCatalogue } from '../seed.js';

seedCatalogue();
console.log('Downloading box photos from Google Drive…');
const r = await cacheRemoteImages({});
console.log(`Done: ${r.done} saved, ${r.failed} failed (of ${r.total}).`);
if (r.failed) console.log('Failed photos keep their Drive link. Make sure each file is shared as "Anyone with the link — Viewer", then run this again.');
