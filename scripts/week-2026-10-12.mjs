#!/usr/bin/env node
// Week of 2026-10-12 → 10-18.
//
//   09:00 IDT  מיתוס ↔ מציאות   (re-cut of an episode digested ≥4 weeks ago)
//   13:00 IDT  digest reel      (an episode never used as any reel)
//   20:00 IDT  feed post        (lessons / carousel / quote)
//
//   node scripts/week-2026-10-12.mjs [--only=myth|reels|posts]
//
// Three never-reeled episodes exist (Moritz, Downey Jr., Kevin Ryan), so the
// 13:00 slot runs Mon, Wed and Fri: 17 items. The blog sets that number.

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

// ── מיתוס ↔ מציאות (09:00) ──────────────────────────────────
// Re-cuts of episodes whose digest ran at least four weeks earlier. The
// reality line is also the grid thumbnail, so it names its subject.
const MYTHS = [
  {
    day: '12', slug: 'sam-harris-clear-thinking-mindfulness-ai',
    myth: `מדיטציה היא להשתיק את המחשבות.`,
    reality: `מיינדפולנס אינו להשתיק מחשבות — אלא להבחין בהן כמחשבות.`,
    context: `כמעט אף אחד לא מסוגל לשים לב לדבר אחד 30 שניות ברציפות.`,
    audioId: '1161033588023183',
    caption: `מיתוס ↔ מציאות 🧘

סם האריס אצל אנדי גלפין: מיינדפולנס אינו ניסיון להשתיק מחשבות, אלא להבחין בהן כהופעות — בדיוק כפי שמתעוררים מחלום.

ולדבריו, כמעט אף אחד אינו מסוגל לשים לב לדבר אחד במשך 30 שניות ברציפות — וזה שורש הסבל הפסיכולוגי היומיומי.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סםהאריס', 'מיינדפולנס', 'מדיטציה', 'קשב', 'פסיכולוגיה', 'מיתוסים'],
  },
  {
    day: '13', slug: 'vonda-wright-mobility-ageing-diary-of-a-ceo',
    myth: `עם הגיל פשוט צריך להאט.`,
    reality: `אין תירוץ להאט לפני אמצע שנות ה-70 לחייכם.`,
    context: `בן 80 שמרים משקולות חזק תפקודית כמו בן 60 שלא.`,
    audioId: '6909262049112583',
    caption: `מיתוס ↔ מציאות 💪

"אם אתה בן 80 שמרים משקולות באופן עקבי, אתה חזק תפקודית כמו אדם בן 60 שלא עושה את זה."

ד"ר וונדה רייט אצל סטיבן ברטלט. הטענה המרכזית שלה: אין תירוץ להאט לפני אמצע שנות ה-70. וכאב פרקים, לדבריה, אינו גזרה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'וונדהרייט', 'הזדקנות', 'אימוןכוח', 'ניידות', 'בריאות', 'מיתוסים'],
  },
  {
    day: '14', slug: 'offer-blueprint-hormozi-sanchez-priestley',
    myth: `מחיר נכון הוא מחיר שכולם מסכימים לו.`,
    reality: `התמחור מדויק כששבעה מתוך עשרה אומרים "לא".`,
    context: `אם אף אחד לא מתנגד למחיר — אתם זולים מדי.`,
    audioId: '3679159392392793',
    caption: `מיתוס ↔ מציאות 💼

"בדרך כלל, התמחור שלכם מדויק כששבעה מתוך עשרה אומרים 'לא'."

אלכס הורמוזי, לצד קודי סאנצ'ז ודניאל פריסטלי, אצל סטיבן ברטלט. אם אף אחד לא מתנגד למחיר — אתם פשוט זולים מדי.

וההחלטה בעלת המינוף הגבוה ביותר, לפי השיחה: למי למכור.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הורמוזי', 'תמחור', 'מכירות', 'עסקים', 'יזמות', 'מיתוסים'],
  },
  {
    day: '15', slug: 'fei-fei-li-spatial-intelligence-huberman',
    myth: `הבינה המלאכותית הבאה היא פשוט מודל שפה גדול יותר.`,
    reality: `הגבול הבא של AI נמצא מעבר לשפה — בתבונה מרחבית ופיזית.`,
    context: `מוערך שכמחצית מפעילות קליפת המוח עוסקת בראייה.`,
    audioId: '659733666333735',
    caption: `מיתוס ↔ מציאות 👁️

"בני אדם מתפתחים קודם כול טרום-מילולית. לאבולוציה לקחו 500 מיליון שנה בלי תקשורת מילולית."

פרופ' פיי-פיי לי אצל אנדרו הוברמן. מכאן הטענה שלה: הגבול הבא של הבינה המלאכותית נמצא מעבר לשפה — בתבונה מרחבית ופיזית.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'פייפיילי', 'הוברמן', 'בינהמלאכותית', 'ראייה', 'מוח', 'מיתוסים'],
  },
  {
    day: '16', slug: 'khabib-nurmagomedov-dagestan-lex-fridman-500',
    myth: `אלופים נולדים עם כישרון.`,
    reality: `לוחמי דאגסטן נבנים משרשרת מאמנים שנמשכת דורות.`,
    context: `אביו של חביב בנה חדר כושר בבית, ואימן שם את ילדי הכפר.`,
    audioId: '3062218523947162',
    caption: `מיתוס ↔ מציאות 🥋

"כשאתה נכנס לחדר החשוך והלא נוח, ונשאר בו הרבה זמן — לא משנה כמה קשה."

חביב נורמגומדוב אצל לקס פרידמן. כששואלים אותו מאיפה מגיעה ההצלחה של לוחמי דאגסטן, התשובה שלו אינה כישרון — אלא שרשרת של מאמנים שנמשכת דורות.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'חביב', 'לקספרידמן', 'MMA', 'משמעת', 'אימון', 'מיתוסים'],
  },
  {
    day: '17', slug: 'laurence-fishburne-matrix-physics-startalk',
    myth: `ב"מטריקס", בני אדם הם סוללה מצוינת.`,
    reality: `אדם מקרין 80 עד 100 ואט — בערך כמו נורה אחת.`,
    context: `לפי טייסון, למכונות עדיף פשוט לדלג עלינו.`,
    audioId: '642822283435945',
    caption: `מיתוס ↔ מציאות 💡

"הם מאכילים אותנו. אז מה שהם מאכילים אותנו בו — שיאכילו בזה את עצמם. עוקפים את המתווך, פשוטו כמשמעו."

ניל דה-גראס טייסון מפרק, מול לורנס פישבורן, את ההנחה המרכזית של 'מטריקס': בני אדם מקרינים בערך 80 עד 100 ואט — פחות או יותר נורה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'לורנספישבורן', 'ניילדהגראסטייסון', 'מטריקס', 'פיזיקה', 'סטארטוק', 'מיתוסים'],
  },
  {
    day: '18', slug: 'seth-godin-four-horsemen-mediocrity-bigdeal',
    myth: `פשרה תמיד משפרת את התוצאה.`,
    reality: `פשרה רעה מלטשת את הקצוות — עד שאיש לא שם לב.`,
    context: `סת גודין: עשית מה שכולם עושים? אין צורך לחתום על זה בשמך.`,
    audioId: '429293805595060',
    caption: `מיתוס ↔ מציאות ✍️

סת גודין אצל קודי סאנצ'ז: פשרה מועילה משפרת את הדבר. פשרה רעה מלטשת ממנו את הקצוות — עד שאיש לא שם לב אליו.

ועל ארבעת הכוחות שמושכים לבינוניות, הראשון הוא הפשוט מכולם: אם עשית מה שכולם עושים, לא צריך לחתום על זה בשם שלך.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סתגודין', 'בינוניות', 'יצירתיות', 'עבודה', 'אומץ', 'מיתוסים'],
  },
];

// ── digest reels (13:00) — the three never-reeled episodes ──
const REELS = [
  {
    day: '12', slug: 'michael-moritz-first-fourteen-years-invest-like-the-best', audioId: '368344604025863',
    scenes: [
      { type: 'type', text: `מה מגלה הילדות על מייסד?`, bare: true, progress: false },
      { type: 'line', text: `מייקל מוריץ: האדם שבפנים לא משתנה — רק העוצמה כלפי חוץ.` },
      { type: 'mark', text: `הוא שואל מייסדים בעיקר על השנים שעד גיל 14.`, key: 'מייסדים' },
      { type: 'pop', text: `אנשים לא "גדלים" מתוך מה שעיצב אותם.`, key: 'גדלים' },
      { type: 'line', text: `השאלה החושפנית: מה הדבר האחד שהייתם משנים?` },
      { type: 'line', text: `מה חשוב בסוף? מערכות יחסים — וההבנה שכולנו חסרי חשיבות.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"האדם שבפנים לא משתנה. מה שמשתנה הוא העוצמה כלפי חוץ." 🧒

מייקל מוריץ אצל פטריק אושונסי. הוא ידוע בכך שהוא שואל מייסדים בעיקר על הילדות שלהם — על השנים שעד גיל 12–14.

והשאלה שהוא מוצא חושפנית במיוחד: אם הייתם יכולים לשנות דבר אחד שעשיתם, מה זה היה?

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מייקלמוריץ', 'הוןסיכון', 'מנהיגות', 'ילדות', 'קריירה', 'יזמות'],
  },
  {
    day: '14', slug: 'robert-downey-jr-discipline-living-room-podcast', audioId: '622819303274042',
    scenes: [
      { type: 'type', text: `איך מחזיקים מעמד אחרי השנים הפרועות?`, bare: true, progress: false },
      { type: 'line', text: `רוברט דאוני ג'וניור: אני לא כזה מתפקד — אני ממושמע מספיק.` },
      { type: 'stat', value: '70%', text: `מתשומת הלב שלו הולכים, לדבריו, על לשמור על עצמו.` },
      { type: 'mark', text: `כישלון, לדבריו, הוא הנורמה.`, key: 'הנורמה' },
      { type: 'pop', text: `ולכן חשוב לעשות בכוונה דברים שאתה לא טוב בהם.`, key: 'בכוונה' },
      { type: 'line', text: `העצה הכי טובה שקיבל: לדעת בכל רגע מה אתה עושה עכשיו.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"אני לא כזה מתפקד. מה שאני כן, זה ממושמע מספיק כדי לכסות על החסרונות שלי." 🎬

רוברט דאוני ג'וניור אצל כריס וורטון. בעשרים השנים האחרונות, לדבריו, 70% מתשומת הלב שלו הולכים על לשמור על עצמו.

כישלון, לדבריו, הוא הנורמה — ולכן חשוב לעשות בכוונה דברים שאתה לא טוב בהם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'רוברטדאוניגוניור', 'משמעת', 'מודעותעצמית', 'כישלון', 'מיינדסט', 'השראה'],
  },
  {
    day: '16', slug: 'kevin-ryan-ten-year-trends-tim-ferriss', audioId: '2923548401114855',
    scenes: [
      { type: 'type', text: `כמה זמן לוקח לבנות חברה חשובה?`, bare: true, progress: false },
      { type: 'line', text: `קווין ריאן: חברה חשובה לא בונים בשנתיים-שלוש. זה לוקח עשר שנים.` },
      { type: 'mark', text: `הוא מהמר רק על מגמות שיחזיקו עשר שנים.`, key: 'מגמות' },
      { type: 'pop', text: `ההזדמנויות הטובות נמצאות בהשפעה מסדר שני.`, key: 'שני' },
      { type: 'line', text: `רעיון שלא יוצא לו מהראש שבועיים — הוא עושה אותו.` },
      { type: 'line', text: `וכשהשוק מתהפך, צריך לדעת למכור — גם במחיר מאכזב.`, invert: true },
      { type: 'cta' },
    ],
    caption: `"כדי לבנות חברה חשובה, לצערי, אי אפשר לעשות את זה בשנתיים-שלוש. זה לוקח עשר שנים." 📈

קווין ריאן אצל טים פריס. הוא מהמר רק על מגמות שיחזיקו עשר שנים — וההזדמנויות הטובות, לדבריו, נמצאות לעתים קרובות בהשפעה מסדר שני: מי מספק את המנצחים.

ומתחילים צר: ביזנס אינסיידר התחיל בשלושה עיתונאים שכיסו רק את סצנת הטכנולוגיה של ניו יורק.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קוויןריאן', 'טימפריס', 'יזמות', 'מגמות', 'סטארטאפים', 'עסקים'],
  },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  {
    day: '12', slug: 'michelle-khare-fear-nine-month-plan-rich-roll', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"אני כנראה הפחדנית הכי גדולה מבין כל מבצעי הפעלולים שקיימים על כדור הארץ." 🎬

מישל קארה אצל ריץ' רול, על פחד כחומר גלם — ועל תשעה חודשים של תוכנית לפני שהתפטרה.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מישלקארה', 'ריצרול', 'פחד', 'קריירה', 'יצירתוכן', 'אומץ'],
  },
  {
    day: '13', slug: 'andrew-ng-ai-jobs-product-bottleneck-silicon-valley-girl', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `לפי ניתוחים של כלכלנים שאנדרו אנג מצטט, בינה מלאכותית יכולה לבצע כ-30 עד 40 אחוזים מהמשימות ברוב המשרות — והיתרה נעשית בעלת ערך רב יותר, לא פחות. 🤖

אנג אצל מרינה מוגילקו: למה מספר המשרות בפיתוח תוכנה דווקא עלה, ומהו "צוואר הבקבוק של ניהול המוצר".

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנדרואנג', 'בינהמלאכותית', 'עתידהעבודה', 'קריירה', 'טכנולוגיה', 'מוצר'],
  },
  {
    day: '14', slug: 'andrew-huberman-neuroplasticity-focus-rich-roll', format: 'quote', kicker: 'ציטוט',
    caption: `"נוירופלסטיות מופעלת על ידי מיקוד עז — אבל היא מתרחשת בזמן שינה עמוקה ומנוחה." 🧠

אנדרו הוברמן אצל ריץ' רול, על המנגנון שמשנה את המוח אחרי גיל 25.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הוברמן', 'ריצרול', 'נוירופלסטיות', 'מוח', 'שינה', 'למידה'],
  },
  {
    day: '15', slug: 'stasha-gominak-vitamin-d-sleep-repair-diary-of-a-ceo', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `ד"ר סטאשה גומינק, נוירולוגית, הגיעה לוויטמין D במקרה — ומצאה שכל אדם זקוק לכמות אחרת. 💊

אצל סטיבן ברטלט: מה קרה כשתיקנה למטופלים מחסור אחד, ולמה לדבריה ויטמינים מסוכנים כמו תרופה כשלא יודעים מה עושים איתם.

3 דברים שלמדנו, בקרוסלה 👇

⚠️ אין באמור ייעוץ רפואי. לפני נטילת תוספים — התייעצו עם רופא.

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'סטאשהגומינק', 'ויטמיןD', 'תוספים', 'שינה', 'בריאות', 'סטיבןברטלט'],
  },
  {
    day: '16', slug: 'tina-seelig-luck-sailboat-mel-robbins', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"אנחנו תמיד במרחק החלטה אחת מחיים אחרים לגמרי." ⛵

טינה סיליג אצל מל רובינס: מזל אינו מה שקורה לכם — אלא איך אתם מגיבים. ואיך בונים "מפרשית" בשלושה שלבים.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'טינהסיליג', 'מלרובינס', 'מזל', 'קריירה', 'הזדמנויות', 'מיינדסט'],
  },
  {
    day: '17', slug: 'codie-sanchez-ownership-without-capital-diary-of-a-ceo', format: 'quote', kicker: 'ציטוט',
    caption: `"הדרך היחידה לחופש היא דרך בעלות, והעולם לא רוצה לתת לכם אותה." 🔑

קודי סאנצ'ז אצל סטיבן ברטלט, על שלוש הדרכים לקנות עסק — ורק אחת מהן דורשת הון.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קודיסאנצז', 'סטיבןברטלט', 'בעלות', 'עסקים', 'יזמות', 'קריירה'],
  },
  {
    day: '18', slug: 'richard-davidson-contemplative-aerobics-foundmyfitness', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `מדיטציה או אימון? לפי פרופ' ריצ'רד דיווידסון אין צורך לבחור — אפשר לעשות את שניהם באותו זמן. 🧘

אצל ד"ר רונדה פטריק: למה פלסטיות מוחית היא "ניטרלית", ומה זה אומר על מה שממלא את הראש בזמן המאמץ.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'ריצרדדיווידסון', 'רונדהפטריק', 'מדיטציה', 'אימון', 'מוח', 'רווחהנפשית'],
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-w7-'));
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
