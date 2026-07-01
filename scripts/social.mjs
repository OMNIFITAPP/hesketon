#!/usr/bin/env node
// ============================================================
//  הסכתון — social content generator (Instagram, Phase A)
//
//  Turns published posts into Instagram assets on a weekly plan, then
//  stages them for approval. It does NOT post anything — publishing is
//  a separate, approval-gated step (scripts/publish-social.mjs).
//
//  For each weekly slot:
//    pick an unused published post → render branded PNG slides into
//    public/social/<id>/ → write a Hebrew caption → add a queue item
//    (status: pending_review) to social-queue.yml.
//
//  Usage:
//    npm run social         # real run (renders + captions via Claude)
//    npm run social:dry     # preview: offline captions, renders to
//                           # .social-preview/, leaves the queue untouched
// ============================================================

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { planWeek, loadQueue, saveQueue } from './lib/social/select.mjs';
import {
  buildCarousel,
  buildLessonsCarousel,
  buildQuoteCard,
  buildStory,
} from './lib/social/templates.mjs';
import { renderSlides } from './lib/social/render.mjs';
import { generateCaption, composeCaption } from './lib/social/caption.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const QUEUE_FILE = path.join(ROOT, 'social-queue.yml');
const PUBLIC_DIR = path.join(ROOT, 'public/social');
const PREVIEW_DIR = path.join(ROOT, '.social-preview');

const DRY = process.argv.includes('--dry-run');
const BASE = (process.env.SOCIAL_PUBLIC_BASE || 'https://hesketon.co.il').replace(/\/$/, '');

const log = (...a) => console.log(...a);

function buildSlides(post, format, kicker) {
  switch (format) {
    case 'carousel': return buildCarousel(post, { kicker });
    case 'lessons': return buildLessonsCarousel(post, { kicker });
    case 'quote': return buildQuoteCard(post, { kicker });
    case 'story': return buildStory(post);
    default: throw new Error(`Unknown format: ${format}`);
  }
}

async function main() {
  log(`\n📣 הסכתון — מחולל תוכן לרשתות ${DRY ? '(dry-run)' : ''}\n`);

  const posts = loadPublishedPosts(POSTS_DIR);
  if (!posts.length) {
    log('אין פוסטים מפורסמים (draft:false). אין מה לתזמן.');
    return;
  }
  log(`נמצאו ${posts.length} פוסטים מפורסמים.`);

  const queue = loadQueue(QUEUE_FILE);
  const planned = planWeek({ posts, queue, now: new Date() });
  if (!planned.length) {
    log('כל הסלוטים השבוע כבר מתוכננים, או שאזל החומר הטרי. אין מה להוסיף.');
    return;
  }

  const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
  const outRoot = DRY ? PREVIEW_DIR : PUBLIC_DIR;

  for (const item of planned) {
    const post = bySlug[item.slug];
    log(`\n• ${item.format.padEnd(9)} → ${post.slug}`);

    // 1) render slides
    const slides = buildSlides(post, item.format, item.kicker);
    const outDir = path.join(outRoot, item.id);
    const files = await renderSlides(slides, outDir, item.slug);
    log(`  ↳ נוצרו ${files.length} תמונות`);

    // 2) public URLs (where they'll be served from after deploy)
    item.assets = files.map((f) => `${BASE}/social/${item.id}/${path.basename(f)}`);

    // 3) caption
    const cap = await generateCaption({ post, format: item.format, offline: DRY });
    item.caption = cap.caption;
    item.hashtags = cap.hashtags;
    log(`  ↳ כיתוב: ${item.caption.split('\n')[0].slice(0, 60)}…`);
  }

  if (DRY) {
    log(`\n🔎 dry-run — לא נכתב ל-${path.basename(QUEUE_FILE)}. תצוגה מקדימה ב-${path.relative(ROOT, PREVIEW_DIR)}/`);
    log('פריטים שהיו נוספים לתור:');
    for (const it of planned) {
      log(`  - [${it.format}] ${it.slug} @ ${it.scheduledFor} · ${it.assets.length} תמונות`);
    }
    return;
  }

  queue.items.push(...planned);
  saveQueue(QUEUE_FILE, queue);
  log(`\n✅ נוספו ${planned.length} פריטים ל-${path.basename(QUEUE_FILE)} (status: pending_review).`);
  log('בדקו את ה-PR, ערכו אם צריך, ומזגו כדי לאשר לפרסום.');
}

main().catch((err) => {
  console.error('\n❌ שגיאה:', err.message);
  process.exit(1);
});

// Exposed for the publisher (final caption text per item).
export { composeCaption };
