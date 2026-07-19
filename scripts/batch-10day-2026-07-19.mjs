#!/usr/bin/env node
// One-off batch (2026-07-19): 10 Instagram pieces, one per night at
// 20:00 Israel time (17:00Z) across 2026-07-19 → 2026-07-28.
//
//   1. carousel · David Goggins × Huberman        (מיינדסט)
//   2. quote    · Matthew Walker — sleep/magnesium (בריאות)
//   3. lessons  · Ido Portal — movement as practice(תנועה)
//   4. carousel · Morgan Housel — psychology of $  (כסף)
//   5. quote    · Jefferson Fisher — communication (תקשורת)
//   6. carousel · David Sinclair — longevity       (אריכות חיים)
//   7. lessons  · James Nestor — breathing         (בריאות)
//   8. quote    · Naval Ravikant — 44 harsh truths (מיינדסט)
//   9. carousel · Andrew Huberman — cortisol/focus (בריאות)
//  10. lessons  · Mike Israetel — fat loss science (בריאות)
//
// Slide text is sourced verbatim from the published posts by the v1
// templates (lead / tl;dr / takeaways) — captions are authored here.
// Renders into public/social/<id>/ and appends approved items to
// social-queue.yml. Publishing happens via the social-publish workflow
// at each item's scheduledFor (needs SOCIAL_ENABLED=true).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { loadQueue, saveQueue } from './lib/social/select.mjs';
import { buildCarousel, buildQuoteCard, buildLessonsCarousel } from './lib/social/templates.mjs';
import { renderSlides } from './lib/social/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.SOCIAL_PUBLIC_BASE || 'https://hesketon.co.il').replace(/\/$/, '');

const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
const need = (slug) => {
  if (!bySlug[slug]) throw new Error(`missing post: ${slug}`);
  return bySlug[slug];
};

// 20:00 Israel (IDT, UTC+3) = 17:00Z. One per day, 07-19 … 07-28.
const at2000 = (day) => `2026-07-${String(day).padStart(2, '0')}T17:00:00.000Z`;

