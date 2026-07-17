#!/usr/bin/env node
// ============================================================
//  Imperial-units gate — zero API cost.
//
//  Born from the Lazar post: "15 מייל דרומית לאזור 51" shipped in the
//  TL;DR. The writer prompt has said "convert to metric" since v2, but a
//  rule nobody checks is a suggestion. This makes it mechanical.
//
//  Only fires on a unit ADJACENT TO A NUMBER, which is what disambiguates
//  the Hebrew traps:
//    "מייל"  — also "email" in casual Hebrew ("שלח לי מייל")
//    "רגל"   — also a body part / "רגליים"
//    "אבן"   — stone (weight) vs. an actual stone
//  "5 מייל" is a distance; "תשלח מייל" is not. Same for the rest.
//
//  Quotes are NOT exempt: contract rule ב says every content item
//  transfers, and a converted number is still the same fact. If a figure
//  must stay imperial inside a quote (the imperial value IS the point),
//  declare it: <!-- units-keep: <fragment> + reason -->
//
//  Exit 1 if a published post carries an unconverted imperial figure;
//  drafts warn.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'posts');

// A Hebrew/Arabic numeral (incl. ranges and decimals), then up to a few
// filler chars ("כ-", "‎", spaces, hyphens), then the unit.
const NUM = '\\d+(?:[.,]\\d+)?';
const GAP = '[\\s\\u200e\\u200f]*(?:[-–—]|עד|ל)?[\\s\\u200e\\u200f]*';
// JS \b is defined over [A-Za-z0-9_], so Hebrew letters are never "word"
// chars and \b silently never matches after them. Assert "not followed by
// another Hebrew letter" instead — that's what stops מייל from matching
// inside מיילים when we mean the singular.
const HEB_END = '(?![\\u0590-\\u05FF])';

const UNITS = [
  { re: 'מייל(?:ים)?', name: 'מייל', fix: 'ק"מ (×1.609)' },
  { re: 'פאונד(?:ים)?', name: 'פאונד', fix: 'ק"ג (×0.454)' },
  { re: "אינץ'|אינצ'ים|אינטש", name: 'אינץ׳', fix: 'ס"מ (×2.54)' },
  { re: 'רגל|רגליים|פיט|פוט', name: 'רגל/פיט', fix: 'מטרים (×0.305)' },
  { re: 'יארד(?:ים)?', name: 'יארד', fix: 'מטרים (×0.914)' },
  { re: 'פרנהייט|פרנהיט', name: 'פרנהייט', fix: 'צלזיוס ((F−32)×5/9)' },
  { re: 'גלון(?:ים)?', name: 'גלון', fix: 'ליטר (×3.785)' },
  { re: 'אונקיה|אונקיות|אונס', name: 'אונקיה', fix: 'גרם (×28.35)' },
  { re: 'מייל(?:ים)? לשעה|mph', name: 'מייל לשעה', fix: 'קמ"ש (×1.609)' },
];

function normalize(s) {
  return s.replace(/[‎‏]/g, '').replace(/\s+/g, ' ');
}

function extractKeeps(raw) {
  const keeps = [];
  const re = /<!--\s*units-keep:\s*([\s\S]*?)-->/g;
  let m;
  while ((m = re.exec(raw))) keeps.push(normalize(m[1]).trim());
  return keeps;
}

// Body only: frontmatter is metadata, and the trailing HTML comment holds
// the audit trail, where the English source legitimately says "15 miles".
function bodyOf(raw) {
  const withoutFm = raw.replace(/^---[\s\S]*?\n---\n/, '');
  return withoutFm.replace(/<!--[\s\S]*?-->/g, '');
}

const postFiles = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
let failures = 0;
let warnings = 0;
const clean = [];

for (const file of postFiles) {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
  const isDraft = /^draft:\s*true/m.test(raw);
  const body = normalize(bodyOf(raw));
  const keeps = extractKeeps(raw);
  const hits = [];

  for (const u of UNITS) {
    const re = new RegExp(`${NUM}${GAP}(?:${u.re})${HEB_END}`, 'g');
    for (const m of body.matchAll(re)) {
      const ctx = normalize(body.slice(Math.max(0, m.index - 45), m.index + m[0].length + 25));
      if (keeps.some((k) => ctx.includes(k) || k.includes(m[0]))) continue;
      hits.push({ match: m[0], unit: u.name, fix: u.fix, ctx });
    }
  }

  if (hits.length === 0) {
    clean.push(file);
    continue;
  }

  console.log(`\n${isDraft ? '⚠️ ' : '❌'} ${file}${isDraft ? ' (טיוטה)' : ''}`);
  for (const h of hits) {
    console.log(`   "${h.match}"  →  המר ל-${h.fix}`);
    console.log(`      …${h.ctx}…`);
    if (isDraft) warnings++;
    else failures++;
  }
}

console.log('\n──────────────────────────────');
if (failures > 0) {
  console.log(
    `❌ ${failures} מדידות אימפריאליות בפוסטים מפורסמים. הקורא הישראלי לא חושב במיילים — המר, או הצהר <!-- units-keep: ... --> מנומק.`,
  );
  process.exit(1);
}
console.log(`✓ ${clean.length}/${postFiles.length} פוסטים נקיים ממדידות אימפריאליות${warnings ? ` (${warnings} אזהרות בטיוטות)` : ''}.`);
