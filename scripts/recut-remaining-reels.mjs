#!/usr/bin/env node
// Re-cut the reels that have NOT published yet, applying Roei's 2026-08-04
// review: slower pacing, no word-overlap on the keyword pop, and a fresh
// track per reel.
//
//   node scripts/recut-remaining-reels.mjs
//
// Published items are never touched — audio and video on a live post cannot
// be changed anyway, and re-rendering them would only churn the repo.
//
// Storyboards are read back out of batch-week-2026-08-02.mjs so there is one
// source of truth for the copy.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { loadQueue, saveQueue } from './lib/social/select.mjs';
import { fontCss } from './lib/social/render.mjs';
import { buildReelHtml, layoutTimeline, REEL } from './lib/social/reel-v2.mjs';
import { renderFrames } from './lib/social/frames.mjs';
import { verifyReel } from './lib/social/verify-reel.mjs';
import { encodeFrames, probe } from './lib/social/video.mjs';
import { assertFresh, trackTitle, freshTracks } from './lib/social/pick-audio.mjs';
import { REELS } from './week-storyboards.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.SOCIAL_PUBLIC_BASE || 'https://hesketon.co.il').replace(/\/$/, '');
const FPS = 30;

// Fresh track per remaining reel, chosen to suit the episode.
const NEW_AUDIO = {
  'rick-rubin-creativity-huberman': '1274816823458500',                 // Sun Dogs — Jayme Stone
  'andrew-huberman-neuroplasticity-focus-rich-roll': '1164507397875809', // Echoes — HME
  'ray-dalio-decline-smart-rabbit-bartlett': '329870317688702',          // Something's Coming — Charlie Peacock
  'creatine-dosing-myths-candow': '816696039610874',                     // Even The Sun — Otis McDonald
};

const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);

const targets = queue.items.filter((i) => i.format === 'reel' && i.status !== 'published' && NEW_AUDIO[i.slug]);
if (!targets.length) { console.log('nothing to re-cut'); process.exit(0); }

// Freshness is checked against the queue with the OLD ids still in place, so
// the tracks we're replacing don't accidentally count as "already used".
const stale = new Set(targets.map((t) => t.id));
const checkQueue = { items: queue.items.filter((i) => !stale.has(i.id)) };
assertFresh(checkQueue, Object.values(NEW_AUDIO));
console.log(`${freshTracks(checkQueue).length} unused tracks in pool\n`);

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-recut-'));
const css = fontCss();

for (const item of targets) {
  const sb0 = REELS.find((r) => r.slug === item.slug);
  if (!sb0) throw new Error(`no storyboard for ${item.slug}`);
  const post = bySlug[item.slug];

  const tl = layoutTimeline(sb0.scenes, post);
  const sb = { total: tl.total, kicker: sb0.kicker, scenes: tl.scenes };
  const html = buildReelHtml(post, sb, css);

  const { samples, violations } = await verifyReel(html, {
    duration: sb.total, step: 0.25, width: REEL.width, height: REEL.height,
  });
  if (violations.length) {
    console.log(`\n❌ ${item.id}: ${violations.length}/${samples} frames out of spec`);
    for (const v of violations.slice(0, 8)) console.log(`   t=${v.t}s · ${v.issues.join('; ')}`);
    process.exit(1);
  }

  const { pattern } = await renderFrames(html, {
    duration: sb.total, fps: FPS, width: REEL.width, height: REEL.height,
    outDir: path.join(scratch, item.id),
  });
  const outDir = path.join(ROOT, 'public/social', item.id);
  const out = await encodeFrames({
    pattern, fps: FPS, duration: sb.total,
    outMp4: path.join(outDir, `${item.slug}-reel.mp4`),
    coverJpg: path.join(outDir, `${item.slug}-cover.jpg`),
    coverAt: Math.min(3.2, sb.total / 4),
  });
  const info = await probe(out.file);

  const audioId = NEW_AUDIO[item.slug];
  item.audio = { audioId, audioVolume: 100, videoVolume: 0 };
  item.assets = [`${BASE}/social/${item.id}/${path.basename(out.file)}`];
  item.cover = `${BASE}/social/${item.id}/${path.basename(out.cover)}`;

  const beats = sb.scenes.map((s) => (s.out - s.in).toFixed(1)).join('/');
  console.log(`🎬 ${item.scheduledFor.slice(0, 10)} ${item.slug.slice(0, 30)}`);
  console.log(`   ${info.duration}s  [${beats}]  ${info.sizeMB}MB  gate ${samples} clean`);
  console.log(`   ♪ ${trackTitle(audioId)}`);
}

fs.rmSync(scratch, { recursive: true, force: true });
saveQueue(queueFile, queue);
console.log('\n✅ re-cut complete');
