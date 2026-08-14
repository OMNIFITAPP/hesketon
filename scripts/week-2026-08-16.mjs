#!/usr/bin/env node
// Week of 2026-08-16 → 08-22. Three slots a day:
//
//   09:00 IDT  מיתוס ↔ מציאות   (new format — belief, struck, then the flip)
//   13:00 IDT  digest reel      (cold open → hook → 3 beats → punch → CTA)
//   20:00 IDT  feed post        (carousel / lessons / quote)
//
//   node scripts/week-2026-08-16.mjs [--only=myth|reels|posts]
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
    day: '16', slug: 'seth-godin-quitting-the-dip-diary-of-a-ceo',
    myth: 'לעולם אל תוותר.',
    // The cover is lifted from this line, so it has to stand on its own in
    // the grid. "הוא טועה" only parses if you have already seen the myth.
    reality: 'שקע כדאי לעבור. דרך ללא מוצא כדאי לעזוב.',
    context: 'והמילה שמחזיקה אנשים תקועים היא "אבל".',
    audioId: '1242374782854719',
    caption: `מיתוס ↔ מציאות 🚪

"'אם ויתרת פעם אחת, זה הופך להרגל. לעולם אל תוותר.' הוא טועה. וברור לגמרי שהוא טועה."

סת' גודין אצל סטיבן בארטלט, עם ההבחנה שמשנה הכול: **שקע** הוא החלק הקשה בין ההתחלה לבין להיות טוב — אותו כדאי לעבור. **דרך ללא מוצא** לא תשתפר לעולם — ממנה כדאי לצאת.

והמילה שמחזיקה אנשים תקועים? "אבל".

מסכימים? ספרו לנו בתגובות 👇
התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'סתגודין', 'קריירה', 'עסקים', 'החלטות', 'מיינדסט', 'מיתוסים'],
  },
  {
    day: '17', slug: 'mohnish-pabrai-dhandho-investor-financial-freedom',
    myth: 'תשואה גבוהה מחייבת סיכון גבוה.',
    reality: 'עץ — אני מרוויח; פלי — אני לא מפסיד הרבה.',
    context: 'וגם: העתקה היא יתרון. גייטס, וולטון ושולץ בנו על מודלים קיימים.',
    audioId: '421348377170726',
    caption: `מיתוס ↔ מציאות 🎲

"עץ — אני מרוויח; פלי — אני לא מפסיד הרבה."

מוניש פבראי אצל סטיבן בארטלט. כל תפיסת ההשקעות שלו בנויה על אי-סימטריה: לחפש מצבים שבהם הצד השלילי קטן והצד החיובי גדול.

