#!/usr/bin/env node
// Weekend 3–4.10 + week of 5.10 → 11.10.
//
// PR #42 (28.9–4.10) was never merged, so nothing published that week. Its 16
// items were carried over rather than rebuilt: Sat 3 / Sun 4 kept their slots,
// Mon 28.9 – Fri 2.10 moved +7 days. This script adds what that batch lacked:
//
//   13:00  three digests from the episodes the blog added since 26.9
//          (Seelig Sat 3, Sanchez Sun 4, Thaller Tue 6)
//   09:00  myths for Sat 10 and Sun 11 (Kendrick Lamar, Jensen Huang)
//   20:00  posts for Sat 10 and Sun 11 (Liemandt carousel, Willink quote)
//
//   node scripts/week-2026-10-05.mjs [--only=myth|reels|posts]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { loadQueue, saveQueue } from './lib/social/select.mjs';
import { fontCss, renderSlides } from './lib/social/render.mjs';
import { buildCarousel, buildQuoteCard, buildLessonsCarousel } from './lib/social/templates.mjs';
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

const MO = (x) => x.month || '10';
const at = (day, hhmmZ, month = '10') => `2026-${month}-${day}T${hhmmZ}:00.000Z`;
const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

// ── מיתוס ↔ מציאות (09:00) — the two slots the carried-over batch lacked ──
const MYTHS = [
  {
    day: '10', slug: 'kendrick-lamar-rick-rubin-creative-process',
    myth: `כדי להצליח צריך לכתוב בשביל הקהל.`,
    reality: `קנדריק לאמאר הפסיק לחשוב על המאזין.`,
    context: `השיר שבו ראפרף בלי חשבון התחבר יותר מהלהיטים שהונדסו לרדיו.`,
    audioId: '472437631290189',
    caption: `מיתוס ↔ מציאות 🎤

"אם אמרתי את זה בתקליט — אני לעולם לא חוזר בי מדבריי."

קנדריק לאמאר בשיחה עם ריק רובין: הוא הפסיק לחשוב על המאזין. בלי השראה אמיתית, אין מוזיקה.

והראיה שלו: השיר שבו הוא פשוט ראפרף בלי חשבון התחבר יותר מהלהיטים שהונדסו לרדיו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קנדריקלאמאר', 'ריקרובין', 'יצירתיות', 'מוזיקה', 'השראה', 'מיתוסים'],
  },
  {
    day: '11', slug: 'jensen-huang-nvidia-vision-future',
    myth: `הצלחה כמו של NVIDIA היא עניין של תזמון.`,
    reality: `NVIDIA השקיעה עשרות מיליארדים עשור שלם לפני שזה השתלם.`,
    context: `"בסוף אתה חייב להאמין במשהו."`,
    audioId: '2846867285481429',
    caption: `מיתוס ↔ מציאות 🚀

ג'נסן הואנג אצל קלאו אברם: NVIDIA השקיעה עשרות מיליארדים במשך עשור לפני שזה השתלם — "כי בסוף אתה חייב להאמין במשהו".

וההצתה עצמה הייתה תובנה פשוטה: בכל תוכנה, כ-10% מהקוד מבצע 99% מהעבודה — ואותו אפשר להריץ במקביל.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גנסןהואנג', 'אנבידיה', 'יזמות', 'טכנולוגיה', 'בינהמלאכותית', 'מיתוסים'],
  },
];

