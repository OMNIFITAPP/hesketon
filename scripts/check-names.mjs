#!/usr/bin/env node
// Validate every person's Hebrew name in src/data/people.json against the
// canonical Wikipedia spelling. Reports mismatches; never edits automatically
// (Wikipedia titles carry disambiguation and edge cases a human should confirm).
//
// Usage: node scripts/check-names.mjs   (or: npm run check-names)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHebrewName } from './lib/name-resolver.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const people = JSON.parse(fs.readFileSync(path.join(root, 'src/data/people.json'), 'utf8'));

// Our nameHe sometimes carries an intentional honorific ("ד"ר", "פרופ'")
// that Wikipedia titles omit — strip it before comparing so it isn't a false alarm.
const stripHonorific = (s) => s.replace(/^(ד"ר|דוקטור|פרופ'?|פרופסור)\s+/, '').trim();

let mismatches = 0, unresolved = 0;
for (const p of people) {
  if (!p.nameEn) continue;
  const { he, source } = await resolveHebrewName(p.nameEn);
  if (!he) {
    unresolved++;
    console.log(`❓ ${p.nameEn}: אין ערך ויקיפדיה — נשאר "${p.nameHe}" (אמתו ידנית)`);
  } else if (he !== stripHonorific(p.nameHe)) {
    mismatches++;
    console.log(`⚠️  ${p.nameEn}:\n     קובץ:    "${p.nameHe}"\n     ויקיפדיה: "${he}"  (${source})`);
  } else {
    console.log(`✓ ${p.nameEn} → ${he}`);
  }
}
console.log(`\nסיכום: ${mismatches} אי-התאמות, ${unresolved} ללא ערך ויקיפדיה, מתוך ${people.length}.`);
process.exit(mismatches ? 1 : 0);
