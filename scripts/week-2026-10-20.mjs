#!/usr/bin/env node
// Tue 20.10 → Mon 26.10. Built Tuesday at 12:05 after a week with no batch
// (weekly usage limit): no myth today (09:00 had passed), today's digest at
// 16:00 instead of 13:00 (item field hhmmZ). Six blog posts a week now, so
// every day carries a digest again: 20 items.
//
//   node scripts/week-2026-10-20.mjs [--only=myth|reels|posts]

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

// ── מיתוס ↔ מציאות (09:00) — none today: 09:00 had passed when built ──
const MYTHS = [
  { day: '21', slug: 'martin-picard-mitochondria-grey-hair-huberman',
    myth: `הזדקנות היא קו ישר.`,
    reality: `שיער אפור יכול לחזור לצבעו — לפחות באופן זמני.`,
    context: `הגנים מסבירים, לדבריו, לא יותר מעשרה אחוזים מאורך החיים.`,
    audioId: '1488541542256031',
    caption: `מיתוס ↔ מציאות 🧬

"גילינו שהלבנת שיער, לפחות באופן זמני, היא הפיכה."

מרטין פיקארד אצל אנדרו הוברמן — ממצא שסותר את התמונה של הזדקנות כקו ישר. ולדבריו, הגנים מסבירים לא יותר מעשרה אחוזים מאורך החיים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מרטיןפיקארד', 'הוברמן', 'הזדקנות', 'מיטוכונדריה', 'מדע', 'מיתוסים'] },
  { day: '22', slug: 'alex-hormozi-reality-is-the-moat-ai',
    myth: `כדי להצליח היום צריך להקים עסק AI.`,
    reality: `הטעות: להקים עסק AI במקום להשתמש ב-AI בעסק שכבר יש לכם.`,
    context: `המבחן לכל פרויקט AI: אתם מרוויחים יותר כסף? אם לא — עצרו.`,
    audioId: '1296207915590828',
    caption: `מיתוס ↔ מציאות 💼

"המציאות היא החפיר."

אלכס הורמוזי אצל סטיבן ברטלט. הטעות השכיחה, לדבריו: להקים עסק AI במקום להשתמש ב-AI בעסק שכבר יש לכם.

והמבחן לכל פרויקט AI בעסק: אתם מרוויחים יותר כסף? אם לא — עצרו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הורמוזי', 'בינהמלאכותית', 'עסקים', 'יזמות', 'סטיבןברטלט', 'מיתוסים'] },
  { day: '23', slug: 'sam-altman-agi-compute-human-agency',
    myth: `AI תביא אבטלה המונית.`,
    reality: `סם אלטמן כבר לא מנבא אבטלה המונית.`,
    context: `ב-2019, לדבריו, כולם היו אומרים שמודל כמו היום יהפוך את הכלכלה. זה לא קרה.`,
    audioId: '3213789592130632',
    caption: `מיתוס ↔ מציאות 🤖

סם אלטמן אצל פטריק אושונסי: הוא כבר לא מנבא אבטלה המונית. ב-2019, לדבריו, כולם היו אומרים שמודל כמו היום יהפוך את הכלכלה — וזה לא קרה.

"כשטועים בביטחון כזה, חייבים לעדכן."

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סםאלטמן', 'OpenAI', 'בינהמלאכותית', 'עתידהעבודה', 'טכנולוגיה', 'מיתוסים'] },
  { day: '24', slug: 'kane-kallaway-content-lego-bricks-system',
    myth: `הסוד בתוכן הוא האסטרטגיה הנכונה.`,
    reality: `האסטרטגיה היא מצרך. הסוד הוא המרחק בין חזרה לחזרה.`,
    context: `לא הידע — כמות האיטרציות ואיכות השיפור.`,
    audioId: '1135647976946888',
    caption: `מיתוס ↔ מציאות 🧱

"האסטרטגיה אינה הרוטב. האסטרטגיה הופכת למצרך ברגע שאתה מכיר אותה."

קיין קלאוויי: הסוד אינו הידע — אלא המרחק שבין חזרה לחזרה. כמות האיטרציות, ואיכות השיפור בין אחת לשנייה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קייןקלאוויי', 'יצירתוכן', 'שיווק', 'עסקים', 'שיטה', 'מיתוסים'] },
  { day: '25', slug: 'tim-ferriss-stuck-brain-fuel-decisions',
    myth: `עייפות וחרדה הן תמיד בעיה בראש.`,
    reality: `עייפות וחרדה הן לפעמים בעיית תדלוק — לא בעיית חשיבה.`,
    context: `המוח זקוק לדלק: גלוקוז, קטונים ולקטט.`,
    audioId: '1995172257602083',
    caption: `מיתוס ↔ מציאות 🧠

טים פריס אצל ג'יי שטי: המוח זקוק לדלק — גלוקוז, קטונים ולקטט — ולפעמים עייפות, חרדה ועצבנות הן בעיית תדלוק, לא בעיית חשיבה.

⚠️ אין באמור ייעוץ רפואי.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'טימפריס', 'מוח', 'אנרגיה', 'בריאותנפשית', 'פסיכולוגיה', 'מיתוסים'] },
  { day: '26', slug: 'dwayne-johnson-the-rock-joe-rogan-2063',
    myth: `כשמגיע הכסף, קונים את מה שתמיד רצית.`,
    reality: `דוויין ג'ונסון קנה קאדילק — והבין שהוא לא רוצה אותו.`,
    context: `זה הרגיש לו כמו "לעבוד את הגימיק".`,
    audioId: '248622797387636',
    caption: `מיתוס ↔ מציאות 🏈

דוויין ג'ונסון אצל ג'ו רוגן: כשקנה את הקאדילק הראשון שלו, הוא הבין שהוא לא רוצה אותו — כי זה הרגיש כמו "לעבוד את הגימיק".

ולפני כן: הוא לא גר בבית עד גיל 27. הבית הראשון שלו הגיע כשכבר היה אלוף ה-WWE.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דוויןגונסון', 'גורוגן', 'כסף', 'זהות', 'מיינדסט', 'מיתוסים'] },
];

// ── digest reels (13:00; today's at 16:00 — built at 12:05) ──
const REELS = [
  { day: '20', hhmmZ: '13:00', slug: 'angela-duckworth-situation-beats-willpower-modern-wisdom', audioId: '971529610468450',
    scenes: [
      { type: 'type', text: `כוח רצון — או סביבה?`, bare: true, progress: false },
      { type: 'line', text: `אנג'לה דאקוורת: אנשים מצליחים מאוד לא משתמשים בכוח רצון.` },
      { type: 'mark', text: `הם מסדרים את החיים כך שלא יצטרכו אותו.`, key: 'מסדרים' },
      { type: 'pop', text: `"תתאמצו יותר" הוא כלל חסר — ולכן מסוכן.`, key: 'מסוכן' },
      { type: 'line', text: `מטרות אישיות משיגים טוב יותר בקבוצה עם אותה מטרה.` },
      { type: 'line', text: `הדרך למצוינות היא עקביות. והדרך לעקביות היא סביבה.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"הדרך למצוינות היא עקביות. והדרך לעקביות היא סביבה שמאפשרת עקביות." 🧭

אנג'לה דאקוורת אצל כריס וויליאמסון. היא לא חוזרת בה מ"גריט" — אבל לדבריה, אנשים מצליחים מאוד לא משתמשים בכוח רצון. הם מסדרים את החיים כך שלא יצטרכו אותו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנגלהדאקוורת', 'גריט', 'הרגלים', 'כוחרצון', 'פסיכולוגיה', 'מיינדסט'] },
  { day: '21', slug: 'andrew-huberman-light-breathing-phone-diary-of-a-ceo', audioId: '1367491768595866',
    scenes: [
      { type: 'type', text: `שלושה הרגלים שלא עולים כסף?`, bare: true, progress: false },
      { type: 'line', text: `אנדרו הוברמן: אתם רוצים ימים בהירים ולילות חשוכים.` },
      { type: 'mark', text: `אור יום בבוקר, שוב אחר הצהריים — וחושך בלילה.`, key: 'בבוקר' },
      { type: 'pop', text: `שאיפה כפולה ונשיפה ארוכה. חמש דקות ביום.`, key: 'כפולה' },
      { type: 'line', text: `כשצריך להתרכז, הטלפון יוצא מהחדר. לא הפוך על השולחן.` },
      { type: 'line', text: `ברגעי לחץ: ב-20 עד 30 השניות הראשונות, לא אומרים כלום.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"אתם רוצים ימים בהירים, ואתם רוצים לילות חשוכים." ☀️

אנדרו הוברמן אצל סטיבן ברטלט, על שלושה הרגלים שלא עולים כסף: אור יום בבוקר ושוב אחר הצהריים, שאיפה כפולה ונשיפה ארוכה — וטלפון שיוצא מהחדר כשצריך להתרכז.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הוברמן', 'סטיבןברטלט', 'שינה', 'נשימה', 'מיקוד', 'בריאות'] },
  { day: '22', slug: 'bill-gates-how-he-works-founders', audioId: '1085899805683756',
    scenes: [
      { type: 'type', text: `מה היה היתרון של ביל גייטס?`, bare: true, progress: false },
      { type: 'line', text: `ביל גייטס: יתרון מרכזי שהיה לי — הייתי קנאי.` },
      { type: 'mark', text: `הוא רצה שבבנק יהיה תמיד כסף לשנה שלמה בלי הכנסות.`, key: 'לשנה' },
      { type: 'pop', text: `כשהתחיל, המקובל היה שתוכנה צריכה להיות חינם.`, key: 'חינם' },
      { type: 'line', text: `שתי מילים בחוזה, "מיטב המאמצים", החזירו לו את השליטה במוצר.` },
      { type: 'line', text: `גם בשיא, הוא דיבר רק על מה שעוד לא עובד.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"יתרון מרכזי שהיה לי הוא שהייתי קנאי: לקחתי את כל היכולות שלי, יום ולילה, והתמקדתי רק באיך כותבים תוכנה טובה." 💻

ביל גייטס, כפי שדייוויד סנרה מגולל ב-Founders. הוא היה אובססיבי לעלויות, ורצה שבבנק יהיה תמיד כסף לשנה שלמה שבה אף לקוח לא משלם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'בילגייטס', 'מיקרוסופט', 'יזמות', 'מיקוד', 'עסקים', 'Founders'] },
  { day: '23', slug: 'dana-white-no-days-off-diary-of-a-ceo', audioId: '1031203210559520',
    scenes: [
      { type: 'type', text: `רוצים עסק כדי שיהיה יותר זמן?`, bare: true, progress: false },
      { type: 'line', text: `דיינה וייט: מי שמקים עסק בשביל זמן פנוי — בוחר בדבר הלא נכון.` },
      { type: 'mark', text: `אין ימי חופש, ויש בעיות לפתור כל בוקר.`, key: 'חופש' },
      { type: 'pop', text: `בקורונה סירב לפטר: "לעולם לא אבחר בכסף על פני אנשים."`, key: 'לפטר' },
      { type: 'line', text: `כדי לדעת מה אתם רוצים, צריך לדעת מה אתם לא רוצים.` },
      { type: 'line', text: `התרחיש הגרוע? חוזרים להיות שכירים. וזה לא תרחיש רע.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"אם אתם רוצים להקים עסק משלכם כי אתם רוצים יותר זמן לעצמכם, אתם בוחרים בדבר הלא נכון." 🥊

דיינה וייט אצל סטיבן ברטלט. בגיל 19 עזב עבודה בטוחה במלון כדי להיכנס לעולם הקרבות — והכלל שלו: כדי לדעת מה אתם רוצים, צריך לדעת מה אתם לא רוצים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דיינהוייט', 'UFC', 'יזמות', 'עסקים', 'סטיבןברטלט', 'סיכון'] },
  { day: '24', slug: 'sam-sulek-train-hard-before-smart-modern-wisdom', audioId: '546771675662388',
    scenes: [
      { type: 'type', text: `להתאמן חזק או חכם?`, bare: true, progress: false },
      { type: 'line', text: `סם סולק: אני מעדיף להתאמן ממש חזק מאשר ממש חכם.` },
      { type: 'mark', text: `תרגיל פשוט שמבוצע חזק עדיף על תרגיל מתוחכם.`, key: 'פשוט' },
      { type: 'pop', text: `מה שנראה מטורף למתחיל הוא יום רגיל למי שהסתגל.`, key: 'מטורף' },
      { type: 'line', text: `השאלה שלו: מה אני של בעוד שנה הייתי רוצה שאעשה עכשיו?` },
      { type: 'line', text: `אפס אימונים בשבוע? אחד זה יותר מאפס.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"אני מעדיף להתאמן ממש חזק מאשר ממש חכם." 🏋️

סם סולק אצל כריס וויליאמסון. הוא לא אומר לוותר על אימון נכון — אלא מה בא ראשון: מאמץ קודם לתחכום.

ולמי שנמצא באפס אימונים בשבוע: אחד זה יותר מאפס.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סםסולק', 'אימוןכוח', 'כושר', 'מאמץ', 'משמעת', 'בריאות'] },
  { day: '25', slug: 'carlo-rovelli-no-objective-reality-joe-rogan', audioId: '1588297948715714',
    scenes: [
      { type: 'type', text: `יש מציאות אחת אובייקטיבית?`, bare: true, progress: false },
      { type: 'line', text: `קרלו רובלי: החלום על אובייקטיביות מוחלטת הוא הטעות.` },
      { type: 'mark', text: `המציאות, לפיו, היא רשת של השפעות הדדיות.`, key: 'רשת' },
      { type: 'pop', text: `שעון גבוה מתקתק מהר יותר משעון נמוך.`, key: 'מהר' },
      { type: 'line', text: `ולכן הראש מבוגר מעט מהרגליים.` },
      { type: 'line', text: `ומה היה לפני המפץ הגדול? התשובה הראשונה: "אנחנו לא יודעים".`, invert: true },
      { type: 'cta' },
    ],
    caption: `"החלום הזה על אובייקטיביות מוחלטת, לדעתי, הוא הטעות." 🌌

הפיזיקאי קרלו רובלי אצל ג'ו רוגן. לפי רובלי, מכניקת הקוונטים מלמדת שאין מציאות אחת שאפשר להביט בה מבחוץ — זו פרשנות אחת מכמה, והוא אומר זאת בעצמו.

ובדרך: שעון גבוה מתקתק מהר יותר משעון נמוך, ולכן הראש מבוגר מעט מהרגליים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קרלורובלי', 'גורוגן', 'פיזיקה', 'קוונטים', 'זמן', 'מדע'] },
  { day: '26', slug: 'mohnish-pabrai-never-sell-great-business-informo', audioId: '864536098206214',
    scenes: [
      { type: 'type', text: `מתי מוכרים עסק מצוין?`, bare: true, progress: false },
      { type: 'line', text: `מוניש פבראי: עסקים מצוינים נדירים מאוד — מחזיקים בהם גם כשהם יקרים.` },
      { type: 'mark', text: `לקח לו יותר מ-20 שנה ללמוד את זה.`, key: 'ללמוד' },
      { type: 'pop', text: `התשואה של מדד מגיעה ממעט מאוד חברות.`, key: 'ממעט' },
      { type: 'line', text: `רוב הקרב, לדבריו, בצד החיסכון: להוציא פחות ממה שמרוויחים.` },
      { type: 'line', text: `מינוף הוא הסיבה הגדולה ביותר שעסקים — ומשקיעים — נופלים.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"עסקים מצוינים הם נדירים מאוד, וצריך להחזיק בהם גם כשהם נראים יקרים מדי. לקח לי יותר מ-20 שנה ללמוד את זה." 📊

מוניש פבראי ב-informo. רוב הקרב, לדבריו, הוא בצד החיסכון — ומינוף הוא בעיניו הסיבה הגדולה ביותר שעסקים נופלים, וגם משקיעים.

⚠️ אין באמור ייעוץ השקעות.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מונישפבראי', 'השקעות', 'כסף', 'חיסכון', 'מינוף', 'עסקים'] },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  { day: '20', slug: 'michelle-thaller-universe-not-built-for-us-big-think', format: 'quote', kicker: 'ציטוט',
    caption: `"היקום לא תוכנן ולא נבנה כדי להיות מובן לתודעה האנושית." 🌌

ד"ר מישל ת'אלר ב-Big Think, על מדע כהתקרבות הדרגתית למציאות — בלי ודאות שנגיע אליה אי פעם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מישלתאלר', 'אסטרונומיה', 'פיזיקה', 'יקום', 'מדע', 'סקרנות'] },
  { day: '21', slug: 'michael-moritz-first-fourteen-years-invest-like-the-best', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `מייקל מוריץ שואל מייסדים בעיקר על הילדות שלהם — על השנים שעד גיל 12–14. 🧒

אצל פטריק אושונסי: למה לדבריו האדם שבפנים לא משתנה, ומה השאלה שהוא מוצא חושפנית במיוחד.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מייקלמוריץ', 'הוןסיכון', 'מנהיגות', 'ילדות', 'קריירה', 'יזמות'] },
  { day: '22', slug: 'kevin-ryan-ten-year-trends-tim-ferriss', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"כדי לבנות חברה חשובה, לצערי, אי אפשר לעשות את זה בשנתיים-שלוש. זה לוקח עשר שנים." 📈

קווין ריאן אצל טים פריס: איך מזהים מגמה של עשר שנים, למה ההזדמנויות נמצאות בהשפעה מסדר שני — ומה עושים כשהשוק מתהפך.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'קוויןריאן', 'טימפריס', 'יזמות', 'מגמות', 'סטארטאפים', 'עסקים'] },
  { day: '23', slug: 'robert-downey-jr-discipline-living-room-podcast', format: 'quote', kicker: 'ציטוט',
    caption: `"אני לא כזה מתפקד. מה שאני כן, זה ממושמע מספיק כדי לכסות על החסרונות שלי." 🎬

רוברט דאוני ג'וניור אצל כריס וורטון, על משמעת, כישלון כנורמה — והעצה הכי טובה שקיבל: לדעת בכל רגע מה אתה עושה עכשיו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'רוברטדאוניגוניור', 'משמעת', 'מודעותעצמית', 'כישלון', 'מיינדסט', 'השראה'] },
  { day: '24', slug: 'alice-han-china-four-ds-what-now', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `מה באמת מדאיג את מקבלי ההחלטות בסין? לפי אליס האן — לא האידיאולוגיה, אלא ארבע בעיות מבניות. 📉

אליס האן אצל טרוור נואה: חוב, ביקוש חלש ודמוגרפיה — ולמה הבעיה הפנימית של סין הופכת לבעיה של כולם.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אליסהאן', 'טרוורנואה', 'סין', 'כלכלה', 'דמוגרפיה', 'חוב'] },
  { day: '25', slug: 'ronnie-fieg-kith-more-than-they-pay-for-open-residency', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"תנו לאנשים יותר ממה שהם משלמים עליו. זה המוטו." 👟

רוני פיג, מייסד Kith, על המוטו שבנה את המותג.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'רוניפיג', 'Kith', 'מותג', 'יזמות', 'עסקים', 'אופנה'] },
  { day: '26', slug: 'tony-robbins-ai-future-of-work-meaning', format: 'quote', kicker: 'ציטוט',
    caption: `"אנשים לא יוחלפו על ידי AI. הם יוחלפו על ידי מישהו שיודע להשתמש ב-AI." 🤖

טוני רובינס אצל סטיבן ברטלט. האיום האמיתי של AI, לדבריו, אינו טכנולוגי — אלא פסיכולוגי: מי שיאבד את עבודתו עלול לאבד גם את תחושת המשמעות.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'טונירובינס', 'בינהמלאכותית', 'עתידהעבודה', 'משמעות', 'קריירה', 'סטיבןברטלט'] },
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
REELS.forEach((r) => live(r, at(r.day, r.hhmmZ || '10:00', MO(r))));
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-w8-'));
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
      when: at(r.day, r.hhmmZ || '10:00', MO(r)), caption: r.caption, hashtags: r.hashtags,
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
