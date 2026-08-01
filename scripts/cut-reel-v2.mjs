#!/usr/bin/env node
// Pilot cut of the v2 reel format — Tommy Wood, "future-proof brain".
//
//   node scripts/cut-reel-v2.mjs [--out DIR] [--fps 30]
//
// Every on-screen line traces to the published post: the stat and the
// three beats come from its אמ;לק bullets, the punch line from
// "מה לוקחים מזה". Lines are trimmed for screen, never restated.
//
// Structure (18.4s, down from 27.6s):
//   cold open → stat → 3 beats → invert punch → CTA

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { fontCss } from './lib/social/render.mjs';
import { buildReelHtml, REEL } from './lib/social/reel-v2.mjs';
import { renderFrames } from './lib/social/frames.mjs';
import { verifyReel } from './lib/social/verify-reel.mjs';
import { encodeFrames, probe } from './lib/social/video.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fps = Number((args.find((a) => a.startsWith('--fps=')) || '').split('=')[1]) || 30;
const outDir = (args.find((a) => a.startsWith('--out=')) || '').split('=')[1]
  || path.join(ROOT, 'public/social/_preview_reel-v2');

const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const post = posts.find((p) => p.slug === 'tommy-wood-future-proof-brain');
if (!post) throw new Error('post not found');

// ── storyboard ──────────────────────────────────────────────
const SB = {
  total: 18.4,
  kicker: 'אמ;לק',
  scenes: [
    // cold open — no branding, question types on
    { type: 'type', text: 'כמה מהדמנציה אפשר למנוע?', in: 0.0, out: 1.5, bare: true, progress: false },

    // the stat (אמ;לק #1). Shown as the full range — the source says
    // "בין 45% ל-70%", so a single number would overstate it.
    { type: 'stat', value: '45%–70%', text: 'ממקרי הדמנציה ניתנים למניעה.', in: 1.5, out: 5.2 },

    // beat 1 — marker sweep on the phrase that carries it (אמ;לק #1)
    { type: 'mark', text: 'זה מגיע בעיקר מאורח חיים, לא מגזרה גנטית.', key: 'מאורח', in: 5.2, out: 8.3 },

    // beat 2 — keyword pop (אמ;לק #4)
    { type: 'pop', text: 'שני גורמי הסיכון הגדולים: לחץ דם גבוה וסוכר גבוה בדם.', key: 'הגדולים:', in: 8.3, out: 11.6 },

    // beat 3 — plain cascade (אמ;לק #4, second half)
    { type: 'line', text: 'ופעילות גופנית היא ההגנה היעילה ביותר כנגדם.', in: 11.6, out: 14.4 },

    // invert punch — the takeaway, whole frame flips (מה לוקחים מזה #3)
    { type: 'line', text: 'כושר, תזונה ושינה הם בריאות מוח.', in: 14.4, out: 16.1, invert: true },

    // CTA
    { type: 'cta', text: `הפרק המלא — בתקציר של ${post.readingTime || 10} דקות.`, in: 16.1, out: 18.4, progress: false },
  ],
};

// ── render ──────────────────────────────────────────────────
const html = buildReelHtml(post, SB, fontCss());
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-v2-'));
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(scratch, 'reel.html'), html, 'utf8');

console.log(`\n🎬 ${post.slug} · ${SB.total}s @ ${fps}fps · ${SB.scenes.length} scenes`);

// Gate first — cheaper to fail here than after a 550-frame render.
process.stdout.write('   verifying frames … ');
const { samples, violations } = await verifyReel(html, {
  duration: SB.total, step: 0.2, width: REEL.width, height: REEL.height,
});
if (violations.length) {
  console.log(`\n\n❌ ${violations.length}/${samples} sampled frames out of spec:`);
  for (const v of violations.slice(0, 12)) console.log(`   t=${v.t}s · ${v.issues.join('; ')}`);
  process.exit(1);
}
console.log(`${samples} samples clean ✅`);

const t0 = Date.now();
const { pattern, count } = await renderFrames(html, {
  duration: SB.total, fps, width: REEL.width, height: REEL.height,
  outDir: path.join(scratch, 'frames'),
  onProgress: (n, tot) => process.stdout.write(`\r   frames ${n}/${tot}`),
});
console.log(`\r   frames ${count}/${count} — ${((Date.now() - t0) / 1000).toFixed(0)}s`);

const out = await encodeFrames({
  pattern, fps, duration: SB.total,
  outMp4: path.join(outDir, `${post.slug}-reel-v2.mp4`),
  coverJpg: path.join(outDir, `${post.slug}-cover-v2.jpg`),
  coverAt: 2.6,
});

console.log('   encoded:', await probe(out.file));
fs.rmSync(scratch, { recursive: true, force: true });
console.log(`\n✅ ${out.file}\n`);
