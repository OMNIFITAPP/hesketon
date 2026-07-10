#!/usr/bin/env node
// One-off batch (2026-07-10): three v2-style IG posts —
//   1. quote-v2   · Cesar Millan (featured post)         @ 14:10Z
//   2. carousel-v2· Kelly Starrett, 7 slides             @ 14:40Z
//   3. myth-v2    · Nischa Shah, "מיתוס ↔ מציאות" (new)  @ 15:10Z
// Renders into public/social/<id>/ and appends approved items to
// social-queue.yml. Publishing happens via the social-publish workflow.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { loadQueue, saveQueue } from './lib/social/select.mjs';
import { buildQuoteV2, buildCarouselV2, buildMythV2 } from './lib/social/templates-v2.mjs';
import { renderSlides } from './lib/social/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SP = '/private/tmp/claude-501/-Users-roeislv-Downloads-OMNIFIT-Knowledge-Base/0a2fd263-caf9-493b-8c93-8d3c4a219a08/scratchpad';
const BASE = 'https://hesketon.co.il';

const dataUri = (f) => `data:image/png;base64,${fs.readFileSync(path.join(SP, f)).toString('base64')}`;

const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
const cesar = bySlug['cesar-millan-calm-energy-dog-leadership'];
const kelly = bySlug['kelly-starrett-wellness-movement-play'];
const nischa = bySlug['nischa-shah-money-financial-freedom'];

// ── 1 · Cesar quote ─────────────────────────────────────────
const cesarSlides = buildQuoteV2(cesar, {
  quoteHtml:
    'אתם לא רוצים שהכלב יקשיב לפקודות שלכם. אתם רוצים שהוא יקשיב <b>לשקט שלכם, לרוגע שלכם</b> — למה שיש לכם בראש, <b>בלי מילה אחת</b>.',
  cite: 'סיזאר מילאן',
  illu: dataUri('illu-cesar-t.png'),
});

// ── 2 · Kelly carousel (7 slides) ───────────────────────────
const kellySlides = buildCarouselV2(kelly, {
  cover: {
    kicker: 'תקציר מזוקק',
    titleTop: 'כל הגאדג׳טים',
    titleAccent: 'לא יהפכו אתכם לבריאים.',
    sub: 'ד״ר קלי סטארט — מומחה התנועה של אולימפיונים ולוחמי יחידות מובחרות — על מה שבאמת עובד.',
    illu: dataUri('illu-kelly-t.png'),
  },
  slides: [
    {
      kicker: 'הבעיה',
      head: 'תעשיית ה־wellness איבדה את הצפון',
      bodyHtml:
        'אישה שאלה אותו אם לקנות "לוח רטט" ב־1,000 דולר.<br>התשובה: לא. מה שאתם צריכים זה <b>כדור טניס, חבל ופריזבי</b>. אתם צריכים חבר.<br>הבסיס — לבשל, לזוז, לישון — פשוט לא מספיק סקסי.',
    },
    {
      kicker: 'המסננת',
      head: 'האם זה יביא אתכם לאולימפיאדה?',
      bodyHtml:
        'בחנו כל טרנד בריאות דרך עדשה של ביצועים.<br><b>אף ספורטאי עילית לא משתמש ברוב הדברים האלה</b> —<br>ומה שלא עובר את המבחן הוא בידור, לא כלי.',
    },
    {
      kicker: 'העיקרון',
      head: 'עמידות היא כל העניין',
      bodyHtml:
        'יחידה מובחרת חיפשה שנים מה משפר ביצועים.<br>הדבר היחיד שעבד? <b>חודש בלי אלכוהול</b>.<br>"אם סטייה של מילימטר מפילה אתכם — מעולם לא הייתם בחוד החנית."',
    },
    {
      kicker: 'הראש',
      head: 'היכולת להתחיל מחדש',
      bodyHtml:
        'אין התקדמות ליניארית אינסופית — יש עונות.<br>אחרי פציעה או הפסקה, כל תרגיל הוא <b>שיא אישי חדש</b>,<br>כי מתחילים מנקודה חדשה. זה לא כישלון — זו השיטה.',
    },
    {
      kicker: 'תרופת הפלא',
      head: 'המשחק הוא תרופת הפלא',
      bodyHtml:
        '"שאבו את השמחה מחדר הכושר."<br>הפתרון של סטארט: הפכו את 15 הדקות הראשונות של האימון <b>למשחק</b> — פריזבי, כדור טניס, ריקוד.<br>שמחה היא כלי אימון, לא קישוט.',
    },
  ],
  cta: {
    titleTop: 'רוצים את כל הפרק',
    titleAccent: 'ב־10 דקות קריאה?',
    lines: ['התקציר המלא של הפרק עם ד״ר קלי סטארט', 'מחכה באתר הסכתון. קישור בביו.'],
  },
});

