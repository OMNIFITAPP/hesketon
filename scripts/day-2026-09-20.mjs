#!/usr/bin/env node
// Two extra feed posts for Sunday 20.9 — 11:00 and 15:00 IDT (08:00Z, 12:00Z),
// asked for after the 14–20.9 batch never published and the account had been
// quiet for a week. Both episodes have never been a feed post.
//
//   node scripts/day-2026-09-20.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { loadQueue, saveQueue } from './lib/social/select.mjs';
import { renderSlides } from './lib/social/render.mjs';
import { buildQuoteCard, buildLessonsCarousel } from './lib/social/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.SOCIAL_PUBLIC_BASE || 'https://hesketon.co.il').replace(/\/$/, '');
const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
const need = (s) => { if (!bySlug[s]) throw new Error(`missing post: ${s}`); return bySlug[s]; };
const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

const POSTS = [
  {
    at: '2026-09-20T08:00:00.000Z', slug: 'vonda-wright-mobility-ageing-diary-of-a-ceo',
    format: 'quote', kicker: 'ציטוט',
    caption: `"אם אתה בן 80 שמרים משקולות באופן עקבי, אתה חזק תפקודית כמו אדם בן 60 שלא עושה את זה." 💪

ד"ר וונדה רייט אצל סטיבן ברטלט, והטענה המרכזית שלה: אין תירוץ להאט לפני אמצע שנות ה-70.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'וונדהרייט', 'ניידות', 'הזדקנות', 'כושר', 'בריאות', 'אריכותחיים'],
  },
  {
    at: '2026-09-20T12:00:00.000Z', slug: 'seth-godin-four-horsemen-mediocrity-bigdeal',
    format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `סת' גודין מונה ארבעה כוחות שמושכים אותנו לבינוניות: הכחשה, חוסר אונים, בוז ופחד. 🐎

והראשון הוא הפשוט מכולם: אם עשית מה שכולם עושים, אין צורך לחתום על זה בשם שלך.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'סתגודין', 'בינוניות', 'יצירתיות', 'עסקים', 'קריירה', 'אומץ'],
  },
];

const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);
const idOf = (p) => `2026-09-20_${p.format}-${p.slug.slice(0, 22)}`;
const ownIds = new Set(POSTS.map(idOf));
const prior = queue.items.filter((i) => !ownIds.has(i.id));
queue.items = [...prior];

for (const p of POSTS) {
  const post = need(p.slug);
  if (/פוליטיקה|politic/i.test([post.category, ...(post.tags || []), ...p.hashtags].join(' '))) throw new Error(`politics: ${p.slug}`);
  if (new Date(post.pubDate) > new Date(p.at)) throw new Error(`${p.slug}: blog goes live after its IG slot`);
  const clash = prior.find((i) => i.slug === p.slug && i.format !== 'reel' && i.format !== 'story');
  if (clash) throw new Error(`${p.slug} was already a feed post (${clash.id})`);
}
console.log('✓ no politics · blog live first · never a feed post\n');

const outRoot = path.join(ROOT, 'public/social');
for (const p of POSTS) {
  const post = need(p.slug);
  const id = idOf(p);
  const slides = p.format === 'quote' ? buildQuoteCard(post, { kicker: p.kicker }) : buildLessonsCarousel(post, { kicker: p.kicker });
  const files = await renderSlides(slides, path.join(outRoot, id), p.slug);
  queue.items.push({
    id, slug: p.slug, platform: 'instagram', format: p.format, kicker: p.kicker,
    scheduledFor: p.at, status: 'approved',
    caption: p.caption, hashtags: p.hashtags.map(cleanTag),
    assets: files.map((f) => `${BASE}/social/${id}/${path.basename(f)}`), permalink: '',
  });
  saveQueue(queueFile, queue);
  const il = new Date(p.at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
  console.log(`🖼  ${il} ${p.format.padEnd(8)} ${p.slug.slice(0, 34).padEnd(36)} ${files.length} slides`);
}
console.log('\n✅ queue updated');
