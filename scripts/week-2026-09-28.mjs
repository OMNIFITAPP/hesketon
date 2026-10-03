#!/usr/bin/env node
// Week of 2026-09-28 → 10-04 (crosses into October — items carry `month`).
//
//   09:00 IDT  מיתוס ↔ מציאות   (re-cut of an episode digested ≥4 weeks ago)
//   13:00 IDT  digest reel      (an episode never used as any reel)
//   20:00 IDT  feed post        (quote / lessons / carousel)
//
//   node scripts/week-2026-09-28.mjs [--only=myth|reels|posts]
//
// Only two never-reeled episodes exist (Davidson, Alice Han), so the 13:00
// slot runs Monday and Thursday only: 16 items, not 21. The blog, not the
// pipeline, sets how many digests a week can carry.
//
// Every scene line is drawn from the published post it credits. Audio is
// checked against the whole queue — no track is ever used twice.

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

const MO = (x) => x.month || '09';  // October items set month: '10'
const at = (day, hhmmZ, month = '09') => `2026-${month}-${day}T${hhmmZ}:00.000Z`;
const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

// ── מיתוס ↔ מציאות (09:00) ──────────────────────────────────
// Re-cuts of episodes whose digest ran at least four weeks earlier. The
// reality line is also the grid thumbnail, so it must stand alone.
const MYTHS = [
  {
    day: '28', slug: 'andy-galpin-fitness-principles-rich-roll',
    myth: `צריך למצוא את תוכנית האימון המושלמת.`,
    reality: `תוכנית תמיד מנצחת היעדר תוכנית — גם אם היא לא הטובה ביותר.`,
    context: `רוב האנשים מעולם לא התמידו בתוכנית אחת עשרה שבועות ברצף.`,
    audioId: '981174716484269',
    caption: `מיתוס ↔ מציאות 🏋️

"תוכנית תמיד מנצחת היעדר תוכנית — גם אם התוכנית עצמה אינה בהכרח טובה יותר באופן מוכח מתוכנית אחרת."

ד"ר אנדי גלפין אצל ריץ' רול. העצה מספר 1 שלו: שכרו מאמן אחד, והתמידו בתוכנית שלו במלואה במשך 8–12 שבועות.

רוב האנשים, לדבריו, מעולם לא התמידו בתוכנית אחת עשרה שבועות ברצף.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנדיגלפין', 'ריצרול', 'כושר', 'אימון', 'עקביות', 'מיתוסים'],
  },
  {
    day: '29', slug: 'matthew-mcconaughey-reinventing-yourself-modern-wisdom',
    myth: `כדי להשתנות צריך לגלות מי אתה.`,
    reality: `לא לגלות מי אתה — אלא לפסול את מה שאתה לא.`,
    context: `באמצע 20 חודשים בלי עבודה, הוא סירב ל-14.5 מיליון דולר.`,
    audioId: '913718797258608',
    caption: `מיתוס ↔ מציאות 🎬

"נעדרתי מספיק זמן כדי להפוך לרעיון טוב חדש."

מתיו מקונוהיי אצל כריס וויליאמסון. השיטה שהוא מתאר אינה "לגלות מי אתה" — אלא לפסול את מה שאתה לא.

ובאמצע 20 חודשים בלי עבודה, הוא סירב להצעה של 14.5 מיליון דולר.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מקונוהיי', 'קריירה', 'זהות', 'החלטות', 'מיינדסט', 'מיתוסים'],
  },
  {
    day: '30', slug: 'creatine-dosing-myths-candow',
    myth: `קריאטין פוגע בכליות.`,
    reality: `החשש שקריאטין פוגע בכליות אינו נתמך היטב במחקר על אנשים בריאים.`,
    context: `העיקר אינו השריר: קריאטין הוא גיבוי אנרגטי לתאים תחת עומס.`,
    audioId: '344556620926802',
    caption: `מיתוס ↔ מציאות 💊

ד"ר דארן קנדו אצל סטיבן ברטלט: כמה מהחששות הנפוצים סביב קריאטין — כליות, מים, שיער — אינם נתמכים היטב במחקר על אנשים בריאים ובמינונים מקובלים.

והעיקר, לדבריו, אינו השריר: קריאטין הוא גיבוי אנרגטי לתאים שעובדים תחת עומס.

⚠️ אין באמור ייעוץ רפואי. לפני נטילת תוספים — התייעצו עם רופא.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קריאטין', 'תוספים', 'כושר', 'בריאות', 'סטיבןברטלט', 'מיתוסים'],
  },
  {
    day: '01', month: '10', slug: 'demis-hassabis-agi-world-models-deepmind',
    myth: `AI שזוכה באולימפיאדת מתמטיקה כבר חכם מאיתנו.`,
    reality: `מודלי AI זוכים בזהב במתמטיקה — ונכשלים בתרגיל לוגי פשוט.`,
    context: `חוסר העקביות, לא חוסר היכולת, מפריד אותם מבינה כללית.`,
    audioId: '1852688158814799',
    caption: `מיתוס ↔ מציאות 🤖

דמיס הסביס, ראש Google DeepMind, קורא לזה "אינטליגנציה משוננת": אותם מודלים זוכים במדליית זהב באולימפיאדת המתמטיקה — ונכשלים בתרגיל לוגי פשוט.

לדבריו, חוסר העקביות — לא חוסר היכולת — הוא מה שמפריד אותם מבינה כללית.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דמיסהסביס', 'דיפמיינד', 'בינהמלאכותית', 'AGI', 'טכנולוגיה', 'מיתוסים'],
  },
  {
    day: '02', month: '10', slug: 'lance-armstrong-rise-fall-growth-attia',
    myth: `מה שהפיל את לאנס ארמסטרונג היה הדופינג.`,
    reality: `מה שהפך את ארמסטרונג למוקצה היה השקר — לא הדופינג.`,
    context: `שנים הוא שיקר, ותקף את מי שאמרו את האמת.`,
    audioId: '290641658216199',
    caption: `מיתוס ↔ מציאות 🚴

"אותו בחור היה צריך למות, ובחור חדש היה צריך לבוא במקומו."

לאנס ארמסטרונג אצל ד"ר פיטר אטיה. מה שהפך אותו למוקצה, לפי השיחה, לא היה הדופינג עצמו — אלא השקר שנמשך שנים, וההתקפות על מי שאמרו את האמת.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'לאנסארמסטרונג', 'פיטראטיה', 'אמת', 'צמיחה', 'ספורט', 'מיתוסים'],
  },
  {
    day: '03', month: '10', slug: 'neil-degrasse-tyson-aliens-whistleblowers',
    myth: `עדות בשבועה מוכיחה שהיו כאן חייזרים.`,
    reality: `עדות על חייזרים, גם בשבועה, אינה ראיה. "תוציאו את החייזר."`,
    context: `ובכל זאת טייסון כמעט משוכנע שיש ביקום חיים תבוניים.`,
    audioId: '1719530634773795',
    caption: `מיתוס ↔ מציאות 👽

"אם אתם טוענים שיש לכם חייזר בסככה שבחצר האחורית — פשוט תוציאו אותו החוצה."

ניל דה-גראס טייסון אצל סטיבן ברטלט: עדות, גם בשבועה, אינה ראיה.

ובכל זאת הוא כמעט משוכנע שקיימים חיים תבוניים ביקום — בגלל הגודל, הגיל, והמהירות שבה נוצרו החיים על כדור הארץ.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'ניילדהגראסטייסון', 'חייזרים', 'מדע', 'יקום', 'חשיבהביקורתית', 'מיתוסים'],
  },
  {
    day: '04', month: '10', slug: 'kevin-oleary-wealth-discipline-diary-of-a-ceo',
    myth: `כדי להתעשר צריך גאונות.`,
    reality: `בניית עושר מסתכמת במילה אחת: משמעת.`,
    context: `לא יותר מ-5% במניה אחת, ולא יותר מ-20% במגזר אחד.`,
    audioId: '1455678704913700',
    caption: `מיתוס ↔ מציאות 💰

"בניית עושר מסתכמת במילה אחת: משמעת."

קווין אולירי אצל סטיבן ברטלט. שני כללי הברזל שלו: לא יותר מ-5% במניה אחת, ולא יותר מ-20% במגזר אחד. פיזור, לא גאונות.

⚠️ אין באמור ייעוץ השקעות.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קווינאולירי', 'כסף', 'משמעת', 'השקעות', 'סטיבןברטלט', 'מיתוסים'],
  },
];

// ── digest reels (13:00) — only two never-reeled episodes exist ─
const REELS = [
  {
    day: '28', slug: 'richard-davidson-contemplative-aerobics-foundmyfitness', audioId: '1583516402326404',
    scenes: [
      { type: 'type', text: `מדיטציה או אימון?`, bare: true, progress: false },
      { type: 'line', text: `ריצ'רד דיווידסון: לא צריך לבחור בין מדיטציה לאימון.` },
      { type: 'mark', text: `אפשר לעשות את שניהם יחד — בלי זמן נוסף.`, key: 'שניהם' },
      { type: 'pop', text: `פלסטיות מוחית ניטרלית: היא מגבירה את מה שממלא את הראש.`, key: 'ניטרלית' },
      { type: 'line', text: `אימון אירובי פותח את החלון. מה שנכנס תלוי במחשבה באותו רגע.` },
      { type: 'line', text: `למלא את הראש בכוונה נדיבה — דווקא בזמן המאמץ.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"אתם לא צריכים לבחור. אפשר לעשות את שניהם יחד — וזה לא ייקח זמן נוסף." 🧘

פרופ' ריצ'רד דיווידסון אצל ד"ר רונדה פטריק, על השאלה אם להשקיע את הזמן במדיטציה או באימון.

הנימוק שלו: פלסטיות מוחית היא ניטרלית. אימון אירובי מגביר אותה — אבל היא מגבירה גם את מה שממלא את הראש באותו רגע. ומכאן הרעיון שהוא קורא לו "אירוביקה התבוננותית".

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'ריצרדדיווידסון', 'רונדהפטריק', 'מדיטציה', 'אימון', 'מוח', 'רווחהנפשית'],
  },
  {
    day: '01', month: '10', slug: 'alice-han-china-four-ds-what-now', audioId: '250416556399344',
    scenes: [
      { type: 'type', text: `ממה סין באמת מודאגת?`, bare: true, progress: false },
      { type: 'line', text: `אליס האן: בבייג'ינג עסוקים בבעיות מבניות — לא באידיאולוגיה.` },
      { type: 'mark', text: `חוב של מעל 300% מהתמ"ג, לדבריה — יותר מארה"ב.`, key: 'חוב' },
      { type: 'pop', text: `הצריכה הפרטית חלשה — ולכן סין חייבת לייצא עוד.`, key: 'לייצא' },
      { type: 'line', text: `ושיעור הילודה — הנמוך ביותר מאז 1949.` },
      { type: 'line', text: `בעיה פנימית של סין הופכת לבעיה של כולם.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"מה שאני קוראת לו ארבעת ה-D הם הבעיות האמיתיות בסין — אלה שמקבלי ההחלטות עצמם מבינים." 📉

אליס האן אצל טרוור נואה. לדבריה, במערב מנתחים את סין דרך מסגרות מושאלות — ובבייג'ינג עסוקים במשהו אחר: חוב של מעל 300% מהתמ"ג, ביקוש פנימי חלש, ושיעור ילודה הנמוך ביותר מאז 1949.

והמסקנה שלה: כשהצריכה בפנים לא מספיקה, סין חייבת לייצא עוד — והבעיה הפנימית הופכת לבעיה של כולם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אליסהאן', 'טרוורנואה', 'סין', 'כלכלה', 'דמוגרפיה', 'חוב'],
  },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  {
    day: '28', slug: 'tony-robbins-depression-motivation-jordan-peterson', format: 'quote', kicker: 'ציטוט',
    caption: `"אנחנו לא חווים את החיים — אנחנו חווים את החיים שאנחנו מתמקדים בהם." 🎯

טוני רובינס אצל ג'ורדן פיטרסון, על דיכאון, מוטיבציה ומיקוד.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'טונירובינס', 'גורדןפיטרסון', 'מיקוד', 'מוטיבציה', 'מיינדסט', 'פסיכולוגיה'],
  },
  {
    day: '29', slug: 'vinh-giang-voice-communication-skills', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `הדרך שבה אתם מדברים אינה "הקול הטבעי" שלכם — היא הרגל. ומה שנלמד, אפשר לשנות. 🎙️

וין ג'יאנג אצל ג'יי שטי, על הקול ככלי נגינה.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'ויןגיאנג', 'גיישטי', 'תקשורת', 'קול', 'דיבורבפומבי', 'ביטחוןעצמי'],
  },
  {
    day: '30', slug: 'dan-martell-how-to-use-ai-better-than-95-percent', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"יש רק שני עתידים אפשריים: או שתשתף פעולה עם ה-AI ותשתמש בו כדי לייצר ערך בעולם — או שתעבוד בשבילו." 🤖

דן מרטל אצל גרנט אואן. לדבריו רק כ-5% מאוכלוסיית העולם שילמו אי-פעם על גרסה בתשלום של AI — והפער הזה הוא ההזדמנות.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'דןמרטל', 'בינהמלאכותית', 'עסקים', 'יזמות', 'קריירה', 'AI'],
  },
  {
    day: '01', month: '10', slug: 'tim-ferriss-stuck-brain-fuel-decisions', format: 'quote', kicker: 'ציטוט',
    caption: `"אם תפסיק עם הרשתות החברתיות שבועיים בלבד, זה ייטיב עם אנשים רבים באותה מידה כמו עשר שנות טיפול." 📵

טים פריס אצל ג'יי שטי — הערכה אישית שלו, לא ממצא מחקרי. לדבריו, הסרת הרשתות החברתיות מהטלפון היא ההתערבות הפשוטה ביותר עם ההשפעה הגדולה ביותר.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'טימפריס', 'רשתותחברתיות', 'בריאותנפשית', 'הרגלים', 'מיקוד', 'פסיכולוגיה'],
  },
  {
    day: '02', month: '10', slug: 'mohnish-pabrai-dhandho-investor-financial-freedom', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"עץ — אני מרוויח; פלי — אני לא מפסיד הרבה." 🪙

מוניש פבראי אצל סטיבן ברטלט: העתקה חכמה עדיפה על המצאה מסוכנת.

3 דברים שלמדנו, בקרוסלה 👇

⚠️ אין באמור ייעוץ השקעות.

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מונישפבראי', 'השקעות', 'כסף', 'יזמות', 'סיכון', 'סטיבןברטלט'],
  },
  {
    day: '03', month: '10', slug: 'elon-musk-joe-rogan-1470-talent-neuralink', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `אילון מאסק אצל ג'ו רוגן: "יש הקצאת יתר של כישרון לפיננסים ולמשפטים… צריך פחות אנשים בעריכת דין, פחות בפיננסים, ויותר אנשים שמייצרים דברים." 🚀

ובהמשך השיחה: הגרסה הראשונה של שתל נוירלינק, והשאלה שהוא משאיר פתוחה — איפה בדיוק המימן הפך למודע?

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אילוןמאסק', 'גורוגן', 'נוירלינק', 'כישרון', 'טכנולוגיה', 'קריירה'],
  },
  {
    day: '04', month: '10', slug: 'yuval-noah-harari-ai-future-danger', format: 'quote', kicker: 'ציטוט',
    caption: `"השאלה הגדולה היא האם נאלץ אותה להאט, או שהיא תאלץ אותנו להאיץ — עד שנתמוטט ונמות." 🧠

יובל נח הררי אצל ריץ' רול, על בינה מלאכותית כסוכן עצמאי ולא ככלי — ועל הסיכוי שלנו: שיקום האמון במוסדות, והאטה מכוונת.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'יובלנחהררי', 'ריצרול', 'בינהמלאכותית', 'עתיד', 'טכנולוגיה', 'חברה'],
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-w5-'));
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