// ── 3 · Nischa "מיתוס ↔ מציאות" (new format) ────────────────
const nischaSlides = buildMythV2(nischa, {
  myth: 'כדי להגיע לחופש כלכלי, צריך להרוויח יותר.',
  realityHead: 'ניהול מנצח הכנסה.',
  realityBody:
    'מי שמרוויח 100 אלף ומוציא 100 אלף,<br>נמצא מאחורי מי שמרוויח 50 <b>וחוסך 10%</b>.<br>זה לא כמה שאתם מרוויחים — אלא איך אתם מנהלים את מה שיש.',
  attr: 'נישה שאה · On Purpose · <b>הסכתון</b>',
  illu: dataUri('illu-money-t.png'),
});

// ── Render + queue ──────────────────────────────────────────
const items = [
  {
    id: '2026-07-10_quote-v2-cesar',
    slug: cesar.slug,
    platform: 'instagram',
    format: 'quote',
    kicker: 'ציטוט',
    scheduledFor: '2026-07-10T14:10:00.000Z',
    status: 'approved',
    caption: `הכלב לא מקשיב למילים שלכם. הוא מקשיב למה שאתם משדרים. 🐕

סיזאר מילאן — "לוחש הכלבים" — התארח אצל פרופ' אנדרו הוברמן לשיחה של שעתיים וחצי על אנרגיה רגועה, מנהיגות, ולמה קבלת פנים נרגשת דווקא מזיקה לכלב שלכם.

זה פרק על כלבים שהוא בעצם פרק על בני אדם.

התקציר המלא — 11 דקות קריאה במקום 2:38 שעות — באתר. קישור בביו. 🔗`,
    hashtags: ['#הסכתון', '#פודקאסט', '#סיזארמילאן', '#הוברמן', '#כלבים', '#אילוףכלבים', '#אנרגיהרגועה', '#מיינדסט', '#פסיכולוגיה'],
    slides: cesarSlides,
  },
  {
    id: '2026-07-10_carousel-v2-kelly',
    slug: kelly.slug,
    platform: 'instagram',
    format: 'carousel',
    kicker: 'תקציר מזוקק',
    scheduledFor: '2026-07-10T14:40:00.000Z',
    status: 'approved',
    caption: `"מה שאתם צריכים זה כדור טניס, חבל ופריזבי. אתם צריכים חבר." 🎾

ד״ר קלי סטארט — מומחה התנועה שעבד עם אולימפיונים ולוחמי יחידות מובחרות — יושב עם ריץ' רול לשיחה חדה על תעשיית ה־wellness שאיבדה את הצפון.

בקרוסלה: המסננת שחותכת כל טרנד בריאות, למה עמידות חשובה משלמות, ואיך 15 דקות של משחק משנות אימון שלם.

שמרו לעצמכם 💾 והתקציר המלא באתר — קישור בביו.`,
    hashtags: ['#הסכתון', '#פודקאסט', '#קליסטארט', '#ריץרול', '#בריאותוכושר', '#תנועה', '#אימונים', '#wellness', '#עמידות'],
    slides: kellySlides,
  },
  {
    id: '2026-07-10_myth-v2-nischa',
    slug: nischa.slug,
    platform: 'instagram',
    format: 'carousel',
    kicker: 'מיתוס ↔ מציאות',
    scheduledFor: '2026-07-10T15:10:00.000Z',
    status: 'approved',
    caption: `פורמט חדש: מיתוס ↔ מציאות 💭

בכל פעם — אמונה נפוצה אחת, מול מה שהמומחים באמת אמרו בפרק.

הפעם: נישה שאה, בנקאית השקעות לשעבר, מפרקת אצל ג'יי שטי את המיתוס הכי יקר שיש — שחופש כלכלי מתחיל מלהרוויח יותר.

מסכימים? מתנגדים? ספרו לנו בתגובות 👇
התקציר המלא באתר — קישור בביו.`,
    hashtags: ['#הסכתון', '#פודקאסט', '#כסף', '#חופשכלכלי', '#חינוךפיננסי', '#נישהשאה', '#ג׳יישטי', '#השקעות', '#הרגלים'],
    slides: nischaSlides,
  },
];

const outRoot = path.join(ROOT, 'public/social');
const queue = loadQueue(path.join(ROOT, 'social-queue.yml'));

for (const item of items) {
  const { slides, ...q } = item;
  const outDir = path.join(outRoot, item.id);
  const files = await renderSlides(slides, outDir, item.slug);
  q.assets = files.map((f) => `${BASE}/social/${item.id}/${path.basename(f)}`);
  queue.items.push(q);
  console.log(`✔ ${item.id}: ${files.length} slides`);
}

saveQueue(path.join(ROOT, 'social-queue.yml'), queue);
console.log('✅ queue updated');
