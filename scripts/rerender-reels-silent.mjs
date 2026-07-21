#!/usr/bin/env node
// Re-render every not-yet-published reel in the queue with a SILENT audio
// track, so a licensed Instagram track can be attached at publish time.
//
// Optionally attach that track and release the items in one pass:
//   node scripts/rerender-reels-silent.mjs --audio-id=1234567890 --approve
//
// Without --approve the items stay on hold (nothing publishes).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { loadQueue, saveQueue } from './lib/social/select.mjs';
import { buildReelScenes } from './lib/social/templates-reel.mjs';
import { renderSlides } from './lib/social/render.mjs';
import { makeReel, probe } from './lib/social/video.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const audioId = (args.find((a) => a.startsWith('--audio-id=')) || '').split('=')[1] || '';
const approve = args.includes('--approve');

const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);
const targets = queue.items.filter((i) => i.format === 'reel' && i.status !== 'published');

if (!targets.length) {
  console.log('No unpublished reels to re-render.');
  process.exit(0);
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-reels-'));

for (const item of targets) {
  const post = bySlug[item.slug];
  if (!post) throw new Error(`missing post: ${item.slug}`);

  const scenes = buildReelScenes(post, { kicker: 'ציטוט', beats: 3 });
  const files = await renderSlides(scenes, path.join(scratch, item.id), item.slug);

  const outDir = path.join(ROOT, 'public/social', item.id);
  const out = await makeReel({
    sceneFiles: files,
    durations: scenes.map((s) => s.seconds),
    crossfade: 0.5,
    silent: true,
    outMp4: path.join(outDir, `${item.slug}-reel.mp4`),
    coverJpg: path.join(outDir, `${item.slug}-cover.jpg`),
  });
  const info = await probe(out.file);

  if (audioId) item.audio = { audioId, audioVolume: 100, videoVolume: 0 };
  if (approve) item.status = 'approved';

  console.log(`✔ ${item.id} · ${info.duration.toFixed(1)}s · ${info.sizeMB}MB · audio=${info.audio}${audioId ? ` · ig_audio=${audioId}` : ''} · ${item.status}`);
}

fs.rmSync(scratch, { recursive: true, force: true });
saveQueue(queueFile, queue);
console.log(`\n✅ re-rendered ${targets.length} reels (silent)${approve ? ' and released' : ' — still on hold'}`);
