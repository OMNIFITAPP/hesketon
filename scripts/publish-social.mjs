#!/usr/bin/env node
// ============================================================
//  הסכתון — social publisher (Instagram, Phase A)
//
//  Reads social-queue.yml and publishes every item that is:
//    • approved (or pending_review that reached main via a merged PR),
//    • due (scheduledFor <= now),
//    • not yet published, and not on hold.
//  Then flips it to status: published with a permalink.
//
//  "Merge the PR = approve."  To veto a single staged item before
//  merging, set its status to "hold".
//
//  Usage:
//    npm run social:publish        # real (needs IG_USER_ID + IG_ACCESS_TOKEN)
//    npm run social:publish:dry    # verify creds + list due items, post nothing
// ============================================================

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQueue, saveQueue } from './lib/social/select.mjs';
import { composeCaption } from './lib/social/caption.mjs';
import * as ig from './lib/social/platforms/instagram.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE_FILE = path.join(ROOT, 'social-queue.yml');
const DRY = process.argv.includes('--dry-run');
const log = (...a) => console.log(...a);

const ADAPTERS = { instagram: ig };

function isPublishable(item, now) {
  if (item.status === 'published' || item.status === 'hold') return false;
  if (!['approved', 'pending_review'].includes(item.status)) return false;
  if (!item.assets?.length) return false;
  return new Date(item.scheduledFor).getTime() <= now;
}

async function publishItem(item) {
  const adapter = ADAPTERS[item.platform];
  if (!adapter) throw new Error(`No adapter for platform "${item.platform}"`);
  const caption = composeCaption({ caption: item.caption, hashtags: item.hashtags });

  switch (item.format) {
    case 'carousel':
    case 'lessons':
      if (item.assets.length === 1) return adapter.publishImage(item.assets[0], caption);
      return adapter.publishCarousel(item.assets, caption);
    case 'quote':
      return adapter.publishImage(item.assets[0], caption);
    case 'story':
      return adapter.publishStory(item.assets[0]);
    case 'reel':
      return adapter.publishReel(item.assets[0], caption);
    default:
      throw new Error(`Unknown format "${item.format}"`);
  }
}

async function main() {
  log(`\n🚀 הסכתון — מפרסם לרשתות ${DRY ? '(dry-run)' : ''}\n`);

  // Dry-run always verifies the IG credentials, even with an empty queue —
  // this is the fastest way to confirm IG_USER_ID/IG_ACCESS_TOKEN are wired
  // correctly right after setup, before any post is actually due.
  if (DRY) {
    try {
      const me = await ig.whoami();
      log(`חשבון IG מחובר: @${me.username || '?'} (${me.name || ''})`);
    } catch (err) {
      log(`⚠️  בדיקת חיבור נכשלה: ${err.message}`);
    }
  }

  const queue = loadQueue(QUEUE_FILE);
  const now = Date.now();
  const due = queue.items.filter((it) => isPublishable(it, now));

  if (!due.length) {
    log('אין פריטים שבשלים לפרסום כרגע.');
    return;
  }
  log(`${due.length} פריטים בשלים לפרסום.`);

  if (DRY) {
    for (const it of due) log(`  - [${it.format}] ${it.slug} · ${it.assets.length} נכסים → היה מתפרסם עכשיו`);
    log('\n(dry-run — לא פורסם דבר.)');
    return;
  }

  let changed = false;
  for (const item of due) {
    try {
      log(`\n• מפרסם [${item.format}] ${item.slug} …`);
      const { mediaId, permalink } = await publishItem(item);
      item.status = 'published';
      item.publishedAt = new Date().toISOString();
      item.mediaId = mediaId;
      item.permalink = permalink || '';
      changed = true;
      log(`  ✅ פורסם · ${permalink || mediaId}`);
    } catch (err) {
      item.status = 'failed';
      item.error = err.message;
      changed = true;
      log(`  ❌ נכשל: ${err.message}`);
    }
  }

  if (changed) saveQueue(QUEUE_FILE, queue);
  log('\nסיום.');
}

main().catch((err) => {
  console.error('\n❌ שגיאה:', err.message);
  process.exit(1);
});
