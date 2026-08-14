#!/usr/bin/env node
// Week of 2026-08-09 → 08-15. Three slots a day:
//
//   09:00 IDT  מיתוס ↔ מציאות   (new format — belief, struck, then the flip)
//   13:00 IDT  digest reel      (cold open → hook → 3 beats → punch → CTA)
//   20:00 IDT  feed post        (carousel / lessons / quote)
//
//   node scripts/week-2026-08-09.mjs [--only=myth|reels|posts]
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

const at = (day, hhmmZ) => `2026-08-${day}T${hhmmZ}:00.000Z`;
const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

// ── מיתוס ↔ מציאות (09:00) ──────────────────────────────────
const MYTHS = [
  {
    day: '09', slug: 'matthew-walker-sleep-science-magnesium-regularity',
    myth: 'כדאי לקחת מגנזיום כדי לישון טוב יותר.',
    reality: 'אם רמת המגנזיום שלך כבר תקינה — אתה מייצר שתן יקר.',
    context: 'מה שבאמת מזיז את המחט: סדירות, עוד לפני הכמות.',
    audioId: '1392368834824673',
    caption: `מיתוס ↔ מציאות 💊

"אם רמת המגנזיום בגופך כבר תקינה, כל מה שאתה עושה זה כנראה לייצר שתן יקר."

פרופ' מתיו ווקר, חוקר השינה, אצל סטיבן בארטלט. רוב הצורות של מגנזיום אפילו לא חוצות את מחסום הדם-מוח.

מה שכן עובד? סדירות — ללכת לישון ולקום באותן שעות.

מסכימים? ספרו לנו בתגובות 👇
התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מתיוווקר', 'שינה', 'מגנזיום', 'תוספים', 'בריאות', 'מיתוסים'],
  },
  {
    day: '10', slug: 'fat-loss-formula-dr-mike-israetel',
    myth: 'כדי לרזות חייבים לספור קלוריות.',
    reality: 'אם אתה יורד בלי לספור — אל תתחיל. מה שאתה עושה עובד.',
    context: 'אבל אם נתקעתם — ספירה היא הכלי החד ביותר שיש.',
    audioId: '523270413537344',
    caption: `מיתוס ↔ מציאות ⚖️

"אם אתה לא סופר קלוריות ואתה מרזה — אל תתחיל לספור. מה שאתה עושה עובד, תמשיך."

ד"ר מייק איסראטל אצל Modern Wisdom. גירעון קלורי הוא אמנם הגורם היחיד לאיבוד שומן — אבל ספירה היא רק אחת הדרכים להגיע אליו.

מתי כן כדאי לספור? כשנתקעתם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מייקאיסראטל', 'ירידהבמשקל', 'קלוריות', 'תזונה', 'כושר', 'מיתוסים'],
  },
  {
    day: '11', slug: 'lower-back-pain-mcgill',
    myth: 'כאב גב הוא סתם משהו "לא-ספציפי".',
    reality: 'אין דבר כזה. תמיד יש מנגנון — צריך רק למצוא אותו.',
    context: 'וה-MRI מטעה: גב יכול להיראות נורא בצילום בלי כאב כלל.',
    audioId: '1232530197323594',
    caption: `מיתוס ↔ מציאות 🦴

"אין דבר כזה כאב גב 'לא-ספציפי'. תמיד יש מנגנון — צריך רק למצוא אותו."

פרופ' סטיוארט מקגיל, מחוקרי עמוד השדרה הגדולים בעולם, אצל פיטר אטיה.

וגם: אפשר שגב ייראה נורא ב-MRI בלי כאב כלל — ולהפך.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מקגיל', 'כאבגב', 'פיטראטיה', 'בריאות', 'עמודשדרה', 'מיתוסים'],
  },
  {
    day: '12', slug: 'andy-galpin-diet-supplements-recovery',
    myth: 'כדי לבנות שריר צריך אבקת חלבון.',
    reality: 'אתה לא חייב חלבון אבקתי. אף פעם.',
    context: 'סדר נכון: קודם לסגור חוסרים — מגנזיום, אומגה-3, ויטמין D.',
    audioId: '667290109003199',
    caption: `מיתוס ↔ מציאות 💪

"אתה לא חייב חלבון אבקתי. אף פעם."

ד"ר אנדי גלפין, מומחה לפיזיולוגיה של ביצועים, אצל FoundMyFitness.

סדר התוספים שהוא מציע: קודם לסגור חוסרים — מגנזיום, אומגה-3 וויטמין D. שם הרווח הגדול. רק אחר כך קריאטין.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנדיגלפין', 'חלבון', 'תוספים', 'כושר', 'תזונה', 'מיתוסים'],
  },
  {
    day: '13', slug: 'nischa-shah-money-financial-freedom',
    myth: 'אם לא אסתכל על החשבון, זה פחות מלחיץ.',
    reality: 'ההימנעות מלהסתכל היא הטעות הפיננסית הגדולה בשנות העשרים.',
    context: 'הנוסחה שלה: 65% צרכים, 25% הנאות, 10% לאני של מחר.',
    audioId: '986385619708594',
    caption: `מיתוס ↔ מציאות 💰

הטעות הפיננסית הגדולה ביותר בשנות העשרים היא פשוט ההימנעות מלהסתכל על הנתונים.

נישה שאה — בנקאית השקעות לשעבר — אצל ג'יי שטי. היא קוראת לזה "אפקט בת היענה": מתחמקים ממה שמלחיץ, בתקווה שייעלם.

הנוסחה שלה: 65 / 25 / 10, והעברה אוטומטית ביום המשכורת.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'נישהשאה', 'כסף', 'חיסכון', 'חינוךפיננסי', 'הרגלים', 'מיתוסים'],
  },
  {
    day: '14', slug: 'cesar-millan-calm-energy-dog-leadership',
    myth: 'כלב טוב הוא כלב שמקשיב לפקודות.',
    reality: 'הוא לא מקשיב למילים. הוא מקשיב לרוגע שלכם.',
    context: 'והסדר הנכון: פעילות, משמעת, ואז חיבה. החיבה היא פרס.',
    audioId: '607917953812167',
    caption: `מיתוס ↔ מציאות 🐕

"אתם לא רוצים שהכלב יקשיב לפקודות שלכם. אתם רוצים שהוא יקשיב לרוגע שלכם."

סיזר מילאן אצל פרופ' אנדרו הוברמן. כלבים מגיבים לאנרגיה ולכוונה — לא למילים.

והסדר שרובנו הופכים: פעילות, משמעת, ואז חיבה. החיבה היא פרס, והיא באה אחרונה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סיזרמילאן', 'כלבים', 'אילוףכלבים', 'הוברמן', 'מיינדסט', 'מיתוסים'],
  },
  {
    day: '15', slug: 'david-sinclair-aging-reversal-longevity',
    myth: 'הזדקנות היא גזרה שאי אפשר לשנות.',
    reality: 'זה תהליך ביולוגי שאפשר לעצור — ואולי אף לבטל.',
    context: 'המנגנון: תאים מאבדים זהות בגלל שחיקת האפיגנום, לא נזק ל-DNA.',
    audioId: '1810265579431745',
    caption: `מיתוס ↔ מציאות ⏳

פרופ' דיוויד סינקלייר מהרווארד טוען שההזדקנות היא תהליך ביולוגי שאפשר לעצור ואף לבטל — לא גזר דין.

המנגנון המרכזי: תאים מאבדים את זהותם עם הזמן בגלל שחיקה של האפיגנום — ולא בגלל נזק ל-DNA עצמו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דיוידסינקלייר', 'אריכותחיים', 'הזדקנות', 'בריאות', 'מדע', 'מיתוסים'],
  },
];

// ── digest reels (13:00) ────────────────────────────────────
const REELS = [
  {
    day: '09', slug: 'david-goggins-huberman-inner-strength', audioId: '859319581616251',
    scenes: [
      { type: 'type', text: 'מתי המוח באמת גדל?', bare: true, progress: false },
      { type: 'line', text: 'כל דבר שאי פעם עשיתי בחיי — לא רציתי לעשות אותו.' },
      { type: 'mark', text: 'יש במוח אזור שגדל רק כשעושים משהו שלא רוצים.', key: 'שגדל' },
      { type: 'pop', text: 'אצל גוגינס אין תגמול בכלל — רק בריחה.', key: 'בריחה' },
      { type: 'line', text: 'לפני שלימד את עצמו לנצח, הוא לימד את עצמו להיכשל.' },
      { type: 'line', text: 'כוח רצון הוא מיומנות מתכלה.', invert: true },
      { type: 'cta' },
    ],
    caption: `"כל דבר שאי פעם עשיתי בחיי — לא רציתי לעשות אותו." 🔥

דייויד גוגינס אצל אנדרו הוברמן: יש במוח אזור שגדל רק כשעושים משהו שלא רוצים לעשות.

אוהבים את מה שאתם עושים? האזור הזה לא גדל.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דייווידגוגינס', 'הוברמן', 'מיינדסט', 'משמעת', 'כוחרצון', 'פסיכולוגיה'],
  },
  {
    day: '10', slug: 'morgan-housel-psychology-of-money-huberman', audioId: '1982627311976080',
    scenes: [
      { type: 'type', text: 'למה אנחנו מחליטים ככה על כסף?', bare: true, progress: false },
      { type: 'line', text: 'כסף הוא נכס פיננסי — והתחייבות פסיכולוגית.' },
      { type: 'mark', text: 'אין דרך אחת נכונה לנהל כסף. יש את שלכם.', key: 'שלכם' },
      { type: 'pop', text: 'החירות טמונה דווקא בכסף שלא הוצאתם.', key: 'שלא' },
      { type: 'line', text: 'משחק ההשוואה לא ניתן לניצחון.' },
      { type: 'line', text: 'שאלו את עצמכם: על מה אתחרט בגיל 80?', invert: true },
      { type: 'cta' },
    ],
    caption: `"עבור הרבה אנשים, כסף הוא נכס פיננסי — והתחייבות פסיכולוגית." 💭

מורגן האוזל, מחבר "הפסיכולוגיה של הכסף", אצל אנדרו הוברמן.

המדד המכריע לפי קאהנמן: תחושה מכוילת של החרטה העתידית. לא YOLO, ולא קמצנות קיצונית.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מורגןהאוזל', 'הפסיכולוגיהשלהכסף', 'כסף', 'השקעות', 'הוברמן', 'פיננסים'],
  },
  {
    day: '11', slug: 'breathing-right-nestor', audioId: '587460186676938',
    scenes: [
      { type: 'type', text: 'מאיפה מגיעה האנרגיה שלכם?', bare: true, progress: false },
      { type: 'line', text: 'את רוב האנרגיה אתם לא מקבלים מאוכל — אלא מהנשימה.' },
      { type: 'mark', text: 'העיקר אינו כמה חמצן שואפים אלא סבילות ל-CO2.', key: 'סבילות' },
      { type: 'pop', text: 'רובנו נושמים דרך הפה, רדוד ומהר — ומשלמים על זה.', key: 'ומהר' },
      { type: 'line', text: 'הפתרון פשוט: לאט, נמוך ודרך האף.' },
      { type: 'line', text: 'CO2 אינו פסולת. הוא מה שמעביר חמצן לתאים.', invert: true },
      { type: 'cta' },
    ],
    caption: `"את רוב האנרגיה שלכם אתם לא מקבלים מאוכל ומשתייה. אתם מקבלים אותה מהנשימה." 🌬️

ג'יימס נסטור, מחבר "Breath", אצל ריץ' רול.

והמפתח אינו כמה חמצן שואפים — אלא סבילות לפחמן דו-חמצני. הוא זה שמאפשר לחמצן להשתחרר אל התאים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'נשימה', 'גיימסנסטור', 'ריצרול', 'בריאות', 'שינה', 'מיינדפולנס'],
  },
  {
    day: '12', slug: 'alex-hormozi-reality-is-the-moat-ai', audioId: '3953116884963967',
    scenes: [
      { type: 'type', text: 'איך יודעים אם ה-AI שלכם עובד?', bare: true, progress: false },
      { type: 'line', text: 'המציאות היא החפיר.' },
      { type: 'mark', text: 'המבחן: אתם מרוויחים יותר כסף? אם לא — עצרו.', key: 'המבחן' },
      { type: 'pop', text: 'אל תהפכו את ה-AI לעסק. השתמשו בו בעסק שכבר יש לכם.', key: 'לעסק' },
      { type: 'line', text: 'מה שנשאר לבני אדם: הבעלות על ההחלטה ועל הסיכון.' },
      { type: 'line', text: 'מוניטין אפשר לצבור רק במציאות.', invert: true },
      { type: 'cta' },
    ],
    caption: `"המציאות היא החפיר." 🏰

אלכס הורמוזי אצל סטיבן בארטלט, עם מבחן פשוט לכל פרויקט AI בעסק: אתם מרוויחים יותר כסף? אם לא — עצרו.

והטעות השכיחה: להקים עסק AI במקום להשתמש ב-AI בעסק שכבר יש לכם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אלכסהורמוזי', 'בינהמלאכותית', 'עסקים', 'יזמות', 'שיווק', 'אסטרטגיה'],
  },
  {
    day: '13', slug: 'ido-portal-movement-mind-body-huberman', audioId: '3413024339027173',
    scenes: [
      { type: 'type', text: 'מה באמת מניע אתכם?', bare: true, progress: false },
      { type: 'line', text: 'רצון לא נבנה — הוא רק נחשף.' },
      { type: 'mark', text: 'הכלי החסר לרובנו הוא משחקיות.', key: 'משחקיות' },
      { type: 'pop', text: 'אל תקשיבו לגוף שלכם — המערכות שלנו משובשות מדי.', key: 'משובשות' },
      { type: 'line', text: 'בפועל: תלייה, כריעה עמוקה, ותנועה גלית של עמוד השדרה.' },
      { type: 'line', text: 'החיים לא נועדו שנחיה אותם. הם נועדו לתרגול.', invert: true },
      { type: 'cta' },
    ],
    caption: `"החיים לא נועדו לכך שפשוט נחיה אותם; הם נועדו לתרגול." 🤸

עידו פורטל אצל אנדרו הוברמן — על ההבדל בין משמעת (שנבנית), מוטיבציה (שחולפת), ורצון, שלטענתו רק נחשף.

והכלי שחסר לרובנו? משחקיות.

שמרו לעצמכם 💾 והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'עידופורטל', 'תנועה', 'הוברמן', 'בריאותוכושר', 'משמעת', 'מיינדסט'],
  },
  {
    day: '14', slug: 'roman-yampolskiy-ai-safety-uncontrollable', audioId: '820979415498414',
    scenes: [
      { type: 'type', text: 'אפשר בכלל לשלוט ב-AI?', bare: true, progress: false },
      { type: 'line', text: 'היכולות מכפילות את עצמן. הבטיחות מתקדמת בקצב אחיד.' },
      { type: 'mark', text: 'והפער בין השתיים רק הולך וגדל.', key: 'והפער' },
      { type: 'pop', text: 'פשוט נכבה את זה? נסו לכבות את רשת הביטקוין.', key: 'לכבות' },
      { type: 'line', text: 'גם מי שבנה את המערכות לא יודע מה הן מסוגלות לעשות.' },
      { type: 'line', text: 'כלים צרים — כן. בינה כללית בלתי מבוקרת — לא.', invert: true },
      { type: 'cta' },
    ],
    caption: `"היכולות של AI מכפילות את עצמן שוב ושוב. הבטיחות מתקדמת בקצב אחיד. הפער הולך וגדל." ⚠️

רומאן יאמפולסקי — שטבע את המונח "בטיחות AI" לפני כ-15 שנה — אצל סטיבן בארטלט.

"פשוט נכבה את זה"? נסו לכבות וירוס מחשב. נסו לכבות את רשת הביטקוין.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'יאמפולסקי', 'בטיחותAI', 'בינהמלאכותית', 'טכנולוגיה', 'עתיד', 'סיכונים'],
  },
  {
    day: '15', slug: 'sam-harris-clear-thinking-mindfulness-ai', audioId: '884175553260987',
    scenes: [
      { type: 'type', text: 'כמה זמן אתם באמת מרוכזים?', bare: true, progress: false },
      { type: 'line', text: 'כמעט אף אחד לא מסוגל לשים לב לדבר אחד 30 שניות ברציפות.' },
      { type: 'mark', text: 'וזהו שורש הסבל הפסיכולוגי היומיומי.', key: 'שורש' },
      { type: 'pop', text: 'מיינדפולנס אינו השתקת מחשבות — אלא להבחין בהן.', key: 'להבחין' },
      { type: 'line', text: 'וביקורת אמיתית היא מתנה, לא איום.' },
      { type: 'line', text: 'להיות מוסח אינו כישלון במדיטציה. זה התרגול.', invert: true },
      { type: 'cta' },
    ],
    caption: `כמעט אף אחד אינו מסוגל לשים לב לדבר אחד במשך 30 שניות ברציפות. 🧘

סם האריס אצל ד"ר אנדי גלפין — וזהו, לדבריו, שורש הסבל הפסיכולוגי היומיומי.

מיינדפולנס אינו ניסיון להשתיק מחשבות, אלא להבחין בהן כהופעות — בדיוק כפי שמתעוררים מחלום.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סםהאריס', 'מיינדפולנס', 'מדיטציה', 'קשב', 'פסיכולוגיה', 'מיינדסט'],
  },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  {
    day: '09', slug: 'kendrick-lamar-rick-rubin-creative-process', format: 'quote', kicker: 'ציטוט',
    caption: `"אם אמרתי את זה בתקליט — אני לעולם לא חוזר בי מדבריי." 🎤

קנדריק לאמאר בשיחה עם ריק רובין, על תהליך היצירה, על אחריות למילים, ועל מה שקורה כשאמן מסרב להתנצל על העבודה שלו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קנדריקלאמאר', 'ריקרובין', 'יצירתיות', 'מוזיקה', 'אמנות', 'השראה'],
  },
  {
    day: '10', slug: 'ray-dalio-15-uncorrelated-return-streams', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"מצאו 15 מקורות תשואה טובים שאינם מתואמים זה בזה." 📊

ריי דליו קורא לזה "גביע הקודש" של ההשקעות: בסביבות 15 מקורות בלתי-מתואמים, הסיכון יורד בכ-80% בלי שהתשואה יורדת.

והטעות של משקיעים חכמים? לא בחירת מניה שגויה — פשוט אין להם תוכנית משחק.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'רייידליו', 'השקעות', 'פיזורסיכונים', 'כסף', 'שוקההון', 'פיננסים'],
  },
  {
    day: '11', slug: 'lance-armstrong-rise-fall-growth-attia', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"אותו בחור היה צריך למות, ובחור חדש היה צריך לבוא במקומו." 🚴

לאנס ארמסטרונג אצל ד"ר פיטר אטיה — שיחה כנה על עלייה, נפילה, ומה שנשאר אחרי שהכול נלקח.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'לאנסארמסטרונג', 'פיטראטיה', 'מיינדסט', 'ספורט', 'כישלון', 'צמיחה'],
  },
  {
    day: '12', slug: 'jensen-huang-nvidia-vision-future', format: 'quote', kicker: 'ציטוט',
    caption: `"כל מה שזז יהיה רובוטי יום אחד — וזה יקרה בקרוב." 🤖

ג'נסן הואנג, מנכ"ל NVIDIA, על העתיד שהוא רואה מגיע — ועל מה שזה אומר לכל תעשייה שנוגעת בתנועה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גנסןהואנג', 'NVIDIA', 'רובוטיקה', 'בינהמלאכותית', 'טכנולוגיה', 'עתיד'],
  },
  {
    day: '13', slug: 'lloyd-blankfein-goldman-risk-reputation', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"אני כל כך מבפנים… אני יודע שאף אחד לא יודע כלום, בעוד שכל השאר פשוט תוהים." 🏦

לויד בלנקפיין, מנכ"ל גולדמן זאקס לשעבר, אצל My First Million.

הטענה שלו על גאונות: בכל הקריירה הוא לא בטוח שפגש גאון אחד. הפער בין מי שמצליח למי שלא — קטן בהרבה משנדמה.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'בלנקפיין', 'גולדמןזאקס', 'וולסטריט', 'השקעות', 'קריירה', 'סיכון'],
  },
  {
    day: '14', slug: 'michelle-thaller-universe-joe-rogan', format: 'quote', kicker: 'ציטוט',
    caption: `"אסטרופיזיקה היא הסיפור של קצה האף שלך, ממש." ✨

ד"ר מישל ת'אלר מנאס"א אצל ג'ו רוגן — על למה כל אטום בגוף שלכם נוצר בכוכב, ואיך זה הופך את היקום לסיפור אישי.

"אנחנו חלק מהדבר הגדול והיפה הזה."

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מישלתאלר', 'נאסא', 'אסטרופיזיקה', 'חלל', 'מדע', 'גורוגן'],
  },
  {
    day: '15', slug: 'stretching-flexibility-science-protocol', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `מה המדע באמת אומר על מתיחות? 🧘‍♂️

פרק שמפרק את הפרוטוקולים לגמישות: כמה זמן, באיזו תדירות, ואיזה סוג מתיחה באמת מרחיב טווח תנועה.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מתיחות', 'גמישות', 'הוברמן', 'כושר', 'בריאות', 'אימון'],
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
  ...MYTHS.map((m) => `2026-08-${m.day}_myth-${m.slug.slice(0, 24)}`),
  ...REELS.map((r) => `2026-08-${r.day}_reelv2-${r.slug.slice(0, 22)}`),
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
    const id = `2026-08-${m.day}_myth-${m.slug.slice(0, 24)}`;
    const scenes = [
      { type: 'myth', kicker: 'מיתוס', text: m.myth },
      { type: 'line', kicker: 'מציאות', text: m.reality, invert: true },
      { type: 'line', kicker: 'מציאות', text: m.context },
      { type: 'cta', kicker: 'הסכתון', progress: false },
    ];
    const { out, sb, samples, info } = await cutReel({ id, post, scenes, kicker: 'מיתוס', coverScene: 1 });
    push({
      id, slug: m.slug, format: 'reel', kicker: 'מיתוס ↔ מציאות',
      when: at(m.day, '06:00'), caption: m.caption, hashtags: m.hashtags,
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
    const id = `2026-08-${r.day}_reelv2-${r.slug.slice(0, 22)}`;
    const { out, sb, samples, info } = await cutReel({ id, post, scenes: r.scenes, kicker: 'אמ;לק' });
    push({
      id, slug: r.slug, format: 'reel', kicker: 'ריל',
      when: at(r.day, '10:00'), caption: r.caption, hashtags: r.hashtags,
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
    const id = `2026-08-${p.day}_${p.format}-${p.slug.slice(0, 22)}`;
    const slides = p.format === 'carousel' ? buildCarousel(post, { kicker: p.kicker })
      : p.format === 'lessons' ? buildLessonsCarousel(post, { kicker: p.kicker })
        : buildQuoteCard(post, { kicker: p.kicker });
    const files = await renderSlides(slides, path.join(outRoot, id), p.slug);
    push({
      id, slug: p.slug, format: p.format, kicker: p.kicker,
      when: at(p.day, '17:00'), caption: p.caption, hashtags: p.hashtags,
      assets: files.map((f) => `${BASE}/social/${id}/${path.basename(f)}`),
    });
    console.log(`🖼  20:00 ${p.day}.8 ${p.slug.slice(0, 26).padEnd(28)} ${files.length} slides`);
  }
}

fs.rmSync(scratch, { recursive: true, force: true });
saveQueue(queueFile, queue);
console.log('\n✅ queue updated');
