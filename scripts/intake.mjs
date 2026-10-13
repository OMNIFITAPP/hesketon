#!/usr/bin/env node
// ============================================================
//  הסכתון — intake: YouTube URLs → transcript files in to-do/
//
//  Replaces the manual step (paste the URL into youtube-transcript.io,
//  copy the text into a file). Uses the same site through its API, so the
//  text is identical to what the site shows.
//
//  Usage:
//    npm run intake -- <url> [<url> ...]
//    npm run intake -- urls.txt          (one URL per line)
//
//  Token: YT_TRANSCRIPT_TOKEN in .env.local (gitignored). The free plan
//  gives 25 transcripts a month, so a video that already has a file in
//  to-do/ or done/ is skipped rather than fetched again.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE =
  process.env.HESKETON_TRANSCRIPTS ??
  path.join(os.homedir(), 'Downloads/OMNIFIT_Knowledge_Base/hesketon/podcast-transcripts');
const TODO = path.join(BASE, 'to-do');
const DONE = path.join(BASE, 'done');

function token() {
  if (process.env.YT_TRANSCRIPT_TOKEN) return process.env.YT_TRANSCRIPT_TOKEN;
  const f = path.join(ROOT, '.env.local');
  const m = fs.existsSync(f) && fs.readFileSync(f, 'utf8').match(/^YT_TRANSCRIPT_TOKEN=(.+)$/m);
  if (!m) {
    console.error('  ❌ אין YT_TRANSCRIPT_TOKEN ב-.env.local');
    process.exit(1);
  }
  return m[1].trim();
}

const videoId = (s) =>
  s.match(/(?:v=|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{11})/)?.[1] ??
  (/^[A-Za-z0-9_-]{11}$/.test(s) ? s : null);

// arguments: URLs, or a file that lists them
const inputs = process.argv.slice(2).flatMap((a) =>
  fs.existsSync(a) && fs.statSync(a).isFile()
    ? fs.readFileSync(a, 'utf8').split(/\s+/).filter(Boolean)
    : [a],
);
const ids = [...new Set(inputs.map(videoId).filter(Boolean))];
const bad = inputs.filter((a) => !videoId(a));
if (!ids.length) {
  console.error('  שימוש: npm run intake -- <youtube-url> [...]  או קובץ עם כתובת בכל שורה');
  process.exit(1);
}

// a video already on disk is not fetched again (each fetch costs a token)
const onDisk = new Map();
for (const dir of [TODO, DONE]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(rtf|txt|md)$/i.test(f)) continue;
    // Only the visible link at the top counts. Hand-made RTF files can carry a
    // stale hidden hyperlink to a different video, which would cause a wrong skip.
    const full = path.join(dir, f);
    let head = '';
    try {
      head = /\.rtf$/i.test(f)
        ? execFileSync('textutil', ['-convert', 'txt', '-stdout', full], { encoding: 'utf8' }).slice(0, 400)
        : fs.readFileSync(full, 'utf8').slice(0, 400);
    } catch {}
    const m = head.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m && !onDisk.has(m[1])) onDisk.set(m[1], `${path.basename(dir)}/${f}`);
  }
}
const fresh = ids.filter((id) => !onDisk.has(id));

console.log('');
for (const b of bad) console.log(`  ⚠️  לא זוהתה כתובת יוטיוב: ${b}`);
for (const id of ids.filter((i) => onDisk.has(i)))
  console.log(`  ↷ כבר קיים, לא נמשך שוב: ${onDisk.get(id)}`);

let failed = 0;
for (let i = 0; i < fresh.length; i += 50) {
  const res = await fetch('https://www.youtube-transcript.io/api/transcripts', {
    method: 'POST',
    headers: { Authorization: `Basic ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: fresh.slice(i, i + 50) }),
  });
  if (!res.ok) {
    console.log(`  ❌ השירות החזיר ${res.status}${res.status === 402 || res.status === 403 ? ' — ייתכן שנגמרו הטוקנים החודשיים' : ''}`);
    failed += fresh.slice(i, i + 50).length;
    continue;
  }
  for (const v of await res.json()) {
    const text = (v.text ?? '').trim();
    if (!text) {
      console.log(`  ❌ ${v.id}: אין תמליל (${v.playabilityStatus?.reason || 'אין כתוביות'})`);
      failed++;
      continue;
    }
    const mf = v.microformat?.playerMicroformatRenderer ?? {};
    const minutes = mf.lengthSeconds ? Math.round(Number(mf.lengthSeconds) / 60) : null;
    const title = (v.title ?? v.id).replace(/[\/\n\r]+/g, ' ').trim();
    const file = path.join(TODO, `${title}.txt`);
    const header = [
      `Link: https://www.youtube.com/watch?v=${v.id}`,
      mf.publishDate ? `Published: ${mf.publishDate}` : null,
      minutes ? `Duration: ${minutes} min` : null,
    ].filter(Boolean);
    fs.mkdirSync(TODO, { recursive: true });
    fs.writeFileSync(file, `${header.join('\n')}\n\n${text}\n`);
    const words = text.split(/\s+/).length;
    const punct = ((text.match(/[.,?!]/g) ?? []).length / words) * 100;
    console.log(`  ✓ ${title}`);
    console.log(
      `    ${mf.publishDate ?? 'תאריך לא ידוע'} · ${minutes ?? '?'} דק׳ · ${words.toLocaleString()} מילים · ${
        punct < 1 ? '🔴 בלי פיסוק (ASR גולמי)' : 'מפוסק'
      }`,
    );
  }
}
console.log('');
process.exit(failed ? 1 : 0);
