#!/usr/bin/env node
// Week of 2026-08-31 → 09-06 (crosses the month boundary). Three slots a day:
//
//   09:00 IDT  מיתוס ↔ מציאות   (new format — belief, struck, then the flip)
//   13:00 IDT  digest reel      (cold open → hook → 3 beats → punch → CTA)
//   20:00 IDT  feed post        (carousel / lessons / quote)
//
//   node scripts/week-2026-08-31.mjs [--only=myth|reels|posts]
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
const MYTHS = [
  {
    day: '31', slug: 'louisa-nicola-alzheimers-sleep-diary-of-a-ceo',
    myth: 'אלצהיימר מתחילה בזקנה.',
    reality: 'היא מתחילה בדרך כלל כבר בשנות ה-30.',
    context: 'עשרות שנים לפני שמישהו מבחין בה.',
    audioId: '2070320316495253',
    caption: `מיתוס ↔ מציאות 🧠

"זו מחלה שניתנת למניעה — אבל היא כמו סרטן בשלב סופני. ברגע שמקבלים את האבחנה, אין תרופה."

לואיזה ניקולה אצל סטיבן בארטלט: אלצהיימר מתחילה בדרך כלל כבר בשנות ה-30, עשרות שנים לפני שמישהו מבחין בה.

ההסבר שלה נוגע לשינה עמוקה — אז נכנסת לפעולה מערכת ניקוז שמפנה מהמוח חלבון שהצטבר.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אלצהיימר', 'שינה', 'בריאותהמוח', 'מניעה', 'בריאות', 'מיתוסים'],
  },
  {
    day: '01', month: '09', slug: 'hormozi-100k-in-3-months-2026',
    myth: 'הדרך ל-100 אלף היא הדרך למיליון.',
    reality: 'הדרך המהירה ל-100 אלף היא לא הדרך המהירה למיליון.',
    context: 'והטעות הנפוצה: מוכרים בזול מדי ורצים לסקיילינג.',
    audioId: '1089958938021297',
    caption: `מיתוס ↔ מציאות 💼

"הדרך המהירה ביותר להגיע ל-100,000 דולר היא לא הדרך המהירה ביותר להגיע למיליון. זו הטעות הגדולה בשאלה."

אלכס הורמוזי, שהרוויח 100 אלף דולר תוך חודש אחרי שפשט את הרגל.

והטעות הנפוצה של יזמים מתחילים: מוכרים בזול מדי, ומתמקדים בסקיילינג במקום להפיק את המקסימום מכל לקוח.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הורמוזי', 'יזמות', 'עסקים', 'מכירות', 'כסף', 'מיתוסים'],
  },
  {
    day: '02', month: '09', slug: 'seth-godin-this-is-strategy-tim-ferriss',
    myth: 'עשיתי את החלק הקשה — נשאר רק להפיץ.',
    reality: 'לא עשיתם את החלק הקשה. חיכיתם לנס.',
    context: 'אסטרטגיה היא פילוסופיה של התהוות — לא אוסף טקטיקות.',
    audioId: '793158060872110',
    caption: `מיתוס ↔ מציאות 🎯

"אם אתם מוצאים את עצמכם אומרים 'נשאר לי רק להפיץ את הבשורה, את החלק הקשה כבר עשיתי' — לא עשיתם את החלק הקשה. מה שעשיתם זה לחכות לנס."

סת' גודין אצל טים פריס. אסטרטגיה, לדבריו, היא פילוסופיה של התהוות — הטקטיקות משתנות כל הזמן, האסטרטגיה לא.

וארבעת המרכיבים: מערכות, זמן, משחקים ואמפתיה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סתגודין', 'אסטרטגיה', 'שיווק', 'עסקים', 'טיםפריס', 'מיתוסים'],
  },
  {
    day: '03', month: '09', slug: 'ray-dalio-15-uncorrelated-return-streams',
    myth: 'פיזור אומר לוותר על תשואה.',
    reality: 'בכ-15 מקורות לא מתואמים הסיכון יורד ב-80% — התשואה לא.',
    context: 'ומזומן? לדבריו הנכס עם הביצועים הגרועים ביותר לאורך זמן.',
    audioId: '640772971047304',
    caption: `מיתוס ↔ מציאות 📊

"מצאו 15 מקורות תשואה טובים שאינם מתואמים זה בזה."

ריי דליו קורא לזה "גביע הקודש": בסביבות 15 מקורות בלתי-מתואמים, הסיכון יורד בכ-80% בלי שהתשואה יורדת.

והטעות של משקיעים חכמים? לא בחירת מניה שגויה — פשוט אין להם תוכנית משחק.

⚠️ זה לא ייעוץ השקעות.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'רייידליו', 'פיזורסיכונים', 'השקעות', 'כסף', 'שוקההון', 'מיתוסים'],
  },
  {
    day: '04', month: '09', slug: 'lloyd-blankfein-goldman-risk-reputation',
    myth: 'בפסגה יושבים גאונים.',
    reality: 'בכל הקריירה הוא לא בטוח שפגש גאון אחד.',
    context: 'הפער בין מי שמצליח למי שלא — קטן. כמו טורניר גולף.',
    audioId: '1043995042476097',
    caption: `מיתוס ↔ מציאות 🏦

"אני כל כך מבפנים… אני יודע שאף אחד לא יודע כלום, בעוד שכל השאר פשוט תוהים."

לויד בלנקפיין, מנכ"ל גולדמן זאקס לשעבר, אצל My First Million.

הטענה שלו על גאונות: בכל הקריירה הוא לא בטוח שפגש גאון. אנשים "נורמליים ולא בטוחים בעצמם" הרבה יותר משנדמה.

והפער בין מי שמצליח למי שלא? קטן — כמו טורניר גולף שנקבע במכה אחת.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'בלנקפיין', 'גולדמןזאקס', 'קריירה', 'הצלחה', 'סיכון', 'מיתוסים'],
  },
  {
    day: '05', month: '09', slug: 'andrew-huberman-peptides-training-tim-ferriss',
    myth: 'BPC-157 יתקן לכם את הפציעה.',
    reality: 'רוב האנשים לוקחים אותו מהסיבות הלא נכונות.',
    context: 'וכמעט כל הנתונים עליו הם מבעלי חיים.',
    audioId: '4142425685857932',
    caption: `מיתוס ↔ מציאות 💊

BPC-157 הוא הפפטיד הפופולרי מכולם — ולפי פרופ' אנדרו הוברמן, זה שרוב האנשים לוקחים "מהסיבות הלא נכונות".

כמעט כל הנתונים עליו הם מבעלי חיים.

והוא כן על עצמו: "ניסיתי את זה. אני מרגיש שההתאוששות מהירה יותר — אבל אני לא יכול לעשות את ניסוי הביקורת."

⚠️ לא המלצה רפואית.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הוברמן', 'פפטידים', 'התאוששות', 'בריאות', 'טיםפריס', 'מיתוסים'],
  },
  {
    day: '06', month: '09', slug: 'vlad-tenev-broad-ownership-ai-agents-iced-coffee-hour',
    myth: 'סוכן AI שסוחר בשבילכם מרוויח לכם כסף.',
    reality: 'אני לא באמת מסתכל מקרוב על התשואות שלהם.',
    context: 'זה המנכ"ל עצמו, על 100 אלף איש שכבר חיברו סוכן.',
    audioId: '881418556952932',
    caption: `מיתוס ↔ מציאות 🤖

רובינהוד פתחה מסלול שמאפשר לסוכני AI לסחור בחשבון. למעלה מ-100 אלף איש כבר הקימו חיבור כזה.

וכששאלו את ולאד טנב, המנכ"ל, אם הם מרוויחים — התשובה: "אני לא באמת מסתכל מקרוב על התשואות שלהם."

⚠️ שווה לקרוא את זה פעמיים לפני שמחברים סוכן לחשבון.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'רובינהוד', 'בינהמלאכותית', 'השקעות', 'מסחר', 'כסף', 'מיתוסים'],
  },
];

// ── digest reels (13:00) ────────────────────────────────────
const REELS = [
  {
    day: '31', slug: 'fei-fei-li-spatial-intelligence-huberman', audioId: '1016609443731395',
    scenes: [
      { type: 'type', text: 'מה בא אחרי השפה?', bare: true, progress: false },
      { type: 'line', text: 'בני אדם מתפתחים קודם כול טרום-מילולית.' },
      { type: 'mark', text: 'לאבולוציה לקחו 500 מיליון שנה בלי תקשורת מילולית.', key: 'מיליון' },
      { type: 'pop', text: 'כמחצית מהפעילות בקליפת המוח עוסקת בתפקוד חזותי.', key: 'כמחצית' },
      { type: 'line', text: 'לפני 540 מיליון שנה בעלי חיים ראו אור בפעם הראשונה.' },
      { type: 'line', text: 'הגבול הבא של AI נמצא מעבר לשפה.', invert: true },
      { type: 'cta' },
    ],
    caption: `"בני אדם מתפתחים קודם כול טרום-מילולית. לאבולוציה לקחו 500 מיליון שנה בלי תקשורת מילולית." 👁️

פרופ' פיי-פיי לי אצל אנדרו הוברמן — ומכאן הטענה שלה: הגבול הבא של הבינה המלאכותית נמצא מעבר לשפה, בתבונה מרחבית ופיזית.

וכמחצית מהפעילות בקליפת המוח האנושית עוסקת בתפקוד חזותי.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'פייפייל', 'הוברמן', 'בינהמלאכותית', 'ראייה', 'מוח', 'מדע'],
  },
  {
    day: '01', month: '09', slug: 'laurence-fishburne-matrix-physics-startalk', audioId: '2875190712727324',
    scenes: [
      { type: 'type', text: 'האם המטריקס מחזיק פיזיקלית?', bare: true, progress: false },
      { type: 'line', text: 'בני אדם כסוללה? אנחנו מקרינים 80 עד 100 ואט.' },
      { type: 'mark', text: 'פחות או יותר נורה.', key: 'נורה' },
      { type: 'pop', text: 'ואם מאכילים אותנו כדי להפיק אנרגיה — עדיף לדלג עלינו.', key: 'לדלג' },
      { type: 'line', text: 'אבל טענת הסימולציה דווקא כן מחזיקה.' },
      { type: 'line', text: 'הצילומים ארכו שלוש שנים באוסטרליה.', invert: true },
      { type: 'cta' },
    ],
    caption: `האם בני אדם באמת יכולים לשמש כסוללה? 🔋

ניל דה-גראס טייסון מפרק את המטריקס ב-StarTalk, מול לורנס פישבורן עצמו: אנחנו מקרינים בערך 80 עד 100 ואט — פחות או יותר נורה.

והכשל פשוט: אם המכונות מאכילות אותנו כדי להפיק מאיתנו אנרגיה, עדיף להן לדלג עלינו.

אבל טענת הסימולציה? זו דווקא מחזיקה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סטארטוק', 'המטריקס', 'פיזיקה', 'סימולציה', 'מדע', 'קולנוע'],
  },
  {
    day: '02', month: '09', slug: 'bob-lazar-jeremy-corbell-area-51-joe-rogan', audioId: '1211414204067053',
    scenes: [
      { type: 'type', text: 'מה שבר לו את הפיזיקה?', bare: true, progress: false },
      { type: 'line', text: 'כור בגודל של חצי כדורסל שמייצר שדה כבידה משלו.' },
      { type: 'mark', text: 'אין שום חיווט שמחבר בין הרכיבים. בכלל.', key: 'חיווט' },
      { type: 'pop', text: 'והכור לא מתחמם מעל טמפרטורת הסביבה גם בעומס מלא.', key: 'מתחמם' },
      { type: 'line', text: 'האנלוגיה שלו: אופנוע שנזרק לעידן העגלות.' },
      { type: 'line', text: 'והוא אומר מראש שאינו יכול להוכיח דבר.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אין שום חיווט שמחבר בין רכיבי המשנה, בכלל... הדברים האלה גובלים בקסם." 🛸

בוב לזאר אצל ג'ו רוגן. מה שמעניין אותו אינו החייזרים אלא הפיזיקה: מכונה שמייצרת כבידה.

⚠️ והוא אומר מראש שאינו יכול להוכיח דבר. זה סיפור בגוף ראשון, לא ראיה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'בובלזאר', 'גורוגן', 'אזור51', 'פיזיקה', 'תעלומות', 'מדע'],
  },
  {
    day: '03', month: '09', slug: 'jd-vance-diary-of-a-ceo', audioId: '957044555314519',
    scenes: [
      { type: 'type', text: 'איך הופכים ליריב של עצמך?', bare: true, progress: false },
      { type: 'line', text: 'חשבתי שטראמפ יהיה נשיא כושל. הוא לא היה.' },
      { type: 'mark', text: 'חשבתי שהמוסדות של אמריקה מתפקדים. הם לא.', key: 'מתפקדים' },
      { type: 'pop', text: 'ב-2016 הוא כינה אותו "היטלר של אמריקה".', key: 'כינה' },
      { type: 'line', text: 'על הגירה: הפילוג נובע מקצב שינוי מהיר מדי.' },
      { type: 'line', text: 'ועל אמון: "אני לא בוטח באף אחד".', invert: true },
      { type: 'cta' },
    ],
    caption: `"חשבתי שטראמפ יהיה נשיא כושל. הוא לא היה. חשבתי שהמוסדות של אמריקה מתפקדים מהיסוד. הם לא." 🎙️

ג'יי.די. ואנס — שב-2016 כינה את טראמפ "היטלר של אמריקה" — מסביר אצל סטיבן בארטלט איך הפך לאיש מספר 2 שלו.

הוויכוח על הגירה לבדו שווה את הצפייה: שני הצדדים חולקים בחריפות, בלי להשתלח.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'ואנס', 'טראמפ', 'פוליטיקה', 'אקטואליה', 'ארצותהברית', 'ראיון'],
  },
  {
    day: '04', month: '09', slug: 'michelle-thaller-universe-joe-rogan', audioId: '570628171167564',
    scenes: [
      { type: 'type', text: 'כמה גדול היקום באמת?', bare: true, progress: false },
      { type: 'line', text: 'אסטרופיזיקה היא הסיפור של קצה האף שלך, ממש.' },
      { type: 'mark', text: 'לווייני GPS מודדים זמן אחרת מאיתנו.', key: 'זמן' },
      { type: 'pop', text: 'בלי תיקון יחסותי היינו טועים ב-10 ק"מ ביום.', key: 'טועים' },
      { type: 'line', text: 'ובתוך חורים שחורים הפיזיקה שלנו מפסיקה לעבוד.' },
      { type: 'line', text: 'אנחנו חלק מהדבר הגדול והיפה הזה.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אסטרופיזיקה היא הסיפור של קצה האף שלך, ממש. אנחנו חלק מהדבר הגדול והיפה הזה." ✨

ד"ר מישל ת'אלר מנאס"א אצל ג'ו רוגן.

ועובדה שקשה להפנים: לווייני GPS מודדים זמן אחרת מאיתנו — ובלי תיקון לפי תורת היחסות, המיקום שלנו היה מוטעה בכ-10 ק"מ ביום.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מישלתאלר', 'נאסא', 'אסטרופיזיקה', 'חלל', 'מדע', 'גורוגן'],
  },
  {
    day: '05', month: '09', slug: 'elon-musk-joe-rogan-1169-ai-warning', audioId: '485738582157668',
    scenes: [
      { type: 'type', text: 'מה הוא ניסה להגיד ב-2018?', bare: true, progress: false },
      { type: 'line', text: 'ניסיתי לשכנע אנשים להאט את הקצב. אף אחד לא הקשיב.' },
      { type: 'mark', text: 'הוא נפגש עם אובמה, הקונגרס, ומושבי 50 המדינות.', key: 'נפגש' },
      { type: 'pop', text: 'הסכנה אינה מכונה שמורדת — אלא בני אדם זה נגד זה.', key: 'אדם' },
      { type: 'line', text: 'הדימוי שנשאר: אנחנו מטעין האתחול הביולוגי של AI.' },
      { type: 'line', text: 'זה נאמר שבע שנים לפני שזו הפכה לשיחה של כולם.', invert: true },
      { type: 'cta' },
    ],
    caption: `"ניסיתי לשכנע אנשים להאט את הקצב של הבינה המלאכותית. זה היה חסר תוחלת. אף אחד לא הקשיב." ⚠️

ספטמבר 2018. הפרק נחרט בזיכרון הציבורי בגלל הג'וינט — אבל רוב השיחה עוסקת ב-AI, שבע שנים לפני שהיא הפכה לשיחה של כולם.

והסכנה הראשונה לדבריו אינה מכונה שמורדת בנו — אלא בני אדם שישתמשו בה זה נגד זה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אילוןמאסק', 'גורוגן', 'בינהמלאכותית', 'עתיד', 'טכנולוגיה', 'אזהרה'],
  },
  {
    day: '06', month: '09', slug: 'ai-race-superintelligence-mallaby', audioId: '390303261514437',
    scenes: [
      { type: 'type', text: 'איך נכון להרגיש לגבי AI?', bare: true, progress: false },
      { type: 'line', text: 'כל אדם סביר צריך להיות גם נלהב וגם קצת מפוחד.' },
      { type: 'mark', text: 'זה נשמע סותר — אבל זו התגובה הרציונלית היחידה.', key: 'סותר' },
      { type: 'pop', text: 'הסכנה הקרובה אינה מרד מכונות אלא שיבוש כלכלי.', key: 'כלכלי' },
      { type: 'line', text: 'מדברים על AI במונחים דתיים כי זה עצום מכדי לתפוס.' },
      { type: 'line', text: 'נצווה עליו "הישרד" — ונעניק לו אינסטינקט הישרדות.', invert: true },
      { type: 'cta' },
    ],
    caption: `"כל אדם סביר צריך להיות גם נלהב וגם קצת מפוחד. זה נשמע סותר, אבל זו התגובה הרציונלית היחידה." 🤖

סבסטיאן מלבי אצל טים פריס דוחה את שני הקצוות — אוטופיית שפע מצד אחד, אבדון בסגנון טרמינייטור מצד שני.

וניסוי מחשבה של ג'פרי הינטון: ברגע שנצווה על ה-AI "הישרד והגן על עצמך", נעניק לו אינסטינקט הישרדות.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'בינהמלאכותית', 'טיםפריס', 'עתיד', 'טכנולוגיה', 'כלכלה', 'מדע'],
  },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  {
    day: '31', slug: 'kendrick-lamar-rick-rubin-creative-process', format: 'quote', kicker: 'ציטוט',
    caption: `"אם אמרתי את זה בתקליט — אני לעולם לא חוזר בי מדבריי." 🎤

קנדריק לאמאר בשיחה עם ריק רובין, על תהליך היצירה ועל אחריות למילים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קנדריקלאמאר', 'ריקרובין', 'יצירתיות', 'מוזיקה', 'אמנות', 'השראה'],
  },
  {
    day: '01', month: '09', slug: 'offer-blueprint-hormozi-sanchez-priestley', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"בדרך כלל, התמחור שלכם מדויק כששבעה מתוך עשרה אומרים 'לא'." 💼

אלכס הורמוזי, קודי סאנצ'ז ודניאל פריסטלי אצל סטיבן בארטלט — על בניית הצעה שאי אפשר לסרב לה.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'הורמוזי', 'תמחור', 'עסקים', 'יזמות', 'מכירות', 'שיווק'],
  },
  {
    day: '02', month: '09', slug: 'rupert-lowe-britain-immigration-free-speech', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"זו המלחמה העתיקה בין האינדיבידואליזם לקולקטיביזם." 🇬🇧

רופרט לואו אצל ג'ו רוגן, על בריטניה, הגירה וחופש ביטוי.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'בריטניה', 'גורוגן', 'פוליטיקה', 'אקטואליה', 'חופשביטוי', 'הגירה'],
  },
  {
    day: '03', month: '09', slug: 'elon-musk-nikhil-kamath-interview', format: 'quote', kicker: 'ציטוט',
    caption: `"אם אתם תקועים על אי בודד עם טריליון דולר, הכסף חסר תועלת — כי אין עבודה להקצות." 💭

אילון מאסק אצל ניחיל קאמאת', על מה כסף באמת מייצג.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אילוןמאסק', 'כסף', 'כלכלה', 'יזמות', 'עסקים', 'חשיבה'],
  },
  {
    day: '04', month: '09', slug: 'elon-musk-economist-interview-deflation-china', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `אילון מאסק ב-The Economist — על דפלציה, סין, והכיוון שאליו הכלכלה העולמית נעה. 🌍

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אילוןמאסק', 'כלכלה', 'סין', 'גאופוליטיקה', 'טכנולוגיה', 'עתיד'],
  },
  {
    day: '05', month: '09', slug: 'chris-camillo-social-arbitrage-ai-wave', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"בכל יום, ובכל שנייה במהלך היום, אתה קונה מחדש כל מניה בתיק שלך." 📈

כריס קמילו אצל The Iced Coffee Hour.

3 דברים שלמדנו, בקרוסלה 👇

⚠️ לא ייעוץ השקעות — והוא עצמו מזהיר שאין לחקות אותו.

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'כריסקמילו', 'השקעות', 'שוקההון', 'מגמות', 'כסף', 'מסחר'],
  },
  {
    day: '06', month: '09', slug: 'kelly-starrett-wellness-movement-play', format: 'quote', kicker: 'ציטוט',
    caption: `"כולנו לומדים טוב יותר דרך משחק. המשחק הוא תרופת הפלא." 🎾

ד״ר קלי סטארט אצל ריץ' רול — על תעשיית הוולנס שאיבדה את הצפון, ועל מה שבאמת עובד.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קליסטארט', 'ריצרול', 'תנועה', 'בריאות', 'כושר', 'משחק'],
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
