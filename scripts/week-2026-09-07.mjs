#!/usr/bin/env node
// Week of 2026-09-07 → 09-13. Three slots a day:
//
//   09:00 IDT  מיתוס ↔ מציאות   (new format — belief, struck, then the flip)
//   13:00 IDT  digest reel      (cold open → hook → 3 beats → punch → CTA)
//   20:00 IDT  feed post        (carousel / lessons / quote)
//
//   node scripts/week-2026-09-07.mjs [--only=myth|reels|posts]
//
// The myth reel is deliberately short (~15s vs ~26s) and structurally
// different, so the two reels never read as the same thing twice a day.
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

// Items carry an optional `month`; this week straddles Aug→Sep.
const MO = (x) => x.month || '08';
const at = (day, hhmmZ, month = '08') => `2026-${month}-${day}T${hhmmZ}:00.000Z`;
const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

// ── מיתוס ↔ מציאות (09:00) ──────────────────────────────────
// Under the new plan these re-surface episodes already used as DIGEST
// reels, in a different format and a different angle. Every one below
// last appeared as a digest at least four weeks earlier.
const MYTHS = [
  {
    day: '07', month: '09', slug: 'david-goggins-huberman-inner-strength',
    myth: 'צריך לאהוב את מה שאתה עושה כדי להצליח.',
    reality: 'יש במוח אזור שגדל רק כשעושים משהו שלא רוצים לעשות.',
    context: 'אוהבים את מה שאתם עושים? האזור הזה לא גדל.',
    audioId: '1041859307965419',
    caption: `מיתוס ↔ מציאות 🔥

"כל דבר שאי פעם עשיתי בחיי — לא רציתי לעשות אותו."

דייויד גוגינס אצל אנדרו הוברמן, על אזור במוח שגדל רק כשעושים משהו שלא רוצים לעשות.

אוהבים את מה שאתם עושים? האזור הזה לא גדל.

מסכימים? ספרו לנו בתגובות 👇
התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'דייווידגוגינס', 'הוברמן', 'משמעת', 'מיינדסט', 'כוחרצון', 'מיתוסים'],
  },
  {
    day: '08', month: '09', slug: 'tommy-wood-future-proof-brain',
    myth: 'דמנציה היא עניין של גנטיקה.',
    reality: 'בין 45% ל-70% מהמקרים ניתנים למניעה.',
    context: 'והגן APOE4 הוא "מכפיל סיכון" — לא גזר דין.',
    audioId: '257998506674114',
    caption: `מיתוס ↔ מציאות 🧠

בין 45% ל-70% ממקרי הדמנציה ניתנים למניעה — היא מונעת בעיקר מאורח חיים, לא מגזרה גנטית.

ד"ר טומי ווד אצל ג'ו רוגן. וגם הגן APOE4, שנחשב לגזר דין, הוא לדבריו "מכפיל סיכון" שאורח חיים טוב מקזז חלק גדול ממנו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'טומיווד', 'דמנציה', 'בריאותהמוח', 'גורוגן', 'מניעה', 'מיתוסים'],
  },
  {
    day: '09', month: '09', slug: 'breathing-right-nestor',
    myth: 'נשימה עמוקה = יותר חמצן = יותר טוב.',
    reality: 'העיקר אינו כמה חמצן שואפים אלא סבילות ל-CO2.',
    context: 'פחמן דו-חמצני הוא זה שמאפשר לחמצן להשתחרר אל התאים.',
    audioId: '1044245831898294',
    caption: `מיתוס ↔ מציאות 🌬️

"את רוב האנרגיה שלכם אתם לא מקבלים מאוכל ומשתייה. אתם מקבלים אותה מהנשימה."

ג'יימס נסטור אצל ריץ' רול. והמפתח אינו כמה חמצן אתם שואפים — אלא סבילות לפחמן דו-חמצני, שהוא זה שמאפשר לחמצן להשתחרר אל התאים.

הפתרון אינו טכניקה אקזוטית: לאט, נמוך ודרך האף.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'נשימה', 'גיימסנסטור', 'ריצרול', 'בריאות', 'שינה', 'מיתוסים'],
  },
  {
    day: '10', month: '09', slug: 'morgan-housel-psychology-of-money-huberman',
    myth: 'יש דרך אחת נכונה לנהל כסף.',
    reality: 'אין דרך אחת נכונה. יש את שלכם.',
    context: '"כל התנהגות היא הגיונית כשיש מספיק מידע."',
    audioId: '489323178876006',
    caption: `מיתוס ↔ מציאות 💭

"אין דרך אחת נכונה לנהל כסף. כל התנהגות היא הגיונית כשיש מספיק מידע."

מורגן האוזל אצל אנדרו הוברמן — מה שנראה כמו טירוף אצל מישהו אחר הוא בדרך כלל סיפור חיים שלם שאתם לא מכירים.

והמדד המכריע לפי קאהנמן: תחושה מכוילת של החרטה העתידית.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מורגןהאוזל', 'כסף', 'פסיכולוגיה', 'הוברמן', 'החלטות', 'מיתוסים'],
  },
  {
    day: '11', month: '09', slug: 'ido-portal-movement-mind-body-huberman',
    myth: 'תקשיבו לגוף שלכם.',
    reality: 'אל תקשיבו לגוף שלכם — המערכות שלנו משובשות מכדי להקשיב.',
    context: 'במקום זה: לפתח רזולוציה גופנית ולהבחין בפרטים הדקים.',
    audioId: '1050932209337123',
    caption: `מיתוס ↔ מציאות 🤸

"אל תקשיבו לגוף שלכם" — המערכות שלנו משובשות מכדי להקשיב.

עידו פורטל אצל אנדרו הוברמן. במקום זה הוא מציע לפתח **רזולוציה גופנית**: להבחין בפרטים הדקים, במקום לשקוע בשחור-לבן.

מסכימים? ספרו לנו בתגובות 👇
התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'עידופורטל', 'תנועה', 'הוברמן', 'בריאותוכושר', 'מודעות', 'מיתוסים'],
  },
  {
    day: '12', month: '09', slug: 'roman-yampolskiy-ai-safety-uncontrollable',
    myth: 'אם ה-AI יסתבך — פשוט נכבה אותו.',
    reality: 'נסו לכבות וירוס מחשב. נסו לכבות את רשת הביטקוין.',
    context: 'גם מי שבנה את המערכות לא יודע מה הן מסוגלות לעשות.',
    audioId: '590642038455974',
    caption: `מיתוס ↔ מציאות ⚠️

"פשוט נכבה את זה"? רומאן יאמפולסקי משיב: נסו לכבות וירוס מחשב. נסו לכבות את רשת הביטקוין.

הוא טבע את המונח "בטיחות AI" לפני כ-15 שנה, ניסה חמש שנים לפתור את הבעיה — ואז הגיע למסקנה שהיא בלתי פתירה.

וגם: מגדלים את המערכות ואז חוקרים אותן, כמו צמח חייזרי.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'יאמפולסקי', 'בטיחותAI', 'בינהמלאכותית', 'טכנולוגיה', 'סיכונים', 'מיתוסים'],
  },
  {
    day: '13', month: '09', slug: 'vinh-giang-voice-communication-skills',
    myth: 'יש לי קול משעמם. זה פשוט מה שיש.',
    reality: 'הדרך שבה אתם מדברים אינה הקול הטבעי שלכם — היא הרגלים.',
    context: 'ומה שנלמד אפשר לשנות בכל גיל.',
    audioId: '1010711630834055',
    caption: `מיתוס ↔ מציאות 🎙️

"הקול שלך הוא כלי נגינה. אל תמות עם כל המוזיקה תקועה בפנים."

וין ג'יאנג אצל ג'יי שטי: הדרך שבה אתם מדברים אינה "הקול הטבעי" שלכם, אלא סדרה של הרגלים — ומה שנלמד אפשר לשנות בכל גיל.

הכלי המוביל לשיפור: להקליט את עצמכם חמש דקות, ואז לצפות ולהקשיב. רוב האנשים בורחים מזה — וזו בדיוק הסיבה שהם תקועים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'ויןגיאנג', 'תקשורת', 'קול', 'דיבורבפומבי', 'ביטחוןעצמי', 'מיתוסים'],
  },
];

// ── digest reels (13:00) — every one a first-time episode ───
const REELS = [
  {
    day: '07', month: '09', slug: 'vonda-wright-mobility-ageing-diary-of-a-ceo', audioId: '1157813262009024',
    scenes: [
      { type: 'type', text: 'מתי באמת מותר להאט?', bare: true, progress: false },
      { type: 'line', text: 'אין תירוץ להאט לפני אמצע שנות ה-70.' },
      { type: 'mark', text: 'בן 80 שמרים משקולות חזק כמו בן 60 שלא.', key: 'משקולות' },
      { type: 'pop', text: 'כאב פרקים אינו גזרה — ואחת הסיבות לו היא משקל.', key: 'גזרה' },
      { type: 'line', text: 'עלייה של 4.5 ק"ג אינה מוסיפה 4.5 ק"ג של לחץ — הרבה יותר.' },
      { type: 'line', text: 'הכושר הטוב בחייה היה בגיל 40. היום, בגיל 57, טוב יותר.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אם אתה בן 80 שמרים משקולות באופן עקבי, אתה חזק תפקודית כמו אדם בן 60 שלא עושה את זה." 💪

ד"ר וונדה רייט אצל סטיבן בארטלט, והטענה המרכזית שלה: אין תירוץ להאט לפני אמצע שנות ה-70.

ועל עצמה: הכושר הטוב בחייה היה בגיל 40. אחר כך הגיע גיל המעבר — והיום, בגיל 57, היא במקום טוב יותר כאדם שלם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'וונדהרייט', 'ניידות', 'הזדקנות', 'כושר', 'בריאות', 'אריכותחיים'],
  },
  {
    day: '08', month: '09', slug: 'khabib-nurmagomedov-dagestan-lex-fridman-500', audioId: '1304451697253803',
    scenes: [
      { type: 'type', text: 'מאיפה מגיעים לוחמי דאגסטן?', bare: true, progress: false },
      { type: 'line', text: 'כשאתה נכנס לחדר החשוך והלא נוח — ונשאר בו הרבה זמן.' },
      { type: 'mark', text: 'התשובה אינה כישרון אלא שרשרת מאמנים שנמשכת דורות.', key: 'כישרון' },
      { type: 'pop', text: 'אביו בנה חדר כושר בתוך הבית ואימן שם את ילדי הכפר.', key: 'הבית' },
      { type: 'line', text: 'הקרב האחרון היה מתוכנן מראש — אחרי שיחה עם אמו.' },
      { type: 'line', text: 'ואת חלום אביו הוא השלים אחרי מותו. בגדול יותר.', invert: true },
      { type: 'cta' },
    ],
    caption: `"כשאתה נכנס לחדר החשוך והלא נוח, ונשאר בו הרבה זמן — לא משנה כמה קשה." 🥋

חביב נורמגומדוב אצל לקס פרידמן, בפרק ה-500.

כששואלים אותו מאיפה מגיעה ההצלחה של לוחמי דאגסטן, התשובה שלו אינה כישרון — אלא שרשרת של מאמנים שנמשכת דורות.

והקרב האחרון שלו היה מתוכנן מראש להיות האחרון, בעקבות שיחה עם אמו שאיש לא ידע עליה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'חביב', 'לקספרידמן', 'MMA', 'משמעת', 'מיינדסט', 'ספורט'],
  },
  {
    day: '09', month: '09', slug: 'seth-godin-four-horsemen-mediocrity-bigdeal', audioId: '1294217722175214',
    scenes: [
      { type: 'type', text: 'מה מושך אותנו לבינוניות?', bare: true, progress: false },
      { type: 'line', text: 'ארבעה כוחות: הכחשה, חוסר אונים, בוז ופחד.' },
      { type: 'mark', text: 'אם עשית מה שכולם עושים — לא צריך לחתום בשם שלך.', key: 'לחתום' },
      { type: 'pop', text: '"אני רק עושה את העבודה שלי" הוא סימן למערכת, לא לאדם.', key: 'למערכת' },
      { type: 'line', text: 'פשרה מועילה משפרת. פשרה רעה מלטשת את הקצוות.' },
      { type: 'line', text: 'עד שאיש לא שם לב אליו.', invert: true },
      { type: 'cta' },
    ],
    caption: `סת' גודין מונה ארבעה כוחות שמושכים אותנו לבינוניות: הכחשה, חוסר אונים, בוז ופחד. 🐎

והראשון הוא הפשוט מכולם: אם עשית מה שכולם עושים, לא צריך לחתום על זה בשם שלך.

ההבחנה שהוא מדגיש: פשרה מועילה משפרת את הדבר. פשרה רעה מלטשת ממנו את הקצוות עד שאיש לא שם לב אליו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סתגודין', 'בינוניות', 'יצירתיות', 'עסקים', 'קריירה', 'אומץ'],
  },
  {
    day: '10', month: '09', slug: 'kendrick-lamar-rick-rubin-creative-process', audioId: '740712970027383',
    scenes: [
      { type: 'type', text: 'איך יודעים שהיצירה מוכנה?', bare: true, progress: false },
      { type: 'line', text: 'אם אמרתי את זה בתקליט — אני לעולם לא חוזר בי מדבריי.' },
      { type: 'mark', text: 'הוא הפסיק לחשוב על המאזין.', key: 'המאזין' },
      { type: 'pop', text: 'השיר שבו ראפרף בלי חשבון התחבר יותר מהלהיטים המהונדסים.', key: 'התחבר' },
      { type: 'line', text: 'ואיך יודעים שזה מוכן? בסופו של דבר זו תחושה.' },
      { type: 'line', text: '"ילדים מטריפים אותי כי אין להם שום פחד."', invert: true },
      { type: 'cta' },
    ],
    caption: `"אם אמרתי את זה בתקליט — אני לעולם לא חוזר בי מדבריי." 🎤

קנדריק לאמאר בשיחה עם ריק רובין. הוא המבקר הכי קשה של עצמו — לא מתוך פרפקציוניזם, אלא מתוך צורך מתמיד לצאת מאזור הנוחות.

והוא הפסיק לחשוב על המאזין: בלי השראה אמיתית, אין מוזיקה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קנדריקלאמאר', 'ריקרובין', 'יצירתיות', 'מוזיקה', 'אמנות', 'השראה'],
  },
  {
    day: '11', month: '09', slug: 'offer-blueprint-hormozi-sanchez-priestley', audioId: '150504705576125',
    scenes: [
      { type: 'type', text: 'מתי המחיר שלכם נכון?', bare: true, progress: false },
      { type: 'line', text: 'התמחור מדויק כששבעה מתוך עשרה אומרים "לא".' },
      { type: 'mark', text: 'אם אף אחד לא מתנגד למחיר — אתם זולים מדי.', key: 'מתנגד' },
      { type: 'pop', text: 'ההחלטה בעלת המינוף הגבוה ביותר היא למי למכור.', key: 'למי' },
      { type: 'line', text: 'אותה עבודה שווה פי מאה כשהלקוח מרוויח ממנה פי מאה.' },
      { type: 'line', text: 'ושכחו מ"הכנסה פסיבית". קודם הכנסה אקטיבית.', invert: true },
      { type: 'cta' },
    ],
    caption: `"בדרך כלל, התמחור שלכם מדויק כששבעה מתוך עשרה אומרים 'לא'." 💼

אלכס הורמוזי, קודי סאנצ'ז ודניאל פריסטלי אצל סטיבן בארטלט.

ההחלטה בעלת המינוף הגבוה ביותר היא למי למכור: אותה עבודה בדיוק שווה פי מאה כשהיא נעשית עבור לקוח שמרוויח ממנה פי מאה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הורמוזי', 'תמחור', 'עסקים', 'יזמות', 'מכירות', 'שיווק'],
  },
  {
    day: '12', month: '09', slug: 'elon-musk-economist-interview-deflation-china', audioId: '948485328936194',
    scenes: [
      { type: 'type', text: 'ממה נתפרנס כשה-AI יעבוד?', bare: true, progress: false },
      { type: 'line', text: 'מאסק: העבודה תהפוך לרשות. כמו גידול ירקות בגינה.' },
      { type: 'mark', text: 'המראיינת שואלת ממה יתפרנסו. הוא עונה: האוצר ינפיק צ\'קים.', key: 'האוצר' },
      { type: 'pop', text: 'היא משיבה: "זו אינפלציה".', key: 'אינפלציה' },
      { type: 'line', text: 'ותשובת הנגד שלו: דווקא דפלציה תהיה הבעיה.' },
      { type: 'line', text: 'סין כבר מייצרת יותר חשמל מארה"ב, אירופה והודו יחד.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אני מספיק כלכלנית. אם פשוט מנפיקים צ'קים — תהיה אינפלציה." 🌍

חילופי הדברים החדים בריאיון של אילון מאסק ל-The Economist: הוא צופה שהעבודה "תהפוך לרשות", וכששואלים ממה יתפרנסו המפוטרים — עונה שהאוצר ינפיק צ'קים.

ותשובת הנגד שלו היא התחזית החדה בריאיון: דווקא דפלציה תהיה הבעיה, לא אינפלציה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אילוןמאסק', 'כלכלה', 'דפלציה', 'סין', 'בינהמלאכותית', 'עתידהעבודה'],
  },
  {
    day: '13', month: '09', slug: 'rupert-lowe-britain-immigration-free-speech', audioId: '417263269136109',
    scenes: [
      { type: 'type', text: 'מה קורה בבריטניה?', bare: true, progress: false },
      { type: 'line', text: 'זו המלחמה העתיקה בין האינדיבידואליזם לקולקטיביזם.' },
      { type: 'mark', text: 'קו השבר המרכזי בעיניו הוא חופש הביטוי.', key: 'הביטוי' },
      { type: 'pop', text: 'לטענתו נעצרים כ-12 אלף איש בשנה בגין פרסומים ברשתות.', key: 'לטענתו' },
      { type: 'line', text: 'ולדבריו נתח המדינה בתמ"ג מתקרב ל-50% ועולה.' },
      { type: 'line', text: 'התוכנית: רוב בפרלמנט עד 2029.', invert: true },
      { type: 'cta' },
    ],
    caption: `"זו המלחמה העתיקה בין האינדיבידואליזם לקולקטיביזם." 🇬🇧

רופרט לואו, חבר פרלמנט ומייסד Restore Britain, אצל ג'ו רוגן.

קו השבר המרכזי בעיניו הוא חופש הביטוי: לטענתו נעצרים בבריטניה כ-12 אלף איש בשנה בגין פרסומים ברשתות.

⚠️ אלה טענותיו של האורח, לא עובדות מאומתות. הפרק מובא כתקציר של מה שנאמר.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'רופרטלואו', 'בריטניה', 'גורוגן', 'חופשביטוי', 'פוליטיקה', 'אקטואליה'],
  },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  {
    day: '07', month: '09', slug: 'matthew-mcconaughey-reinventing-yourself-modern-wisdom', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"נעדרתי מספיק זמן כדי להפוך לרעיון טוב חדש." 🎬

מתיו מקונוהיי אצל Modern Wisdom, על 20 החודשים שבהם סירב לכל תפקיד — בלי שהייתה לו עבודה אחרת ביד.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מקונוהיי', 'קריירה', 'מיינדסט', 'החלטות', 'הוליווד', 'השראה'],
  },
  {
    day: '08', month: '09', slug: 'fei-fei-li-spatial-intelligence-huberman', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"בני אדם מתפתחים קודם כול טרום-מילולית." 👁️

פרופ' פיי-פיי לי אצל אנדרו הוברמן — ומכאן הטענה שלה: הגבול הבא של הבינה המלאכותית נמצא מעבר לשפה, בתבונה מרחבית ופיזית.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'פייפייל', 'הוברמן', 'בינהמלאכותית', 'ראייה', 'מוח', 'מדע'],
  },
  {
    day: '09', month: '09', slug: 'dwayne-johnson-the-rock-joe-rogan-2063', format: 'quote', kicker: 'ציטוט',
    caption: `"תודה על ההזדמנות, אני מעריך את זה מאוד — אבל אני הולך לסגור את הפרק הזה בחיים שלי." 🏈

דוויין ג'ונסון אצל ג'ו רוגן, על הרגע שבו סירב לחוזה נוסף בליגה — כשאביו ישב באותו חדר.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דוויןגונסון', 'גורוגן', 'מיינדסט', 'קריירה', 'ספורט', 'השראה'],
  },
  {
    day: '10', month: '09', slug: 'louisa-nicola-alzheimers-sleep-diary-of-a-ceo', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"זו מחלה שניתנת למניעה — אבל ברגע שמקבלים את האבחנה, אין תרופה." 🧠

לואיזה ניקולה אצל סטיבן בארטלט, על הקשר בין שינה עמוקה לאלצהיימר.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אלצהיימר', 'שינה', 'בריאותהמוח', 'מניעה', 'בריאות', 'מחקר'],
  },
  {
    day: '11', month: '09', slug: 'brian-cox-particle-physics-frontier-startalk', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"לראשונה אפשר לומר שבפיזיקת החלקיקים אנחנו לא יודעים אם יש עוד משהו מעבר לפינה." 🔬

פרופ' בריאן קוקס ב-StarTalk. אחרי גילוי חלקיק ההיגס ציפו למצוא עוד — הם לא נמצאו.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'בריאןקוקס', 'סטארטוק', 'פיזיקה', 'מדע', 'יקום', 'חלקיקים'],
  },
  {
    day: '12', month: '09', slug: 'naval-ravikant-specific-knowledge-leverage-joe-rogan-1309', format: 'quote', kicker: 'ציטוט',
    caption: `"הדרך לצאת ממלכודת התחרות היא להיות אותנטי." 🧠

נאבל רביקאנט אצל ג'ו רוגן, על שלושת הרכיבים שיוצרים אדם שאי אפשר להחליף: ידע ייחודי, אחריות אישית, ומינוף.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'נאבלרביקאנט', 'גורוגן', 'מינוף', 'קריירה', 'כסף', 'ידע'],
  },
  {
    day: '13', month: '09', slug: 'annie-jacobsen-biological-war-joe-rogan-2534', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"יש נקודה בכל התוכניות האלה שבה הכאוס משתלט — והמשחק המלחמתי נגמר." ⚠️

אנני ג'ייקובסן אצל ג'ו רוגן: כל תוכניות החירום הפומביות נעצרות באותו רגע בדיוק.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אניגייקובסן', 'גורוגן', 'ביטחון', 'מגפה', 'אקטואליה', 'מדע'],
  },
];
// ── guards ──────────────────────────────────────────────────
const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);

