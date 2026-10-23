// Re-processes every box photo to the same size / background / alignment.
import 'dotenv/config';
import { normalizeProductPhotos } from '../lib/normalize.js';
import { db, setSetting } from '../lib/db.js';
setSetting('normalizedPhotos', '{}');   // force all photos to be processed again (originals are kept in data/originals)
const r = await normalizeProductPhotos({ log: console.log });
console.log(`Standardised ${r.done} box photos${r.failed ? `, ${r.failed} failed` : ''}.`);