ועוד משהו שנוגד את האינטואיציה: העתקה היא יתרון, לא חיסרון.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מונישפבראי', 'השקעות', 'כסף', 'סיכון', 'יזמות', 'מיתוסים'],
  },
  {
    day: '18', slug: 'michael-saylor-store-of-value-house-diary-of-a-ceo',
    myth: 'בית הוא הדרך הבטוחה לשמור על הכסף.',
    reality: 'בית אינו אמצעי טוב לשמירת ערך.',
    context: 'בפלורידה, לפי החישוב שלו, מס הרכוש לבדו שווה לעלות הבית כל 36 שנה.',
    audioId: '948807320625767',
    caption: `מיתוס ↔ מציאות 🏠

מייקל סיילור אצל סטיבן בארטלט טוען שבית אינו אמצעי טוב לשמירת ערך — ומביא חישוב: בפלורידה, מס הרכוש לבדו שווה לעלות הבית בערך כל 36 שנה.

אבל הוא מסייג מיד: בית עדיין עדיף על החזקת מזומן.

ונדל"ן מסחרי, לדבריו, עובד אחרת לגמרי.

מסכימים? ספרו לנו בתגובות 👇
התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מייקלסיילור', 'נדלן', 'כסף', 'אינפלציה', 'השקעות', 'מיתוסים'],
  },
  {
    day: '19', slug: 'kelly-starrett-wellness-movement-play',
    myth: 'כדי להיות בריא צריך ציוד יקר.',
    reality: 'מה שאתם צריכים זה כדור טניס, חבל ופריזבי.',
    context: 'המסננת שלו: האם זה מה שיביא אתכם לאולימפיאדה?',
    audioId: '351866282607327',
    caption: `מיתוס ↔ מציאות 🎾

ד״ר קלי סטארט — מומחה התנועה שעבד עם אולימפיונים ולוחמי יחידות מובחרות — אצל ריץ' רול.

אישה שאלה אותו אם לקנות "לוח רטט" ב-1,000 דולר. התשובה: לא. מה שאתם צריכים זה כדור טניס, חבל ופריזבי.

המסננת שלו לכל טרנד בריאות: האם זה מה שיביא אתכם לאולימפיאדה? אף ספורטאי עילית לא משתמש ברוב הדברים האלה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קליסטארט', 'ריצרול', 'תנועה', 'בריאות', 'כושר', 'מיתוסים'],
  },
  {
    day: '20', slug: 'andrew-huberman-cortisol-habits-focus',
    myth: 'להרגיש לחוץ בבוקר זה סימן רע.',
    reality: 'אתה אמור להרגיש קצת לחוץ בבוקר. זה נורמלי. זה בריא.',
    context: 'זה מכין אותך להיות רגוע יותר בצהריים.',
    audioId: '1223134719013093',
    caption: `מיתוס ↔ מציאות ☀️

"אתה אמור להרגיש קצת לחוץ בבוקר. זה נורמלי. זה בריא. וזה מכין אותך להיות רגוע יותר בצהריים."

פרופ' אנדרו הוברמן אצל Modern Wisdom. קורטיזול בוקר אינו הורמון סטרס רע — הוא הדומינו הראשון שמכתיב ערנות, מצב רוח, ואיכות השינה בלילה.

וטיפ מעשי: אור בהיר בשעה הראשונה אחרי הקימה יכול להגביר את שיא הקורטיזול בעד 50%.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הוברמן', 'קורטיזול', 'שגרתבוקר', 'שינה', 'בריאות', 'מיתוסים'],
  },
  {
    day: '21', slug: 'jefferson-fisher-communication-conflict-assertiveness',
    myth: 'שיחה קשה כדאי לפתוח במחמאה.',
    reality: 'פתחו עם הנקודה הקשה קודם.',
    context: 'וכשמעליבים אתכם: שתיקה של 5–7 שניות ובקשה לחזור על הדברים.',
    audioId: '1384543860206123',
    caption: `מיתוס ↔ מציאות 🗣️

"השיחה שאתה נמנע ממנה היא התוצאה שאתה בוחר."

ג'פרסון פישר — עורך דין שהפך למורה לתקשורת — אצל Modern Wisdom.

שיחות קשות צריך לפתוח עם הנקודה הקשה קודם, לא עם מחמאות ופתיחות. וכשמישהו מעליב אתכם: שתיקה של 5–7 שניות ובקשה לחזור על הדברים יעשו יותר מכל תגובה חריפה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'תקשורת', 'אסרטיביות', 'קונפליקט', 'מערכותיחסים', 'מיינדסט', 'מיתוסים'],
  },
  {
    day: '22', slug: 'naval-ravikant-specific-knowledge-leverage-joe-rogan-1309',
    myth: 'כדי להרוויח יותר צריך לעבוד קשה יותר.',
    reality: 'הדרך לפרוש היא למצוא את הדבר שאתה עושה טוב מכל אחד אחר.',
    context: 'המבחן: אם הכסף היה נמחק מחר — הידע היה מחזיר אותו.',
    audioId: '1197857668796525',
    caption: `מיתוס ↔ מציאות 🧠

"הדרך לצאת ממלכודת התחרות היא להיות אותנטי."

נאבל רביקאנט אצל ג'ו רוגן, על שלושת הרכיבים שיוצרים אדם שאי אפשר להחליף: ידע ייחודי, אחריות אישית, ומינוף.

וידע ייחודי, לפי ההגדרה שלו, הוא בדיוק מה שאי אפשר ללמד בקורס — אחרת כבר היו מלמדים אותו.

המבחן: אם הכסף היה נמחק מחר, הידע היה מחזיר אותו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'נאבלרביקאנט', 'גורוגן', 'מינוף', 'קריירה', 'כסף', 'מיתוסים'],
  },
];

// ── digest reels (13:00) ────────────────────────────────────
const REELS = [
  {
    day: '16', slug: 'matthew-mcconaughey-reinventing-yourself-modern-wisdom', audioId: '526825256283644',
    scenes: [
      { type: 'type', text: 'איך מתחילים מחדש?', bare: true, progress: false },
      { type: 'line', text: 'נעדרתי מספיק זמן כדי להפוך לרעיון טוב חדש.' },
      { type: 'mark', text: 'הוא הפסיק לקבל תפקידים — בלי שהייתה עבודה אחרת ביד.', key: 'הפסיק' },
      { type: 'pop', text: 'ההמתנה נמשכה כ-20 חודשים. באמצע הוא סירב ל-14.5 מיליון.', key: 'סירב' },
      { type: 'line', text: 'אשתו אמרה: ייתכן שלא תקבל עבודה שוב לעולם.' },
      { type: 'line', text: 'לא לגלות מי אתה — אלא לפסול מה שאתה לא.', invert: true },
      { type: 'cta' },
    ],
    caption: `"נעדרתי מספיק זמן כדי להפוך לרעיון טוב חדש." 🎬

מתיו מקונוהיי אצל Modern Wisdom, על 20 החודשים שבהם סירב לכל תפקיד בקומדיה רומנטית — בלי שהייתה לו עבודה אחרת ביד.

באמצע התקופה הזו הוא סירב להצעה של 14.5 מיליון דולר. ולדבריו דווקא הסירוב הזה הוא ששינה את מה שחשבו עליו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מקונוהיי', 'הוליווד', 'קריירה', 'מיינדסט', 'החלטות', 'השראה'],
  },
  {
    day: '17', slug: 'brian-cox-particle-physics-frontier-startalk', audioId: '1486372649453979',
    scenes: [
      { type: 'type', text: 'מה נמצא מעבר לפינה?', bare: true, progress: false },
      { type: 'line', text: 'לראשונה אנחנו לא יודעים אם יש עוד משהו מעבר לפינה.' },
      { type: 'mark', text: 'אחרי ההיגס ציפו למצוא עוד חלקיקים. הם לא נמצאו.', key: 'נמצאו' },
      { type: 'pop', text: 'מאיץ החלקיקים אינו מנפץ חומר — הוא מיקרוסקופ.', key: 'מיקרוסקופ' },
      { type: 'line', text: 'וזה לא "חומר אפל" אלא כבידה אפלה.' },
      { type: 'line', text: 'אין מפת דרכים. וזה רע — אבל זה גם טוב.', invert: true },
      { type: 'cta' },
    ],
    caption: `"לראשונה אפשר לומר שבפיזיקת החלקיקים אנחנו לא יודעים אם יש עוד משהו ממש מעבר לפינה." 🔬

פרופ' בריאן קוקס ב-StarTalk. אחרי גילוי חלקיק ההיגס ציפו למצוא עוד — הם לא נמצאו.

וטייסון מתקן מונח שכולנו משתמשים בו לא נכון: זה לא "חומר אפל" אלא כבידה אפלה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'בריאןקוקס', 'סטארטוק', 'פיזיקה', 'מדע', 'יקום', 'חלקיקים'],
  },
  {
    day: '18', slug: 'dwayne-johnson-the-rock-joe-rogan-2063', audioId: '778541440637690',
    scenes: [
      { type: 'type', text: 'מה קורה כשהתוכנית נגמרת?', bare: true, progress: false },
      { type: 'line', text: 'ג\'ונסון לא גר בבית עד גיל 27.' },
      { type: 'mark', text: 'פוטבול היה הכרטיס. המטרה: בית ראשון להורים.', key: 'הכרטיס' },
      { type: 'pop', text: 'הוא נחתך מהליגה — וכשהציעו לו חוזה נוסף, סירב.', key: 'סירב' },
      { type: 'line', text: 'הריב עם אביו באותו רגע היה הגדול בחייהם.' },
      { type: 'line', text: 'הקאדילק הראשון? הוא הבין שהוא לא רוצה אותו.', invert: true },
      { type: 'cta' },
    ],
    caption: `דוויין ג'ונסון לא גר בבית עד גיל 27. 🏈

אצל ג'ו רוגן הוא מספר על הרגע שבו נחתך מהליגה הקנדית — וכשהמאמן התקשר להציע חוזה נוסף, סירב. אביו ישב באותו חדר.

"תודה על ההזדמנות — אבל אני הולך לסגור את הפרק הזה בחיים שלי."

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דוויןגונסון', 'גורוגן', 'מיינדסט', 'קריירה', 'ספורט', 'השראה'],
  },
  {
    day: '19', slug: 'annie-jacobsen-biological-war-joe-rogan-2534', audioId: '2301335310186677',
    scenes: [
      { type: 'type', text: 'איפה התוכניות נעצרות?', bare: true, progress: false },
      { type: 'line', text: 'יש נקודה שבה הכאוס משתלט — והמשחק המלחמתי נגמר.' },
      { type: 'mark', text: 'כל תוכניות החירום נעצרות באותו רגע בדיוק.', key: 'באותו' },
      { type: 'pop', text: 'זה לא שאין המשך. יש. הוא פשוט מסווג.', key: 'מסווג' },
      { type: 'line', text: 'לצד DEFCON יש סולם מסווג בשם COGCON.' },
      { type: 'line', text: 'בביולוגי החשש אינו הפגיעה — אלא ההתפרקות אחריה.', invert: true },
      { type: 'cta' },
    ],
    caption: `"יש נקודה בכל התוכניות האלה שבה הכאוס משתלט — והמשחק המלחמתי נגמר." ⚠️

אנני ג'ייקובסן אצל ג'ו רוגן. היא קראה את תוכניות החירום הפומביות של ארה"ב למגפה ומצאה דפוס אחד: כולן נעצרות באותו רגע — כשהסדר הציבורי קורס.

ההמשך קיים. הוא פשוט מסווג.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אניגייקובסן', 'גורוגן', 'ביטחון', 'מגפה', 'אקטואליה', 'מדע'],
  },
  {
    day: '20', slug: 'elon-musk-joe-rogan-1470-talent-neuralink', audioId: '1001849700279067',
    scenes: [
      { type: 'type', text: 'לאן הולך הכישרון?', bare: true, progress: false },
      { type: 'line', text: 'יש הקצאת יתר של כישרון לפיננסים ולמשפטים.' },
      { type: 'mark', text: 'צריך יותר אנשים שמייצרים דברים.', key: 'שמייצרים' },
      { type: 'pop', text: 'הוא ויתר על תכנון בית — כי אותן שעות הולכות למאדים.', key: 'למאדים' },
      { type: 'line', text: 'נוירלינק: שתל בקוטר 2.5 ס"מ, ישר עם הגולגולת.' },
      { type: 'line', text: 'היקום התחיל כמימן. איפה הוא הפך למודע?', invert: true },
      { type: 'cta' },
    ],
    caption: `"יותר מדי אנשים חכמים הולכים לפיננסים ולמשפטים. צריך יותר אנשים שמייצרים דברים." 🚀

אילון מאסק אצל ג'ו רוגן — על הפער בין מי שמרוויח מהנדסת מוצר לבין מי שמרוויח מהזזת כסף.

ולסיום שאלה שהוא משאיר פתוחה: היקום התחיל כמימן, וכעבור 13.8 מיליארד שנה המימן הפך למודע. איפה בדיוק זה קרה?

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אילוןמאסק', 'גורוגן', 'נוירלינק', 'טכנולוגיה', 'קריירה', 'חדשנות'],
  },
  {
    day: '21', slug: 'darby-saxbe-father-brain-modern-wisdom', audioId: '440588108234177',
    scenes: [
      { type: 'type', text: 'מה קורה למוח של אבא?', bare: true, progress: false },
      { type: 'line', text: 'המוח מאבד נפח חומר אפור במעבר לאבהות.' },
      { type: 'mark', text: 'אצל אימהות הירידה כ-2.5 אחוזים. אצל אבות — פחות.', key: 'הירידה' },
      { type: 'pop', text: 'ואצל אבות היא תלויה במידת המעורבות.', key: 'המעורבות' },
      { type: 'line', text: 'זה אינו נזק — זה גיזום. המוח נעשה יעיל יותר.' },
      { type: 'line', text: 'דיכאון אצל אבות טריים: גבוה פי שניים.', invert: true },
      { type: 'cta' },
    ],
    caption: `המוח של אבות משתנה פיזית במעבר להורות. 🧠

ד"ר דארבי סקסבי אצל Modern Wisdom סורקת אבות באמצע ההיריון ושוב אחרי הלידה — ומוצאת ירידה בנפח החומר האפור.

זה אינו נזק. הפרשנות היא גיזום: המוח נעשה יעיל יותר במה שרלוונטי לתינוק.

ונתון שראוי לתשומת לב: דיכאון אצל אבות טריים שכיח פי שניים מבאוכלוסייה הכללית.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'אבהות', 'הורות', 'מוח', 'מחקר', 'בריאותנפשית', 'משפחה'],
  },
  {
    day: '22', slug: 'kane-kallaway-content-lego-bricks-system', audioId: '367579208647291',
    scenes: [
      { type: 'type', text: 'למה תוכן אחד עובד והשני לא?', bare: true, progress: false },
      { type: 'line', text: 'האסטרטגיה הופכת למצרך ברגע שאתה מכיר אותה.' },
      { type: 'mark', text: 'הסוד הוא המרחק בין חזרה לחזרה.', key: 'המרחק' },
      { type: 'pop', text: 'פרקו כל דבר מורכב ליחידות אטומיות — וערמו מחדש.', key: 'אטומיות' },
      { type: 'line', text: 'הוו בנוי משלושה: ויזואלי, מדובר, וטקסטואלי.' },
      { type: 'line', text: 'המדד אינו צפיות אלא כמה מהמסר באמת נקלט.', invert: true },
      { type: 'cta' },
    ],
    caption: `"האסטרטגיה אינה הרוטב. האסטרטגיה הופכת למצרך ברגע שאתה מכיר אותה." 🧱

קיין קלאוויי על שיטת ה"לגו" לתוכן: פרקו כל דבר מורכב ליחידות אטומיות, מצאו את האפשרויות לכל יחידה, וערמו מחדש.

והמדד שהוא מציע אינו צפיות — אלא קצב ספיגה: כמה מהמסר הקורא באמת קולט.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'תוכן', 'שיווק', 'יצירתתוכן', 'אסטרטגיה', 'עסקים', 'קריאייטיב'],
  },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  {
    day: '16', slug: 'andy-galpin-fitness-principles-rich-roll', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"תוכנית תמיד מנצחת היעדר תוכנית — גם אם היא לא הטובה ביותר." 🏋️

ד"ר אנדי גלפין אצל ריץ' רול, על העקרונות שקובעים אם אימון עובד.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנדיגלפין', 'ריצרול', 'כושר', 'אימונים', 'בריאות', 'עקביות'],
  },
  {
    day: '17', slug: 'kevin-oleary-wealth-discipline-diary-of-a-ceo', format: 'quote', kicker: 'ציטוט',
    caption: `"בניית עושר מסתכמת במילה אחת: משמעת." 💰

קווין אולירי — מ-Shark Tank — אצל סטיבן בארטלט, על ההרגלים הכספיים שהוא מייחס להם את ההבדל בין מי שצובר הון למי שלא.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קוויןאולירי', 'כסף', 'משמעת', 'השקעות', 'עסקים', 'חינוךפיננסי'],
  },
  {
    day: '18', slug: 'alex-hormozi-reality-is-the-moat-ai', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"המציאות היא החפיר." 🏰

אלכס הורמוזי אצל סטיבן בארטלט, עם מבחן פשוט לכל פרויקט AI בעסק: אתם מרוויחים יותר כסף? אם לא — עצרו.

בקרוסלה: למה הפגם שעוצר עסקים במיליון דולר אינו שיווק, ולמה מוניטין אפשר לצבור רק במציאות.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אלכסהורמוזי', 'בינהמלאכותית', 'עסקים', 'יזמות', 'שיווק', 'אסטרטגיה'],
  },
  {
    day: '19', slug: 'james-clear-habits-getting-started-huberman', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"המשקל הכבד ביותר בחדר הכושר הוא דלת הכניסה." 🚪

ג'יימס קליר — מחבר "הרגלים אטומיים" — אצל אנדרו הוברמן.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'גיימסקליר', 'הרגלים', 'הוברמן', 'משמעת', 'מיינדסט', 'פרודוקטיביות'],
  },
  {
    day: '20', slug: 'bob-lazar-jeremy-corbell-area-51-joe-rogan', format: 'quote', kicker: 'ציטוט',
    caption: `"אין שום חיווט שמחבר בין רכיבי המשנה, בכלל. הדברים האלה גובלים בקסם." 🛸

בוב לזאר אצל ג'ו רוגן — הסיפור שלא מפסיק לעורר ויכוח, מסופר בגוף ראשון.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'בובלזאר', 'גורוגן', 'אזור51', 'חייזרים', 'מדע', 'תעלומות'],
  },
  {
    day: '21', slug: 'ai-race-superintelligence-mallaby', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"כל אדם סביר צריך להיות גם נלהב וגם קצת מפוחד. זו התגובה הרציונלית היחידה." 🤖

סבסטיאן מלבי אצל טים פריס, על המרוץ לבינה-על — מי מתחרה, מה באמת עומד על הפרק, ולמה שתי התחושות ההפוכות האלה נכונות בו-זמנית.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'בינהמלאכותית', 'טיםפריס', 'טכנולוגיה', 'עתיד', 'גיאופוליטיקה', 'מדע'],
  },
  {
    day: '22', slug: 'creatine-dosing-myths-candow', format: 'quote', kicker: 'ציטוט',
    caption: `"מוח בריא כנראה לא זקוק לקריאטין בכלל. אבל מוח בלחץ — כן." 💊

ד"ר דארן קנדו אצל סטיבן בארטלט, מפרק את המיתוסים סביב קריאטין: כליות, מים, שיער — ומה המחקר באמת מראה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קריאטין', 'תוספים', 'בריאות', 'כושר', 'מדע', 'תזונה'],
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
