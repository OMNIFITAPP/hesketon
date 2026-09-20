#!/usr/bin/env node
// Week of 2026-09-21 → 09-27.
//
// The other 19 items of this week are the 14–20.9 batch, re-dated by +7 days
// after PR #40 went unmerged and that week never published. Their assets were
// already rendered and gated, so they were carried over rather than rebuilt.
// This script adds the two slots that batch could not fill:
//
//   Mon 21, 09:00  James Clear myth   — owed from Monday 14.9, whose 09:00 had
//                                       passed by the time the batch was built
//   Mon 21, 13:00  Martin Picard      — his post only went live 20.9 18:00, so
//                                       no 13:00 slot could carry it last week
//
//   node scripts/week-2026-09-21.mjs [--only=myth|reels]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { loadQueue, saveQueue } from './lib/social/select.mjs';
import { fontCss } from './lib/social/render.mjs';
import { buildReelHtml, layoutTimeline, coverTime, REEL } from './lib/social/reel-v2.mjs';
import { renderFrames } from './lib/social/frames.mjs';
import { verifyReel } from './lib/social/verify-reel.mjs';
import { encodeFrames, probe } from './lib/social/video.mjs';
import { assertFresh, trackTitle, freshTracks } from './lib/social/pick-audio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.SOCIAL_PUBLIC_BASE || 'https://hesketon.co.il').replace(/\/$/, '');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || 'all';
const FPS = 30;

const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
const need = (s) => { if (!bySlug[s]) throw new Error(`missing post: ${s}`); return bySlug[s]; };
const at = (day, hhmmZ) => `2026-09-${day}T${hhmmZ}:00.000Z`;
const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

const MYTHS = [
  {
    day: '21', slug: 'james-clear-habits-getting-started-huberman',
    myth: 'הרגלים נבנים בימים הטובים.',
    reality: 'הימים הרעים חשובים מהטובים — שם נוצר הפער.',
    context: 'אין זמן? עשו את הגרסה הקצרה. אל תרשמו אפס.',
    audioId: '1189887502462489',
    caption: `מיתוס ↔ מציאות 🏋️

"המשקל הכבד ביותר בחדר הכושר הוא דלת הכניסה."

ג'יימס קליר אצל אנדרו הוברמן: הימים הרעים חשובים מהטובים — כי בימים הטובים כולם מתאמנים, ושם לא נוצר הפער.

ועקביות אינה נוקשות אלא הסתגלות: אין זמן — עשו את הגרסה הקצרה. אל תרשמו אפס.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גיימסקליר', 'הרגלים', 'הוברמן', 'עקביות', 'מיינדסט', 'מיתוסים'],
  },
];

const REELS = [
  {
    day: '21', slug: 'martin-picard-mitochondria-grey-hair-huberman', audioId: '361395693422150',
    scenes: [
      { type: 'type', text: 'האם הזדקנות היא קו ישר?', bare: true, progress: false },
      { type: 'line', text: 'שיער אפור יכול לחזור לצבעו — לפחות באופן זמני.' },
      { type: 'mark', text: 'לכל השערות באותו ראש יש אותו גנום ואותה תזונה.', key: 'גנום' },
      { type: 'pop', text: 'ובכל זאת הן מלבינות בגילים שונים לגמרי.', key: 'שונים' },
      { type: 'line', text: 'הגנים מסבירים, לדבריו, לא יותר מעשרה אחוזים מאורך החיים.' },
      { type: 'line', text: 'ההבדל בין אדם חי לגופה: האנרגיה זורמת.', invert: true },
      { type: 'cta' },
    ],
    caption: `"גילינו שהלבנת שיער, לפחות באופן זמני, היא הפיכה." 🧬

מרטין פיקארד אצל אנדרו הוברמן. הסיבה שבחרו דווקא בשיער: לכל השערות על אותו ראש יש אותו גנום, אותה תזונה ואותו לחץ — ובכל זאת הן מלבינות בגילים שונים לגמרי.

ולדבריו, הגנים מסבירים לא יותר מעשרה אחוזים מאורך החיים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מרטיןפיקארד', 'הוברמן', 'הזדקנות', 'מיטוכונדריה', 'אריכותחיים', 'מדע'],
  },
];

// ── guards ──────────────────────────────────────────────────
const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);
const mythId = (m) => `2026-09-${m.day}_myth-${m.slug.slice(0, 24)}`;
const reelId = (r) => `2026-09-${r.day}_reelv2-${r.slug.slice(0, 22)}`;
const builds = (s) => only === 'all' || only === s;
const ownIds = new Set([...MYTHS.map(mythId), ...REELS.map(reelId)]);
const priorQueue = { items: queue.items.filter((i) => !ownIds.has(i.id)) };
queue.items = queue.items.filter((i) => !ownIds.has(i.id));

assertFresh(priorQueue, [...(builds('myth') ? MYTHS : []), ...(builds('reels') ? REELS : [])].map((r) => r.audioId));

