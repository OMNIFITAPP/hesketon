#!/usr/bin/env node
// Week of 2026-09-14 → 09-20. Three slots a day:
//
//   09:00 IDT  מיתוס ↔ מציאות   (re-cut of an episode digested ≥4 weeks ago)
//   13:00 IDT  digest reel      (an episode never used as any reel)
//   20:00 IDT  feed post        (carousel / quote / lessons)
//
//   node scripts/week-2026-09-14.mjs [--only=myth|reels|posts]
//
// Built Monday morning, after the 09:00 slot had passed: Monday has no myth
// reel (James Clear moves to next week). Sunday has no digest: the only
// never-reeled episode left, Picard, goes live on the blog at 18:00 that day,
// and an Instagram item must never precede its blog post.
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

const MO = (x) => x.month || '09';
const at = (day, hhmmZ, month = '09') => `2026-${month}-${day}T${hhmmZ}:00.000Z`;
const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

// ── מיתוס ↔ מציאות (09:00) ──────────────────────────────────
// The reality line is also the grid thumbnail, so it must stand alone —
// no pronoun without a referent.
const MYTHS = [
  {
    day: '15', slug: 'andy-stumpf-psychology-of-endurance-williamson',
    myth: 'אנשים מוותרים כי כואב להם.',
    reality: 'אנשים מוותרים כשהמרחק שנותר ליעד מציף אותם.',
    context: 'הפתרון: לחלק את הדרך לצעד הכי קטן — ולהתמקד רק בו.',
    audioId: '404528493609472',
    caption: `מיתוס ↔ מציאות 🪖

"השריר שנכשל באימון הלוחמים אינו מתחת לצוואר. הוא בין האוזניים."

לוחם ה-Navy SEAL אנדי סטאמפ אצל כריס וויליאמסון: אנשים לא מוותרים בגלל כאב פיזי — אלא כשהמרחק שנותר ליעד מציף אותם.

הפתרון שלו: לחלק את הדרך לצעד הכי קטן, ולהתמקד רק בו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנדיסטאמפ', 'חוסןמנטלי', 'מיינדסט', 'התמדה', 'משמעת', 'מיתוסים'],
  },
  {
    day: '16', slug: 'mrbeast-joe-rogan-possible-time-and-money',
    myth: 'יש רעיונות שהם פשוט בלתי אפשריים.',
    reality: 'כמעט הכול אפשרי, אם אתם מוכנים להשקיע את הזמן ואת הכסף.',
    context: 'ההתנגדות היחידה שמותרת בצוות שלו: "לא שווה את זה".',
    audioId: '7386171101395182',
    caption: `מיתוס ↔ מציאות 💸

"כמעט הכול אפשרי, אם אתם מוכנים להשקיע את הזמן ואת הכסף."

MrBeast אצל ג'ו רוגן, על הכלל שהוא כופה על הצוות: אסור לומר "בלתי אפשרי" לפני שמתמחרים את הרעיון בזמן ובכסף. ההתנגדות היחידה שמותרת היא "לא שווה את זה".

מסכימים? ספרו לנו בתגובות 👇
התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מיסטרביסט', 'גורוגן', 'יצירתוכן', 'עסקים', 'יזמות', 'מיתוסים'],
  },
  {
    day: '17', slug: 'andrew-huberman-neuroplasticity-focus-rich-roll',
    myth: 'אחרי גיל 25 המוח כבר לא משתנה.',
    reality: 'אחרי גיל 25 המוח עדיין משתנה — אבל רק כשממקדים את תשומת הלב.',
    context: 'והשינוי עצמו מתרחש בזמן שינה עמוקה ומנוחה.',
    audioId: '4001862856739346',
    caption: `מיתוס ↔ מציאות 🧠

"נוירופלסטיות מופעלת על ידי מיקוד עז — אבל היא מתרחשת בזמן שינה עמוקה ומנוחה."

אנדרו הוברמן אצל ריץ' רול: עד גיל 25 המוח משתנה כמעט מעצמו. אחרי כן, שינוי מחייב מיקוד — ואז משתחרר אצטילכולין שמסמן את הנוירונים לשינוי.

והתסיסה בהתחלה? היא לא סימן לכישלון. היא השער.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הוברמן', 'ריצרול', 'נוירופלסטיות', 'מוח', 'למידה', 'מיתוסים'],
  },
  {
    day: '18', slug: 'darby-saxbe-father-brain-modern-wisdom',
    myth: 'רק המוח של האם משתנה בהורות.',
    reality: 'גם המוח של האב משתנה — והשינוי תלוי בכמה הוא מעורב.',
    context: 'וזה אינו נזק: המוח נעשה יעיל יותר במה שרלוונטי לתינוק.',
    audioId: '706731386409844',
    caption: `מיתוס ↔ מציאות 👶

דארבי סקסבי אצל כריס וויליאמסון: היא סורקת אבות באמצע ההיריון של בת הזוג ושוב אחרי הלידה — וגם אצלם המוח מאבד נפח חומר אפור.

ההבדל מהאם: אצל האב השינוי קטן יותר, ותלוי בכמה הוא מעורב.

וזה אינו נזק. הפרשנות היא גיזום — המוח נעשה יעיל יותר במה שרלוונטי לתינוק.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דארביסקסבי', 'אבהות', 'הורות', 'מוח', 'מדע', 'מיתוסים'],
  },
  {
    day: '19', slug: 'rick-rubin-creativity-huberman',
    myth: 'יצירתיות היא שאלה של כישרון.',
    reality: 'היצירה מתחילה בהבחנה: במה שאתם שמים לב אליו.',
    context: 'השאלה "איזו מהן אני אוהב יותר?" היא כל האמנות.',
    audioId: '5479037848790134',
    caption: `מיתוס ↔ מציאות 🎨

"אם אתן לכם שתי מנות אוכל ואבקש שתטעמו ותאמרו איזו מהן אתם אוהבים יותר — בדרך כלל זה די פשוט. ואני חושב שאפשר לזקק את רוב היצירתיות לזה."

ריק רובין אצל אנדרו הוברמן: היצירה אינה מתחילה ברעיון, אלא בהבחנה — במה שאתם שמים לב אליו ומה אתם מרגישים מולו.

והשאלה "איך זה יתפקד ברשתות"? משהו אחר לגמרי.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'ריקרובין', 'הוברמן', 'יצירתיות', 'אמנות', 'השראה', 'מיתוסים'],
  },
  {
    day: '20', slug: 'brian-cox-particle-physics-frontier-startalk',
    myth: '"חומר אפל" הוא סוג של חומר.',
    reality: 'אנחנו רואים רק את השפעת הכבידה — לא את מה שמייצר אותה.',
    context: 'ולכן, לפי טייסון, השם המדויק הוא "כבידה אפלה".',
    audioId: '174020782380726',
    caption: `מיתוס ↔ מציאות 🔭

"חומר אפל"? ניל דה-גראס טייסון מתקן מונח שכולנו משתמשים בו: אנחנו רואים רק את השפעת הכבידה — ולא יודעים מה מייצר אותה. ולכן, לדבריו, השם המדויק הוא "כבידה אפלה".

מתוך השיחה עם פרופ' בריאן קוקס ב-StarTalk, שבה קוקס מודה: לראשונה, פיזיקת החלקיקים לא יודעת מה מעבר לפינה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'בריאןקוקס', 'ניילדהגראסטייסון', 'סטארטוק', 'פיזיקה', 'יקום', 'מיתוסים'],
  },
];

