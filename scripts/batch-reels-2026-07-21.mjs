#!/usr/bin/env node
// One-off batch (2026-07-21): 7 Instagram Reels, one per day at 13:00
// Israel time (10:00Z) across 2026-07-21 → 2026-07-27.
//
// The 13:00 slot deliberately avoids the 20:00 feed-post slot that the
// 10-post batch already occupies, so the two never collide.
//
//   1. Tim Ferriss    · שבועיים בלי רשתות        (מיינדסט)
//   2. Tommy Wood     · מוח שמחזיק לאורך זמן      (בריאות)
//   3. Andy Stumpf    · השריר שנכשל               (מיינדסט)
//   4. Tony Robbins   · AI ועתיד העבודה           (עבודה/AI)
//   5. Vinh Giang     · הקול שלך ככלי נגינה        (תקשורת)
//   6. Kevin O'Leary  · עושר = משמעת              (כסף)
//   7. Andy Galpin    · תוכנית מנצחת היעדר תוכנית (כושר)
//
// Scene text comes verbatim from each published post (lead quote +
// אמ;לק) via templates-reel; captions are authored here. Video is built
// entirely with ffmpeg — no paid generation, and the audio bed is
// synthesized from oscillators so there is nothing to license.

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
const BASE = (process.env.SOCIAL_PUBLIC_BASE || 'https://hesketon.co.il').replace(/\/$/, '');

const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
const need = (slug) => {
  if (!bySlug[slug]) throw new Error(`missing post: ${slug}`);
  return bySlug[slug];
};

// 13:00 Israel (IDT, UTC+3) = 10:00Z.
const at1300 = (day) => `2026-07-${String(day).padStart(2, '0')}T10:00:00.000Z`;

const PLAN = [
  {
    day: 21, slug: 'tim-ferriss-stuck-brain-fuel-decisions',
    caption: `"שבועיים בלי רשתות חברתיות יעשו לאנשים רבים מה שעשר שנות טיפול עושות." 📵

טים פריס אצל ג'יי שטי — על מה באמת מוציא אנשים מתקיעות, ולמה ההתערבות הכי פשוטה היא גם החזקה ביותר.

שמרו לעצמכם 💾 והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'טיםפריס', 'רשתותחברתיות', 'מיינדסט', 'פרודוקטיביות', 'בריאותנפשית', 'הרגלים'],
  },
  {
    day: 22, slug: 'tommy-wood-future-proof-brain',
    caption: `רוב מה שקובע איך המוח שלכם יזדקן — לא נמצא בגנים. 🧠

ד"ר טומי ווד אצל ג'ו רוגן, על "מרווח": הפער בין מה שאתם צריכים ביום-יום לבין מה שאתם באמת מסוגלים לו — ולמה הוא מגן עליכם בהמשך.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'בריאותהמוח', 'טומיווד', 'דמנציה', 'אריכותחיים', 'בריאות', 'מדע'],
  },
  {
    day: 23, slug: 'andy-stumpf-psychology-of-endurance-williamson',
    caption: `"השריר שנכשל באימון הלוחמים אינו מתחת לצוואר. הוא בין האוזניים." 🧠

אנדי סטאמפ — לוחם SEAL לשעבר — אצל Modern Wisdom, על מה שבאמת שובר אנשים באימונים הקשים בעולם, ומה מחזיק אותם.

שמרו 💾 והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנדיסטאמפ', 'מיינדסט', 'חוסן', 'סיבולת', 'פסיכולוגיה', 'משמעת'],
  },
  {
    day: 24, slug: 'tony-robbins-ai-future-of-work-meaning',
    caption: `"אנשים לא יוחלפו על ידי AI. הם יוחלפו על ידי מישהו שיודע להשתמש ב-AI." 🤖

טוני רובינס אצל סטיבן בארטלט — על עתיד העבודה, ומה כדאי לעשות עכשיו כדי להישאר רלוונטיים.

מסכימים? ספרו לנו בתגובות 👇
התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'טונירובינס', 'בינהמלאכותית', 'עתידהעבודה', 'קריירה', 'טכנולוגיה', 'מיינדסט'],
  },
  {
    day: 25, slug: 'vinh-giang-voice-communication-skills',
    caption: `"הקול שלך הוא כלי נגינה. אל תמות עם כל המוזיקה תקועה בפנים." 🎙️

וין ג'יאנג אצל ג'יי שטי — על למה רובנו משתמשים בחלק קטן מהיכולת הקולית שלנו, ואיך זה משנה את הדרך שבה אנשים שומעים אתכם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'תקשורת', 'ויןגיאנג', 'דיבורבפומבי', 'קול', 'ביטחוןעצמי', 'מיינדסט'],
  },
  {
    day: 26, slug: 'kevin-oleary-wealth-discipline-diary-of-a-ceo',
    caption: `"בניית עושר מסתכמת במילה אחת: משמעת." 💰

קווין אולירי — מ-Shark Tank — אצל סטיבן בארטלט, על ההרגלים הכספיים שהוא מייחס להם את ההבדל בין מי שצובר הון למי שלא.

שמרו לעצמכם 💾 והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'קוויןאולירי', 'כסף', 'השקעות', 'משמעת', 'חינוךפיננסי', 'עסקים'],
  },
  {
    day: 27, slug: 'andy-galpin-fitness-principles-rich-roll',
    caption: `"תוכנית תמיד מנצחת היעדר תוכנית — גם אם היא לא התוכנית הכי טובה." 🏋️

ד"ר אנדי גלפין אצל ריץ' רול, על העקרונות שקובעים אם אימון עובד — ולמה עקביות מנצחת אופטימיזציה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנדיגלפין', 'כושר', 'אימונים', 'בריאותוכושר', 'ריצרול', 'עקביות'],
  },
];

const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

const outRoot = path.join(ROOT, 'public/social');
const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);
// Scene stills are an intermediate — keep them out of the repo.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-reels-'));

for (const p of PLAN) {
  const post = need(p.slug);
  const id = `2026-07-${String(p.day).padStart(2, '0')}_reel-${p.slug.slice(0, 24)}`;
  const scenes = buildReelScenes(post, { kicker: 'ציטוט', beats: 3 });
  const files = await renderSlides(scenes, path.join(scratch, id), p.slug);

  const outDir = path.join(outRoot, id);
  const out = await makeReel({
    sceneFiles: files,
    durations: scenes.map((s) => s.seconds),
    crossfade: 0.5,
    outMp4: path.join(outDir, `${p.slug}-reel.mp4`),
    coverJpg: path.join(outDir, `${p.slug}-cover.jpg`),
  });
  const info = await probe(out.file);

  queue.items.push({
    id,
    slug: p.slug,
    platform: 'instagram',
    format: 'reel',
    kicker: 'ריל',
    scheduledFor: at1300(p.day),
    status: 'approved',
    caption: p.caption,
    hashtags: p.hashtags.map(cleanTag),
    assets: [`${BASE}/social/${id}/${path.basename(out.file)}`],
    cover: `${BASE}/social/${id}/${path.basename(out.cover)}`,
    permalink: '',
  });
  console.log(`✔ ${id} · ${info.duration.toFixed(1)}s · ${info.sizeMB}MB · ${info.video} · ${info.audio}`);
}

fs.rmSync(scratch, { recursive: true, force: true });
saveQueue(queueFile, queue);
console.log(`\n✅ appended ${PLAN.length} reels to social-queue.yml`);
