#!/usr/bin/env node
// Watchdog. On 14–20.9 the whole week sat unmerged on a branch: the publisher
// found nothing due, reported success 41 times, and the account went quiet for
// seven days without a single red mark anywhere. An empty queue and a healthy
// queue looked identical. This makes silence fail loudly.
//
//   node scripts/check-queue.mjs     → exit 1 with a reason, or "ok"

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQueue } from './lib/social/select.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const items = loadQueue(path.join(ROOT, 'social-queue.yml')).items;
const now = Date.now();
const HOUR = 36e5;
const when = (i) => new Date(i.scheduledFor).getTime();
const live = (i) => ['approved', 'pending_review'].includes(i.status);

const problems = [];

const failed = items.filter((i) => i.status === 'failed');
if (failed.length) problems.push(`${failed.length} item(s) failed to publish: ${failed.map((i) => i.id).join(', ')}`);

const overdue = items.filter((i) => live(i) && when(i) < now - 2 * HOUR);
if (overdue.length) problems.push(`${overdue.length} item(s) overdue by more than 2h — is the queue merged to main? ${overdue.map((i) => i.id).slice(0, 5).join(', ')}`);

const upcoming = items.filter((i) => live(i) && when(i) >= now && when(i) <= now + 48 * HOUR);
if (!upcoming.length) problems.push('nothing approved is scheduled in the next 48h — the account will go quiet');

const lastPublished = items.filter((i) => i.status === 'published' && i.publishedAt)
  .map((i) => new Date(i.publishedAt).getTime()).sort((a, b) => b - a)[0];
if (lastPublished && now - lastPublished > 36 * HOUR) {
  problems.push(`nothing has published in ${Math.floor((now - lastPublished) / HOUR)}h (last: ${new Date(lastPublished).toISOString()})`);
}

if (problems.length) {
  console.error('❌ social queue needs attention:\n' + problems.map((p) => `  · ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ queue ok · ${upcoming.length} item(s) due in the next 48h`);