// ── digest reels (13:00) — every one a first-time episode ───
const REELS = [
  {
    day: '14', slug: 'jocko-willink-confidence-tradeoffs-modern-wisdom', audioId: '2206809489794688',
    scenes: [
      { type: 'type', text: 'מאיפה מגיע ביטחון עצמי?', bare: true, progress: false },
      { type: 'line', text: 'ביטחון עצמי מתחיל במשפט "אני לא בטוח מה לעשות".' },
      { type: 'mark', text: 'ווילינק מדגים: מנהל שאומר את זה בישיבה, מול הצוות.', key: 'בישיבה' },
      { type: 'pop', text: 'אין פתרונות — רק פשרות.', key: 'פשרות' },
      { type: 'line', text: 'מאמץ שמושקע כאן נלקח משם.' },
      { type: 'line', text: 'הכאב אינו בבחירה — אלא בצפייה במה שנשאר מאחור.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אחד הדברים העמוקים ביותר שאפשר לעשות כדי להיות בטוח יותר בעצמך הוא להיות בסדר עם לומר: אני לא בטוח מה לעשות עכשיו." 🎖️

ג'וקו ווילינק אצל כריס וויליאמסון. הביטחון, לדבריו, לא מגיע מהישגים — אלא מהיכולת להודות שאינך יודע. גם כמנהל, מול הצוות.

והכלל שמנהל אצלו את הזמן: אין פתרונות, רק פשרות.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גוקוווילינק', 'ביטחוןעצמי', 'מנהיגות', 'מיינדסט', 'החלטות', 'משמעת'],
  },
  {
    day: '15', slug: 'stasha-gominak-vitamin-d-sleep-repair-diary-of-a-ceo', audioId: '1949007665469799',
    scenes: [
      { type: 'type', text: 'מה קורה כשמתקנים מחסור אחד?', bare: true, progress: false },
      { type: 'line', text: 'נוירולוגית הגיעה לוויטמין D במקרה — דרך מטופלת עייפה.' },
      { type: 'mark', text: 'הממצא שלה: כל אדם זקוק לכמות אחרת.', key: 'אחרת' },
      { type: 'pop', text: 'אחרי שנתיים המטופלים חזרו עם תסמינים חדשים.', key: 'חדשים' },
      { type: 'line', text: 'תיקון של מחסור אחד חושף, לטענתה, מחסור אחר.' },
      { type: 'line', text: 'ויטמינים, לדבריה, מסוכנים כמו תרופה — כשלא יודעים מה עושים.', invert: true },
      { type: 'cta' },
    ],
    caption: `"הבנתי שאולי הכנסתי אותם למצב שבו הם משתמשים ביותר מאבני הבניין האלה — ובעצם דחפתי אותם למחסור אחר." 💊

ד"ר סטאשה גומינק, נוירולוגית, אצל סטיבן ברטלט. היא הגיעה לוויטמין D במקרה, ומצאה שכל אדם זקוק לכמות אחרת.

אחרי שנתיים המטופלים חזרו עם תסמינים חדשים — וההסבר שלה: תיקון של מחסור אחד מגביר את עבודת התיקון בגוף, ולכן חושף מחסור אחר.

⚠️ אין באמור ייעוץ רפואי. לפני נטילת תוספים — התייעצו עם רופא.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סטאשהגומינק', 'ויטמיןD', 'תוספים', 'שינה', 'בריאות', 'סטיבןברטלט'],
  },
  {
    day: '16', slug: 'joe-liemandt-alpha-school-two-hours-huberman', audioId: '2044003369114324',
    scenes: [
      { type: 'type', text: 'בית ספר שילדים מעדיפים על חופשה?', bare: true, progress: false },
      { type: 'line', text: 'בנותיו של ג\'ו לימנדט ביקשו לחזור לבית הספר — במקום לקייטנה.' },
      { type: 'mark', text: 'המפתח לאושר של הילד שלכם הוא סטנדרטים גבוהים.', key: 'סטנדרטים' },
      { type: 'pop', text: 'הבסיס: מחקר מ-1984 על חונכות אישית ולמידה עד שליטה.', key: 'חונכות' },
      { type: 'line', text: 'בינה מלאכותית, לדבריו, הופכת את השילוב הזה לזול.' },
      { type: 'line', text: 'ולכן הלימודים העיוניים נמשכים כשעתיים ביום.', invert: true },
      { type: 'cta' },
    ],
    caption: `"המפתח לאושר של הילד שלכם הוא סטנדרטים גבוהים." 🎒

ג'ו לימנדט אצל אנדרו הוברמן, על בית ספר שבו הלימודים העיוניים נמשכים כשעתיים ביום — וילדים מעדיפים אותו על פני חופשה.

הבסיס שהוא מצטט: מחקר משנת 1984, שמצא שחונכות אישית יחד עם למידה עד שליטה מלאה מביאות תלמידים לרמה גבוהה בהרבה. בינה מלאכותית, לדבריו, הופכת את השילוב הזה לזול.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גולימנדט', 'הוברמן', 'חינוך', 'ביתספר', 'בינהמלאכותית', 'הורות'],
  },
  {
    // Two days after the Economist Musk reel ("work becomes optional"), so
    // this one leads on a different idea: what money actually is.
    day: '17', slug: 'elon-musk-nikhil-kamath-interview', audioId: '1100316650098321',
    scenes: [
      { type: 'type', text: 'כמה באמת שווה כסף?', bare: true, progress: false },
      { type: 'line', text: 'טריליון דולר על אי בודד חסר תועלת — כי אין עבודה להקצות.' },
      { type: 'mark', text: 'כסף, לדבריו, הוא בסך הכול מסד נתונים להקצאת עבודה.', key: 'מסד' },
      { type: 'pop', text: 'ובעולם של שפע — אנרגיה היא המטבע האמיתי.', key: 'אנרגיה' },
      { type: 'line', text: 'ל-AI, לדבריו, צריכים להיות שלושה ערכים: אמת, יופי וסקרנות.' },
      { type: 'line', text: 'בנו מוצר שמועיל לאנשים. הכסף יגיע כתוצר לוואי.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אם אתם תקועים על אי בודד עם טריליון דולר, הכסף חסר תועלת — כי אין עבודה להקצות." 🏝️

אילון מאסק אצל ניקהיל קאמאת'. ההגדרה שלו לכסף: מסד נתונים להקצאת עבודה. ובעולם של שפע, אנרגיה היא המטבע האמיתי.

ולמי שרוצה לבנות משהו: התמקדו במוצר שמועיל לאנשים. הכסף יגיע כתוצר לוואי, לא כמטרה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אילוןמאסק', 'ניקהילקאמאת', 'כסף', 'בינהמלאכותית', 'יזמות', 'טכנולוגיה'],
  },
  {
    day: '18', slug: 'michelle-khare-fear-nine-month-plan-rich-roll', audioId: '1465703100656220',
    scenes: [
      { type: 'type', text: 'איך מתפטרים בלי לקפוץ לריק?', bare: true, progress: false },
      { type: 'line', text: 'מישל קארה מבצעת פעלולים קיצוניים — ומגדירה את עצמה פחדנית.' },
      { type: 'mark', text: 'מי שלא מפחד — אין מה לצפות בו.', key: 'מפחד' },
      { type: 'pop', text: 'לפני שהתפטרה היא בנתה תוכנית של תשעה חודשים.', key: 'תשעה' },
      { type: 'line', text: 'צמצום הוצאות, וצילום סרטונים בכל סוף שבוע — גם בלי לפרסם.' },
      { type: 'line', text: 'זמן הוא הדבר היחיד שאי אפשר לדחוס.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אני כנראה הפחדנית הכי גדולה מבין כל מבצעי הפעלולים שקיימים על כדור הארץ." 🎬

מישל קארה אצל ריץ' רול. היא בונה סדרה של אתגרים קיצוניים ומצהירה שהיא חרדה מטבעה — ולדבריה זו לא סתירה, זה התוכן עצמו.

לפני שעזבה משרה קבועה היא בנתה תוכנית של תשעה חודשים: צמצום הוצאות, וצילום סרטונים בכל סוף שבוע — גם בלי לפרסם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מישלקארה', 'ריצרול', 'פחד', 'קריירה', 'יצירתוכן', 'אומץ'],
  },
  {
    day: '19', slug: 'andrew-ng-ai-jobs-product-bottleneck-silicon-valley-girl', audioId: '2560548683960084',
    scenes: [
      { type: 'type', text: 'ה-AI יחליף אתכם בעבודה?', bare: true, progress: false },
      { type: 'line', text: 'אנדרו אנג: AI לא בעמדה להחליף אנשים ברוב המכריע של המשרות.' },
      { type: 'stat', value: '30–40%', text: 'מהמשימות ברוב המשרות — לפי ניתוחים שהוא מצטט.' },
      { type: 'mark', text: 'והיתרה נעשית בעלת ערך רב יותר, לא פחות.', key: 'יותר' },
      { type: 'pop', text: 'צוואר הבקבוק החדש: ההחלטה מה לבנות.', key: 'לבנות' },
      { type: 'line', text: 'מי שמשתמש ב-AI אולי יחליף את מי שלא.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אנשים שמשתמשים בבינה מלאכותית אולי יחליפו אנשים שלא משתמשים בה. אבל בינה מלאכותית לא נמצאת בעמדה להחליף אנשים ברוב המכריע של המשרות." 🤖

אנדרו אנג אצל מרינה מוגילקו. לפי ניתוחים של כלכלנים שהוא מצטט, בינה מלאכותית יכולה לבצע כ-30 עד 40 אחוזים מהמשימות ברוב המשרות — והיתרה נעשית בעלת ערך רב יותר, לא פחות.

ומכיוון שעלות הבנייה צנחה, הקושי עבר למקום אחר: ההחלטה מה לבנות.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנדרואנג', 'בינהמלאכותית', 'עתידהעבודה', 'קריירה', 'טכנולוגיה', 'מוצר'],
  },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  {
    day: '14', slug: 'sam-harris-clear-thinking-mindfulness-ai', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `כמעט אף אחד אינו מסוגל לשים לב לדבר אחד במשך 30 שניות ברציפות — ולפי סם האריס, זה שורש הסבל הפסיכולוגי היומיומי. 🧘

האריס אצל אנדי גלפין, על מיינדפולנס שאינו ניסיון להשתיק מחשבות, על ביקורת כמתנה, ועל מה שבינה מלאכותית תתקשה להחליף.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'סםהאריס', 'אנדיגלפין', 'מיינדפולנס', 'מדיטציה', 'חשיבה', 'פסיכולוגיה'],
  },
  {
    day: '15', slug: 'hormozi-100k-in-3-months-2026', format: 'quote', kicker: 'ציטוט',
    caption: `"הדרך המהירה ביותר להגיע ל-100,000 דולר היא לא הדרך המהירה ביותר להגיע למיליון או ל-10 מיליון. זו הטעות הגדולה בשאלה." 💼

אלכס הורמוזי אצל ג'ק ניל. הטעות הנפוצה של יזמים מתחילים, לדבריו: מוכרים בזול מדי ומתמקדים בסקיילינג במקום להפיק את המקסימום מכל לקוח.

ורוב העסקים לא נכשלים — היזמים פשוט מפסיקים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הורמוזי', 'יזמות', 'עסקים', 'מכירות', 'קריירה', 'שיווק'],
  },
  {
    day: '16', slug: 'khabib-nurmagomedov-dagestan-lex-fridman-500', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `חביב נורמגומדוב לא בחר בספורט — הוא התעורר לתוכו. אביו בנה חדר כושר בתוך הבית בכפר. 🥋

מתוך הפרק ה-500 של לקס פרידמן: מה מייצר לוחמים בדאגסטן, למה היריבות עם מקגרגור הייתה ענקית, והשיחה עם אמו שהכריעה את הפרישה.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'חביב', 'לקספרידמן', 'MMA', 'משמעת', 'מיינדסט', 'ספורט'],
  },
  {
    day: '17', slug: 'laurence-fishburne-matrix-physics-startalk', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `בני אדם כסוללה? לפי ניל דה-גראס טייסון אנחנו מקרינים בערך 80 עד 100 ואט — פחות או יותר נורה. 💡

לורנס פישבורן ב-StarTalk: למה הפיזיקה של 'מטריקס' לא עובדת, למה טענת הסימולציה דווקא כן מחזיקה — ואיך הוא קיבל את התפקיד.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'לורנספישבורן', 'מטריקס', 'סטארטוק', 'פיזיקה', 'סימולציה', 'מדע'],
  },
  {
    day: '18', slug: 'henry-shukman-meditation-awakening-original-love', format: 'quote', kicker: 'ציטוט',
    caption: `"מדיטציה היא ההרפתקה הגדולה של החיים — גם אם כל מה שאנחנו עושים הוא לשבת בשקט כמה דקות ביום." 🌿

הנרי שוקמן אצל ראנגן צ'טרג'י. מדיטציה, לדבריו, אינה עוד משימה ברשימה — אלא חמש דקות של להיות עם עצמך, בלי לעשות כלום.

ועקביות חשובה יותר ממשך: חמש דקות ביום עדיפות על עשרים דקות פעם בחודש.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הנרישוקמן', 'מדיטציה', 'מיינדפולנס', 'רוגע', 'הרגלים', 'בריאותנפשית'],
  },
  {
    day: '19', slug: 'kane-kallaway-content-lego-bricks-system', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"האסטרטגיה אינה הרוטב. האסטרטגיה הופכת למצרך ברגע שאתה מכיר אותה." 🧱

קיין קלאוויי: הסוד של תוכן אינו הידע — אלא המרחק שבין חזרה לחזרה. כמות האיטרציות, ואיכות השיפור בין אחת לשנייה.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'קייןקלאוויי', 'יצירתוכן', 'שיווק', 'סושיאל', 'עסקים', 'שיטה'],
  },
  {
    // Blog post goes live 18:00 IDT the same day; this goes out at 20:00.
    day: '20', slug: 'martin-picard-mitochondria-grey-hair-huberman', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"גילינו שהלבנת שיער, לפחות באופן זמני, היא הפיכה." 🧬

מרטין פיקארד אצל אנדרו הוברמן — ממצא שסותר את התמונה של הזדקנות כקו ישר. ולפיו, הגנים מסבירים לא יותר מעשרה אחוזים מאורך החיים.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מרטיןפיקארד', 'הוברמן', 'הזדקנות', 'מיטוכונדריה', 'אריכותחיים', 'מדע'],
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-w3-'));
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
    console.log(`🖼  20:00 ${p.day}.9 ${p.slug.slice(0, 26).padEnd(28)} ${p.format.padEnd(8)} ${files.length} slides`);
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
    console.log(`💭 09:00 ${m.day}.9 ${m.slug.slice(0, 26).padEnd(28)} ${info.duration}s [${sb.scenes.map((s) => (s.out - s.in).toFixed(1)).join('/')}] gate ${samples} ♪ ${trackTitle(m.audioId)}`);
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
    console.log(`🎬 13:00 ${r.day}.9 ${r.slug.slice(0, 26).padEnd(28)} ${info.duration}s [${sb.scenes.map((s) => (s.out - s.in).toFixed(1)).join('/')}] gate ${samples} ♪ ${trackTitle(r.audioId)}`);
  }
}

fs.rmSync(scratch, { recursive: true, force: true });
commit();
console.log('\n✅ queue updated');