// No track twice, ever — across the whole queue and within this batch.
// Scoped two ways so re-running a single section doesn't trip on itself:
// only the sections actually being built are checked, and this batch's own
// queue entries are excluded from "already used".
const ownIds = new Set([
  ...MYTHS.map((m) => `2026-${MO(m)}-${m.day}_myth-${m.slug.slice(0, 24)}`),
  ...REELS.map((r) => `2026-${MO(r)}-${r.day}_reelv2-${r.slug.slice(0, 22)}`),
]);
const priorQueue = { items: queue.items.filter((i) => !ownIds.has(i.id)) };
const building = [
  ...(only === 'all' || only === 'myth' ? MYTHS : []),
  ...(only === 'all' || only === 'reels' ? REELS : []),
];
assertFresh(priorQueue, building.map((r) => r.audioId));

// A re-run replaces its own entries rather than appending duplicates.
queue.items = queue.items.filter((i) => !(ownIds.has(i.id) && building.some((b) => i.id.includes(b.slug.slice(0, 20)))));

// No episode used twice in the same format this week.
for (const [label, list] of [['reel', [...MYTHS, ...REELS]], ['post', POSTS]]) {
  const seen = new Set();
  for (const x of list) {
    if (seen.has(x.slug)) throw new Error(`${label}: ${x.slug} appears twice this week`);
    seen.add(x.slug);
  }
}
console.log(`✓ audio fresh (${freshTracks(queue).length} unused in pool) · no slug repeats\n`);