for (const x of [...MYTHS, ...REELS]) {
  const post = need(x.slug);
  if (/פוליטיקה|politic/i.test([post.category, ...(post.tags || []), ...x.hashtags].join(' '))) throw new Error(`politics: ${x.slug}`);
}
const live = (x, when) => {
  const pub = new Date(need(x.slug).pubDate);
  if (pub > new Date(when)) throw new Error(`${x.slug}: blog goes live ${pub.toISOString()}, after its IG slot ${when}`);
};
MYTHS.forEach((m) => live(m, at(m.day, '06:00')));
REELS.forEach((r) => live(r, at(r.day, '10:00')));

const priorReels = priorQueue.items.filter((i) => i.format === 'reel');
const isMythItem = (i) => i.kicker === 'מיתוס ↔ מציאות';
for (const r of REELS) {
  const used = priorReels.find((i) => i.slug === r.slug);
  if (used) throw new Error(`digest ${r.slug} was already a reel (${used.id})`);
}
for (const m of MYTHS) {
  if (priorReels.some((i) => i.slug === m.slug && isMythItem(i))) throw new Error(`myth ${m.slug} was already a myth reel`);
  const digests = priorReels.filter((i) => i.slug === m.slug && !isMythItem(i)).map((i) => new Date(i.scheduledFor));
  if (!digests.length) throw new Error(`myth ${m.slug} has no earlier digest reel`);
  const gap = (new Date(at(m.day, '06:00')) - Math.max(...digests)) / 864e5;
  if (gap < 27.5) throw new Error(`myth ${m.slug}: digest only ${gap.toFixed(1)} days earlier`);
}
console.log(`✓ audio fresh (${freshTracks(priorQueue).length} unused) · no politics · blog live first · runway rules\n`);

const outRoot = path.join(ROOT, 'public/social');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-w4-'));
const css = fontCss();

async function cutReel({ id, post, scenes, kicker, coverScene = 1 }) {
  const tl = layoutTimeline(scenes, post);
  const sb = { total: tl.total, kicker, scenes: tl.scenes };
  const html = buildReelHtml(post, sb, css);
  const { samples, violations } = await verifyReel(html, { duration: sb.total, step: 0.25, width: REEL.width, height: REEL.height });
  if (violations.length) {
    console.log(`\n❌ ${id}: ${violations.length}/${samples} frames out of spec`);
    for (const v of violations.slice(0, 8)) console.log(`   t=${v.t}s · ${v.issues.join('; ')}`);
    process.exit(1);
  }
  const { pattern } = await renderFrames(html, { duration: sb.total, fps: FPS, width: REEL.width, height: REEL.height, outDir: path.join(scratch, id) });
  const out = await encodeFrames({
    pattern, fps: FPS, duration: sb.total,
    outMp4: path.join(outRoot, id, `${post.slug}-reel.mp4`),
    coverJpg: path.join(outRoot, id, `${post.slug}-cover.jpg`),
    coverAt: coverTime(sb.scenes, coverScene),
  });
  fs.rmSync(path.join(scratch, id), { recursive: true, force: true });
  return { out, sb, samples, info: await probe(out.file) };
}

function push({ id, slug, kicker, when, caption, hashtags, out, audioId }) {
  queue.items.push({
    id, slug, platform: 'instagram', format: 'reel', kicker,
    scheduledFor: when, status: 'approved',
    caption, hashtags: hashtags.map(cleanTag),
    assets: [`${BASE}/social/${id}/${path.basename(out.file)}`],
    permalink: '',
    cover: `${BASE}/social/${id}/${path.basename(out.cover)}`,
    audio: { audioId, audioVolume: 100, videoVolume: 0 },
  });
  saveQueue(queueFile, queue);
}

if (builds('myth')) {
  for (const m of MYTHS) {
    const post = need(m.slug); const id = mythId(m);
    const scenes = [
      { type: 'myth', kicker: 'מיתוס', text: m.myth },
      { type: 'line', kicker: 'מציאות', text: m.reality, invert: true },
      { type: 'line', kicker: 'מציאות', text: m.context },
      { type: 'cta', kicker: 'הסכתון', progress: false },
    ];
    const { out, sb, samples, info } = await cutReel({ id, post, scenes, kicker: 'מיתוס', coverScene: 1 });
    push({ id, slug: m.slug, kicker: 'מיתוס ↔ מציאות', when: at(m.day, '06:00'), caption: m.caption, hashtags: m.hashtags, out, audioId: m.audioId });
    console.log(`💭 09:00 ${m.day}.9 ${m.slug.slice(0, 26).padEnd(28)} ${info.duration}s [${sb.scenes.map((s) => (s.out - s.in).toFixed(1)).join('/')}] gate ${samples} ♪ ${trackTitle(m.audioId)}`);
  }
}

if (builds('reels')) {
  for (const r of REELS) {
    const post = need(r.slug); const id = reelId(r);
    const { out, sb, samples, info } = await cutReel({ id, post, scenes: r.scenes, kicker: 'אמ;לק' });
    push({ id, slug: r.slug, kicker: 'ריל', when: at(r.day, '10:00'), caption: r.caption, hashtags: r.hashtags, out, audioId: r.audioId });
    console.log(`🎬 13:00 ${r.day}.9 ${r.slug.slice(0, 26).padEnd(28)} ${info.duration}s [${sb.scenes.map((s) => (s.out - s.in).toFixed(1)).join('/')}] gate ${samples} ♪ ${trackTitle(r.audioId)}`);
  }
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log('\n✅ queue updated');
