#!/usr/bin/env node
// ============================================================
//  Thumbnail gate — zero API cost (just HEADs against i.ytimg.com).
//
//  Reports which quality each post's hero/og:image will actually resolve
//  to. src/lib/thumbs.ts already picks the best available at build time,
//  so a 404 on maxresdefault is handled — but it means the post ships a
//  4:3 image letterboxed into a 16:9 slot, which is worth knowing about
//  rather than discovering on a share card.
//
//  Fails only if a post has NO usable thumbnail at all (bad video id,
//  deleted video) — that's a broken source link, not a cosmetic issue.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'posts');

const CANDIDATES = ['maxresdefault', 'sddefault', 'hqdefault'];

async function exists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

function videoId(raw) {
  const m = raw.match(/youtubeUrl:\s*["']?([^"'\s]+)/);
  if (!m) return undefined;
  const id = m[1].match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return id?.[1];
}

const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
let broken = 0;
let degraded = 0;
let ok = 0;

for (const file of files) {
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
  const id = videoId(raw);
  if (!id) {
    console.log(`⚠️  ${file}: אין youtubeUrl תקין — אין תמונת hero ואין og:image.`);
    broken++;
    continue;
  }

  let resolved;
  for (const q of CANDIDATES) {
    if (await exists(`https://i.ytimg.com/vi/${id}/${q}.jpg`)) {
      resolved = q;
      break;
    }
  }

  if (!resolved) {
    console.log(`❌ ${file}: אף תמונה לא נמצאה ל-${id} (סרטון נמחק? מזהה שגוי?).`);
    broken++;
  } else if (resolved !== 'maxresdefault') {
    console.log(`🟠 ${file}: אין maxresdefault — נופל ל-${resolved} (4:3, ייכנס עם פסים לתוך מסגרת 16:9). [${id}]`);
    degraded++;
  } else {
    ok++;
  }
}

console.log('\n──────────────────────────────');
if (broken > 0) {
  console.log(`❌ ${broken} פוסטים בלי תמונה שמישה. תקנו את ה-youtubeUrl.`);
  process.exit(1);
}
console.log(`✓ ${ok} פוסטים ב-maxres${degraded ? `, ${degraded} באיכות נמוכה יותר (מטופל אוטומטית ב-src/lib/thumbs.ts)` : ''}.`);
