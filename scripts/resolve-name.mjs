#!/usr/bin/env node
// Resolve the canonical Hebrew spelling of a person's name via Wikipedia.
// Usage: node scripts/resolve-name.mjs "Neil deGrasse Tyson"
import { resolveHebrewName } from './lib/name-resolver.mjs';

const nameEn = process.argv.slice(2).join(' ').trim();
if (!nameEn) {
  console.error('שימוש: node scripts/resolve-name.mjs "<English name>"');
  process.exit(1);
}

const { he, source } = await resolveHebrewName(nameEn);
if (he) {
  console.log(`${nameEn}  →  ${he}   (${source})`);
} else {
  console.log(`${nameEn}  →  לא נמצא איות עברי קנוני. אמתו ידנית.`);
  process.exit(2);
}