const outRoot = path.join(ROOT, 'public/social');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-w2-'));
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

// ── myth reels ──────────────────────────────────────────────
if (only === 'all' || only === 'myth') {
  for (const m of MYTHS) {
    const post = need(m.slug);
    const id = `2026-${MO(m)}-${m.day}_myth-${m.slug.slice(0, 24)}`;
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
    console.log(`💭 09:00 ${m.day}.8 ${m.slug.slice(0, 26).padEnd(28)} ${info.duration}s [${sb.scenes.map((s) => (s.out - s.in).toFixed(1)).join('/')}] gate ${samples} ♪ ${trackTitle(m.audioId)}`);
  }
}

// ── digest reels ────────────────────────────────────────────
if (only === 'all' || only === 'reels') {
  for (const r of REELS) {
    const post = need(r.slug);
    const id = `2026-${MO(r)}-${r.day}_reelv2-${r.slug.slice(0, 22)}`;
    const { out, sb, samples, info } = await cutReel({ id, post, scenes: r.scenes, kicker: 'אמ;לק' });
    push({
      id, slug: r.slug, format: 'reel', kicker: 'ריל',
      when: at(r.day, '10:00', MO(r)), caption: r.caption, hashtags: r.hashtags,
      assets: [`${BASE}/social/${id}/${path.basename(out.file)}`],
      cover: `${BASE}/social/${id}/${path.basename(out.cover)}`,
      audioId: r.audioId,
    });
    console.log(`🎬 13:00 ${r.day}.8 ${r.slug.slice(0, 26).padEnd(28)} ${info.duration}s [${sb.scenes.map((s) => (s.out - s.in).toFixed(1)).join('/')}] gate ${samples} ♪ ${trackTitle(r.audioId)}`);
  }
}

// ── feed posts ──────────────────────────────────────────────
if (only === 'all' || only === 'posts') {
  for (const p of POSTS) {
    const post = need(p.slug);
    const id = `2026-${MO(p)}-${p.day}_${p.format}-${p.slug.slice(0, 22)}`;
    const slides = p.format === 'carousel' ? buildCarousel(post, { kicker: p.kicker })
      : p.format === 'lessons' ? buildLessonsCarousel(post, { kicker: p.kicker })
        : buildQuoteCard(post, { kicker: p.kicker });
    const files = await renderSlides(slides, path.join(outRoot, id), p.slug);
    push({
      id, slug: p.slug, format: p.format, kicker: p.kicker,
      when: at(p.day, '17:00', MO(p)), caption: p.caption, hashtags: p.hashtags,
      assets: files.map((f) => `${BASE}/social/${id}/${path.basename(f)}`),
    });
    console.log(`🖼  20:00 ${p.day}.8 ${p.slug.slice(0, 26).padEnd(28)} ${files.length} slides`);
  }
}

fs.rmSync(scratch, { recursive: true, force: true });
saveQueue(queueFile, queue);
console.log('\n✅ queue updated');