const PLAN = [
  {
    day: 19, slug: 'david-goggins-huberman-inner-strength',
    format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"כל דבר שאי פעם עשיתי בחיי — לא רציתי לעשות אותו." 🔥

דייויד גוגינס אצל אנדרו הוברמן, על איך בונים כוח פנימי — לא מתוך השראה, אלא דווקא ממה שהכי קשה לכם לעשות.

הכוח לא מגיע כשמתחשק. הוא נבנה כשלא.

החליקו את הקרוסלה, שמרו 💾 — והתקציר המלא בבלוג. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'דייווידגוגינס', 'הוברמן', 'מיינדסט', 'משמעת', 'מוטיבציה', 'כוחפנימי', 'פסיכולוגיה'],
  },
  {
    day: 20, slug: 'matthew-walker-sleep-science-magnesium-regularity',
    format: 'quote', kicker: 'ציטוט',
    caption: `"אם רמת המגנזיום שלך כבר תקינה — כל מה שאתה עושה זה לייצר שתן יקר." 💊

פרופ' מתיו ווקר, חוקר השינה, אצל סטיבן בארטלט — על מה שבאמת עוזר לישון, ומה סתם מרוקן את הארנק.

לא כל תוסף שווה את הכסף. סדירות, חושך וטמפרטורה — כן.

התקציר המלא בבלוג. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מתיוווקר', 'שינה', 'מגנזיום', 'בריאות', 'אריכותחיים', 'שינהטובה'],
  },
  {
    day: 21, slug: 'ido-portal-movement-mind-body-huberman',
    format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `החיים לא נועדו כדי שפשוט נחיה אותם. הם נועדו לתרגול. 🤸

עידו פורטל — מורה התנועה — אצל אנדרו הוברמן, על למה תנועה היא לא עוד אימון אלא דרך לחשוב, ללמוד ולחיות.

3 דברים שלמדנו מהשיחה, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא בבלוג. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'עידופורטל', 'תנועה', 'הוברמן', 'בריאותוכושר', 'מיינדסט', 'אימון'],
  },
  {
    day: 22, slug: 'morgan-housel-psychology-of-money-huberman',
    format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"עבור הרבה אנשים, כסף הוא נכס פיננסי — וגם התחייבות פסיכולוגית." 💭

מורגן האוזל, מחבר "הפסיכולוגיה של הכסף", אצל אנדרו הוברמן — על למה ההחלטות הכספיות שלנו כמעט אף פעם לא באמת על הכסף.

בקרוסלה: מה מניע אותנו מתחת לפני השטח, ואיך לחשוב על זה נכון.

שמרו 💾 והתקציר המלא בבלוג. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מורגןהאוזל', 'הפסיכולוגיהשלהכסף', 'כסף', 'השקעות', 'פיננסים', 'הוברמן'],
  },
  {
    day: 23, slug: 'jefferson-fisher-communication-conflict-assertiveness',
    format: 'quote', kicker: 'ציטוט',
    caption: `"השיחה שאתה נמנע ממנה היא התוצאה שאתה בוחר." 🗣️

ג'פרסון פישר — עורך דין שהפך למורה לתקשורת — אצל Modern Wisdom, על איך מדברים מתוך ביטחון בלי להיגרר לריב.

כל שיחה שנדחית לא נעלמת. היא רק בוחרת במקומך.

התקציר המלא בבלוג. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'תקשורת', 'אסרטיביות', 'מערכותיחסים', 'מיינדסט', 'פסיכולוגיה', 'דיבורבפומבי'],
  },
  {
    day: 24, slug: 'david-sinclair-aging-reversal-longevity',
    format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"כשאני רואה אדם זקן, אני לא חושב 'שברירי'. אני חושב — הנה מישהו שצריך איפוס." ⏳

פרופ' דיוויד סינקלייר, חוקר ההזדקנות מהרוורד, אצל סטיבן בארטלט — על התפיסה שהזדקנות היא מצב שאפשר להאט, ואולי אפילו להפוך.

בקרוסלה: מה באמת יודעים היום על אריכות חיים.

שמרו 💾 והתקציר המלא בבלוג. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'דיוידסינקלייר', 'אריכותחיים', 'הזדקנות', 'בריאות', 'מדע', 'לונגביטי'],
  },
  {
    day: 25, slug: 'breathing-right-nestor',
    format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `את רוב האנרגיה שלכם אתם לא מקבלים מאוכל ומשתייה. אתם מקבלים אותה מהנשימה. 🌬️

ג'יימס נסטור, מחבר "Breath", אצל ריץ' רול — על כמה שהדרך שבה אנחנו נושמים משנה בריאות, שינה וריכוז.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא בבלוג. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'נשימה', 'בריאות', 'שינה', 'ריצרול', 'בריאותוכושר', 'מיינדפולנס'],
  },
  {
    day: 26, slug: 'naval-ravikant-44-harsh-truths-modern-wisdom',
    format: 'quote', kicker: 'ציטוט',
    caption: `"לא לרצות משהו שווה ערך לכך שכבר יש לך אותו." 🧘

נאבל רביקאנט אצל Modern Wisdom, בשיחה על 44 אמיתות על החיים — על סיפוק, שאפתנות, וההבדל בין להשיג לבין לרצות.

לפעמים הדרך הקצרה לשלווה היא פשוט להפסיק לרדוף.

התקציר המלא בבלוג. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'נאבלרביקאנט', 'מיינדסט', 'פילוסופיה', 'שלווה', 'חוכמתחיים', 'פסיכולוגיה'],
  },
  {
    day: 27, slug: 'andrew-huberman-cortisol-habits-focus',
    format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"אתה אמור להרגיש קצת לחוץ בבוקר. זה נורמלי. זה בריא." ☀️

פרופ' אנדרו הוברמן אצל Modern Wisdom — על קורטיזול, הרגלי בוקר, וההיגיון הביולוגי מאחורי איך שאתם מרגישים כשאתם קמים.

בקרוסלה: איך לתזמן אור, קפאין ותנועה כדי לשלוט בפוקוס לאורך היום.

שמרו 💾 והתקציר המלא בבלוג. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'הוברמן', 'קורטיזול', 'פוקוס', 'הרגלים', 'בריאות', 'שגרתבוקר'],
  },
  {
    day: 28, slug: 'fat-loss-formula-dr-mike-israetel',
    format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"אם אתה יורד במשקל בלי לספור קלוריות והגוף שלך נראה טוב — אל תתחיל לספור. מה שאתה עושה עובד." ⚖️

ד"ר מייק איסראטל אצל Modern Wisdom, מפרק את מדע הירידה במשקל בלי הרעש.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא בבלוג. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מייקאיסראטל', 'ירידהבמשקל', 'תזונה', 'כושר', 'בריאות', 'מדע'],
  },
];

function buildSlides(post, format, kicker) {
  switch (format) {
    case 'carousel': return buildCarousel(post, { kicker });
    case 'lessons': return buildLessonsCarousel(post, { kicker });
    case 'quote': return buildQuoteCard(post, { kicker });
    default: throw new Error(`unknown format ${format}`);
  }
}

const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

const outRoot = path.join(ROOT, 'public/social');
const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);

for (const p of PLAN) {
  const post = need(p.slug);
  const id = `2026-07-${String(p.day).padStart(2, '0')}_${p.format}-${p.slug.slice(0, 24)}`;
  const slides = buildSlides(post, p.format, p.kicker);
  const outDir = path.join(outRoot, id);
  const files = await renderSlides(slides, outDir, p.slug);
  queue.items.push({
    id,
    slug: p.slug,
    platform: 'instagram',
    format: p.format,
    kicker: p.kicker,
    scheduledFor: at2000(p.day),
    status: 'approved',
    caption: p.caption,
    hashtags: p.hashtags.map(cleanTag),
    assets: files.map((f) => `${BASE}/social/${id}/${path.basename(f)}`),
    permalink: '',
  });
  console.log(`✔ ${id} · ${files.length} slides · ${p.format}`);
}

saveQueue(queueFile, queue);
console.log(`\n✅ appended ${PLAN.length} items to social-queue.yml`);
