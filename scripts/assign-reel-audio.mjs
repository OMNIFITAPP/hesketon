#!/usr/bin/env node
// Attach a licensed Instagram track to each reel, chosen to match the
// episode's mood. Also re-renders (silent) any reel that still carries the
// old synthesized bed, and requeues the already-published Tim Ferriss reel
// so it can go out again once the original is deleted in-app.
//
// Everything stays on `hold` — release with --approve after review.

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
const approve = process.argv.includes('--approve');

// slug → { audioId, title, artist }
const PICKS = {
  'tim-ferriss-stuck-brain-fuel-decisions':
    { audioId: '692868096200013', title: 'Echoes Of Us (Instrumental)', artist: 'Giulio Cercato' },
  'tommy-wood-future-proof-brain':
    { audioId: '1301427616977145', title: 'Endosymbiosis', artist: 'Makana' },
  'andy-stumpf-psychology-of-endurance-williamson':
    { audioId: '974432747187721', title: 'Road Warriors', artist: 'Giulio Cercato' },
  'tony-robbins-ai-future-of-work-meaning':
    { audioId: '627735556288874', title: 'Pulse Of Innovation', artist: 'Giulio Cercato' },
  'vinh-giang-voice-communication-skills':
    { audioId: '872667339759392', title: 'Beautiful Sunrise', artist: 'Christian Davis' },
  'kevin-oleary-wealth-discipline-diary-of-a-ceo':
    { audioId: '1621000558910293', title: 'Do Things Different (Instrumental)', artist: 'Sbvce' },
  'andy-galpin-fitness-principles-rich-roll':
    { audioId: '9513789255356881', title: 'Power On (Instrumental)', artist: 'Giulio Cercato' },
};

// The published Tim Ferriss reel is being deleted in-app, so it goes back in
// the queue after the rest of the run rather than colliding with a slot.
const REQUEUE = {
  'tim-ferriss-stuck-brain-fuel-decisions': '2026-07-28T10:00:00.000Z',
};

const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));

const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);
const reels = queue.items.filter((i) => i.format === 'reel');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-audio-'));

for (const item of reels) {
  const pick = PICKS[item.slug];
  if (!pick) {
    console.log(`… ${item.id}: no pick, skipped`);
    continue;
  }

  // Only the already-published one still has the synth bed baked in.
  const needsRerender = item.status === 'published';
  if (needsRerender) {
    const post = bySlug[item.slug];
    const scenes = buildReelScenes(post, { kicker: 'ציטוט', beats: 3 });
    const files = await renderSlides(scenes, path.join(scratch, item.id), item.slug);
    const out = await makeReel({
      sceneFiles: files,
      durations: scenes.map((s) => s.seconds),
      crossfade: 0.5,
      silent: true,
      outMp4: path.join(ROOT, 'public/social', item.id, `${item.slug}-reel.mp4`),
      coverJpg: path.join(ROOT, 'public/social', item.id, `${item.slug}-cover.jpg`),
    });
    const info = await probe(out.file);
    console.log(`  ↻ re-rendered silent · ${info.audio}`);

    // Clear the previous publication so the publisher treats it as fresh.
    delete item.permalink;
    delete item.mediaId;
    delete item.publishedAt;
    delete item.error;
  }

  if (REQUEUE[item.slug]) item.scheduledFor = REQUEUE[item.slug];
  item.audio = { audioId: pick.audioId, audioVolume: 100, videoVolume: 0 };
  item.status = approve ? 'approved' : 'hold';

  console.log(`✔ ${item.scheduledFor.slice(0, 10)} ${item.slug.slice(0, 30).padEnd(32)} → ${pick.title} — ${pick.artist} [${item.status}]`);
}

fs.rmSync(scratch, { recursive: true, force: true });
saveQueue(queueFile, queue);
console.log(`\n✅ audio assigned to ${reels.length} reels${approve ? ' — RELEASED' : ' — still on hold'}`);