// ── digest reels (13:00) — the three episodes the blog added since 26.9 ──
const REELS = [
  {
    day: '03', slug: 'tina-seelig-luck-sailboat-mel-robbins', audioId: '492855763044836',
    scenes: [
      { type: 'type', text: `מזל הוא עניין של מקרה?`, bare: true, progress: false },
      { type: 'line', text: `טינה סיליג: מזל הוא לא מה שקורה לכם — אלא איך אתם מגיבים.` },
      { type: 'mark', text: `לדבריה, כל העניין נמצא במילה אחת: "לכאורה".`, key: 'לכאורה' },
      { type: 'pop', text: `ההזדמנויות נושבות כל הזמן, כמו רוח.`, key: 'רוח' },
      { type: 'line', text: `השאלה: סגרתם את התריסים, רק הסתכלתם — או בניתם מפרש?` },
      { type: 'line', text: `אנחנו תמיד במרחק החלטה אחת מחיים אחרים לגמרי.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"אנחנו תמיד במרחק החלטה אחת מחיים אחרים לגמרי." ⛵

טינה סיליג אצל מל רובינס. היא מבחינה בין נסיבות — מה שקורה לכם — לבין מזל, שהוא מה שבשליטתכם: איך אתם מגיבים למה שקרה.

ההזדמנויות, לדבריה, נושבות כל הזמן כמו רוח. והצעד הראשון שהיא ממליצה עליו לשבוע הקרוב: לעשות דבר אחד חדש שיערבב את הקלפים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'טינהסיליג', 'מלרובינס', 'מזל', 'קריירה', 'הזדמנויות', 'מיינדסט'],
  },
  {
    day: '04', slug: 'codie-sanchez-ownership-without-capital-diary-of-a-ceo', audioId: '660037926613998',
    scenes: [
      { type: 'type', text: `אפשר לקנות עסק בלי הון?`, bare: true, progress: false },
      { type: 'line', text: `קודי סאנצ'ז: הדרך היחידה לחופש היא דרך בעלות.` },
      { type: 'stat', value: '3', text: `דרכים לקנות עסק: כסף, מומחיות או זמן.` },
      { type: 'mark', text: `ורק אחת מהן דורשת הון.`, key: 'אחת' },
      { type: 'pop', text: `עסק בלי 20–30% הפניות מלקוחות? זו לא בעיית שיווק.`, key: 'שיווק' },
      { type: 'line', text: `זו בעיית מוצר.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"הדרך היחידה לחופש היא דרך בעלות, והעולם לא רוצה לתת לכם אותה." 🔑

קודי סאנצ'ז אצל סטיבן ברטלט. לדבריה יש שלוש דרכים לקנות עסק — כסף, מומחיות או זמן — ורק אחת מהן דורשת הון.

ועוד כלל אצבע שלה: אם אין לעסק 20–30% הפניות או ביקורות מלקוחות, אין לו בעיית שיווק. יש לו בעיית מוצר.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קודיסאנצז', 'סטיבןברטלט', 'בעלות', 'עסקים', 'יזמות', 'קריירה'],
  },
  {
    day: '06', slug: 'michelle-thaller-universe-not-built-for-us-big-think', audioId: '140261895808427',
    scenes: [
      { type: 'type', text: `נבין אי פעם את היקום?`, bare: true, progress: false },
      { type: 'line', text: `מישל ת'אלר: היקום לא נבנה כדי שנבין אותו.` },
      { type: 'mark', text: `מדע הוא התקרבות הדרגתית למציאות — בלי ודאות שנגיע.`, key: 'התקרבות' },
      { type: 'pop', text: `רק לפני כמאה שנה התגלה שהכוכבים עשויים בעיקר ממימן.`, key: 'ממימן' },
      { type: 'line', text: `והמפץ הגדול, לדבריה, לא "יצא מכלום".` },
      { type: 'line', text: `חגב לא ילמד תורת היחסות. אין סיבה להניח שאנחנו נבין הכול.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"היקום לא תוכנן ולא נבנה כדי להיות מובן לתודעה האנושית." 🌌

ד"ר מישל ת'אלר ב-Big Think. מדע, לדבריה, הוא התקרבות הדרגתית למציאות — בלי ודאות שנגיע אליה אי פעם. ולכן האמת יכולה להשתנות.

הדוגמה שלה: רק לפני כמאה שנה הוכיחה דוקטורנטית בהרווארד שהכוכבים עשויים בעיקר ממימן.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מישלתאלר', 'ביגת׳ינק', 'אסטרונומיה', 'פיזיקה', 'יקום', 'מדע'],
  },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  {
    day: '10', slug: 'joe-liemandt-alpha-school-two-hours-huberman', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `בית ספר שבו הלימודים העיוניים נמשכים כשעתיים ביום — וילדים מעדיפים אותו על פני חופשה. 🎒

ג'ו לימנדט אצל אנדרו הוברמן: מה שכנע אותו, המחקר מ-1984 שהוא מצטט, והתפקיד שהוא נותן לבינה מלאכותית.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'גולימנדט', 'הוברמן', 'חינוך', 'ביתספר', 'הורות', 'בינהמלאכותית'],
  },
  {
    day: '11', slug: 'jocko-willink-confidence-tradeoffs-modern-wisdom', format: 'quote', kicker: 'ציטוט',
    caption: `"אחד הדברים העמוקים ביותר שאפשר לעשות כדי להיות בטוח יותר בעצמך הוא להיות בסדר עם לומר: אני לא בטוח מה לעשות עכשיו." 🎖️

ג'וקו ווילינק אצל כריס וויליאמסון — ביטחון עצמי שמתחיל ביכולת להודות שאינך יודע.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גוקוווילינק', 'ביטחוןעצמי', 'מנהיגות', 'מיינדסט', 'החלטות', 'משמעת'],
  },
];

// ── guards ──────────────────────────────────────────────────
const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);

const mythId = (m) => `2026-${MO(m)}-${m.day}_myth-${m.slug.slice(0, 24)}`;
const reelId = (r) => `2026-${MO(r)}-${r.day}_reelv2-${r.slug.slice(0, 22)}`;
const postId = (p) => `2026-${MO(p)}-${p.day}_${p.format}-${p.slug.slice(0, 22)}`;
const section = { myth: MYTHS.map(mythId), reels: REELS.map(reelId), posts: POSTS.map(postId) };
const ownIds = new Set(Object.values(section).flat());
const priorQueue = { items: queue.items.filter((i) => !ownIds.has(i.id)) };
const buildsSection = (s) => only === 'all' || only === s;

// No track twice, ever — across the whole queue and within this batch.
assertFresh(priorQueue, [...(buildsSection('myth') ? MYTHS : []), ...(buildsSection('reels') ? REELS : [])].map((r) => r.audioId));

// A re-run replaces its own entries for the sections it builds.
const rebuilding = new Set(Object.entries(section).filter(([s]) => buildsSection(s)).flatMap(([, ids]) => ids));
queue.items = queue.items.filter((i) => !rebuilding.has(i.id));

// No episode twice in the same format this week.
for (const [label, list] of [['reel', [...MYTHS, ...REELS]], ['post', POSTS]]) {
  const seen = new Set();
  for (const x of list) {
    if (seen.has(x.slug)) throw new Error(`${label}: ${x.slug} appears twice this week`);
    seen.add(x.slug);
  }
}

// No politics (standing, 2026-09-06): not in the post's category or tags,
// nor in anything this batch writes.
for (const x of [...MYTHS, ...REELS, ...POSTS]) {
  const post = need(x.slug);
  const text = [post.category, ...(post.tags || []), ...x.hashtags].join(' ');
  if (/פוליטיקה|politic/i.test(text)) throw new Error(`politics: ${x.slug}`);
}

// An Instagram item must never precede its blog post (the publisher does not
// re-check this, and loadPublishedPosts returns future-dated posts).
const live = (x, when) => {
  const pub = new Date(need(x.slug).pubDate);
  if (pub > new Date(when)) throw new Error(`${x.slug}: blog goes live ${pub.toISOString()}, after its IG slot ${when}`);
};
MYTHS.forEach((m) => live(m, at(m.day, '06:00', MO(m))));
REELS.forEach((r) => live(r, at(r.day, '10:00', MO(r))));
POSTS.forEach((p) => live(p, at(p.day, '17:00', MO(p))));

// The runway model: 13:00 digests are episodes never used as any reel;
// 09:00 myths re-cut an episode whose digest ran at least four weeks earlier.
const priorReels = priorQueue.items.filter((i) => i.format === 'reel');
for (const r of REELS) {
  const used = priorReels.find((i) => i.slug === r.slug);
  if (used) throw new Error(`digest ${r.slug} was already a reel (${used.id})`);
}
// Tell the two apart by kicker, not id: July's v1 digests were `_reel-`.
const isMythItem = (i) => i.kicker === 'מיתוס ↔ מציאות';
for (const m of MYTHS) {
  if (priorReels.some((i) => i.slug === m.slug && isMythItem(i))) throw new Error(`myth ${m.slug} was already a myth reel`);
  const digests = priorReels.filter((i) => i.slug === m.slug && !isMythItem(i)).map((i) => new Date(i.scheduledFor));
  if (!digests.length) throw new Error(`myth ${m.slug} has no earlier digest reel`);
  const gapDays = (new Date(at(m.day, '06:00', MO(m))) - Math.max(...digests)) / 864e5;
  if (gapDays < 27.5) throw new Error(`myth ${m.slug}: digest only ${gapDays.toFixed(1)} days earlier`);
}
console.log(`✓ audio fresh (${freshTracks(priorQueue).length} unused in pool) · no repeats · no politics · blog live first · runway rules\n`);

const outRoot = path.join(ROOT, 'public/social');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-w6-'));
const css = fontCss();

async function cutReel({ id, post, scenes, kicker, coverScene = 1 }) {
  const tl = layoutTimeline(scenes, post);
  const sb = { total: tl.total, kicker, scenes: tl.scenes };
  const html = buildReelHtml(post, sb, css);

  const { samples, violations } = await verifyReel(html, {
    duration: sb.total, step: 0.25, width: REEL.width, height: REEL.height,
  });
  if (violations.length) {
    console.log(`\n❌ ${id}: ${violations.length}/${samples} frames out of spec`);
    for (const v of violations.slice(0, 8)) console.log(`   t=${v.t}s · ${v.issues.join('; ')}`);
    process.exit(1);
  }

  const { pattern } = await renderFrames(html, {
    duration: sb.total, fps: FPS, width: REEL.width, height: REEL.height,
    outDir: path.join(scratch, id),
  });
  const outDir = path.join(outRoot, id);
  const out = await encodeFrames({
    pattern, fps: FPS, duration: sb.total,
    outMp4: path.join(outDir, `${post.slug}-reel.mp4`),
    coverJpg: path.join(outDir, `${post.slug}-cover.jpg`),
    // the frame the grid will show — chosen, not guessed
    coverAt: coverTime(sb.scenes, coverScene),
  });
  fs.rmSync(path.join(scratch, id), { recursive: true, force: true });
  return { out, sb, samples, info: await probe(out.file) };
}

function push({ id, slug, format, kicker, when, caption, hashtags, assets, cover, audioId }) {
  const item = {
    id, slug, platform: 'instagram', format, kicker,
    scheduledFor: when, status: 'approved',
    caption, hashtags: hashtags.map(cleanTag), assets, permalink: '',
  };
  if (cover) item.cover = cover;
  if (audioId) item.audio = { audioId, audioVolume: 100, videoVolume: 0 };
  queue.items.push(item);
}

// Save after every item: a failure late in a long run keeps what finished.
const commit = () => saveQueue(queueFile, queue);

// ── feed posts ──────────────────────────────────────────────
if (buildsSection('posts')) {
  for (const p of POSTS) {
    const post = need(p.slug);
    const id = postId(p);
    const slides = p.format === 'carousel' ? buildCarousel(post, { kicker: p.kicker })
      : p.format === 'lessons' ? buildLessonsCarousel(post, { kicker: p.kicker })
        : buildQuoteCard(post, { kicker: p.kicker });
    const files = await renderSlides(slides, path.join(outRoot, id), p.slug);
    push({
      id, slug: p.slug, format: p.format, kicker: p.kicker,
      when: at(p.day, '17:00', MO(p)), caption: p.caption, hashtags: p.hashtags,
      assets: files.map((f) => `${BASE}/social/${id}/${path.basename(f)}`),
    });
    commit();
    console.log(`🖼  20:00 ${p.day}.${Number(MO(p))} ${p.slug.slice(0, 26).padEnd(28)} ${p.format.padEnd(8)} ${files.length} slides`);
  }
}

// ── myth reels ──────────────────────────────────────────────
if (buildsSection('myth')) {
  for (const m of MYTHS) {
    const post = need(m.slug);
    const id = mythId(m);
    const scenes = [
      { type: 'myth', kicker: 'מיתוס', text: m.myth },
      { type: 'line', kicker: 'מציאות', text: m.reality, invert: true },
      { type: 'line', kicker: 'מציאות', text: m.context },
      { type: 'cta', kicker: 'הסכתון', progress: false },
    ];
    const { out, sb, samples, info } = await cutReel({ id, post, scenes, kicker: 'מיתוס', coverScene: 1 });
    push({
      id, slug: m.slug, format: 'reel', kicker: 'מיתוס ↔ מציאות',
      when: at(m.day, '06:00', MO(m)), caption: m.caption, hashtags: m.hashtags,
      assets: [`${BASE}/social/${id}/${path.basename(out.file)}`],
      cover: `${BASE}/social/${id}/${path.basename(out.cover)}`,
      audioId: m.audioId,
    });
    commit();
    console.log(`💭 09:00 ${m.day}.${Number(MO(m))} ${m.slug.slice(0, 26).padEnd(28)} ${info.duration}s [${sb.scenes.map((s) => (s.out - s.in).toFixed(1)).join('/')}] gate ${samples} ♪ ${trackTitle(m.audioId)}`);
  }
}

// ── digest reels ────────────────────────────────────────────
if (buildsSection('reels')) {
  for (const r of REELS) {
    const post = need(r.slug);
    const id = reelId(r);
    const { out, sb, samples, info } = await cutReel({ id, post, scenes: r.scenes, kicker: 'אמ;לק' });
    push({
      id, slug: r.slug, format: 'reel', kicker: 'ריל',
      when: at(r.day, '10:00', MO(r)), caption: r.caption, hashtags: r.hashtags,
      assets: [`${BASE}/social/${id}/${path.basename(out.file)}`],
      cover: `${BASE}/social/${id}/${path.basename(out.cover)}`,
      audioId: r.audioId,
    });
    commit();
    console.log(`🎬 13:00 ${r.day}.${Number(MO(r))} ${r.slug.slice(0, 26).padEnd(28)} ${info.duration}s [${sb.scenes.map((s) => (s.out - s.in).toFixed(1)).join('/')}] gate ${samples} ♪ ${trackTitle(r.audioId)}`);
  }
}

fs.rmSync(scratch, { recursive: true, force: true });
commit();
console.log('\n✅ queue updated');
