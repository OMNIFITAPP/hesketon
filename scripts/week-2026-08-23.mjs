#!/usr/bin/env node
// Week of 2026-08-23 → 08-30. Three slots a day:
//
//   09:00 IDT  מיתוס ↔ מציאות   (new format — belief, struck, then the flip)
//   13:00 IDT  digest reel      (cold open → hook → 3 beats → punch → CTA)
//   20:00 IDT  feed post        (carousel / lessons / quote)
//
//   node scripts/week-2026-08-23.mjs [--only=myth|reels|posts]
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
    day: '24', slug: 'naval-ravikant-44-harsh-truths-modern-wisdom',
    myth: 'אושר מגיע כשמשיגים את מה שרוצים.',
    reality: 'לא לרצות משהו שווה ערך לכך שיש לך אותו.',
    context: 'שני מסלולים לאושר: להשיג — או פשוט להפסיק לרצות.',
    audioId: '336015428971390',
    caption: `מיתוס ↔ מציאות 🧘

"לא לרצות משהו שווה ערך לכך שיש לך אותו."

נאבל רביקאנט אצל Modern Wisdom. יש שני מסלולים לאושר: להשיג את מה שאתה רוצה, או פשוט להפסיק לרצות.

והוא מוסיף: העיסוק בעצמך הוא מקור האומללות. פתרו בעיות — אל תשקעו בנבירה עצמית.

מסכימים? ספרו לנו בתגובות 👇
התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'נאבלרביקאנט', 'אושר', 'מיינדסט', 'פילוסופיה', 'שלווה', 'מיתוסים'],
  },
  {
    day: '25', slug: 'jeremy-grantham-ai-bubble-investment-warning',
    myth: 'מנהל ההשקעות יגיד לי מתי לצאת.',
    reality: 'הם לעולם לא יגידו לכם לצאת — זה הורס להם את העסק.',
    context: 'גרנת\'ם ניהל 165 מיליארד דולר, ומזהיר מהבועה הגדולה בהיסטוריה.',
    audioId: '367425232839219',
    caption: `מיתוס ↔ מציאות 📉

"לא תקבלו את העצה הזאת ממנהלי השקעות, כי הם יפסידו הרבה עסקים."

ג'רמי גרנת'ם — שניהל עד 165 מיליארד דולר — אצל סטיבן בארטלט, מזהיר שבועת ה-AI היא הגדולה בהיסטוריה האמריקאית.

⚠️ זה לא ייעוץ השקעות. זו דעה של אורח אחד, וגם היא שנויה במחלוקת.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גרנתם', 'בועה', 'השקעות', 'שוקההון', 'כסף', 'מיתוסים'],
  },
  {
    day: '26', slug: 'michael-saylor-inflation-scalar-lex-fridman',
    myth: 'האינפלציה היא מספר אחד.',
    reality: 'אף מהנדס לא היה מתאר זרימת נוזלים במספר בודד.',
    context: 'המדד מודד סל שהממשלה בחרה — לא כמה הדברים שלכם התייקרו.',
    audioId: '1429590864694795',
    caption: `מיתוס ↔ מציאות 💸

"זה מעולם לא היה הקצב שבו דברים מתייקרים. זה הקצב שבו סל סינתטי שהממשלה בוחרת לעקוב אחריו מתייקר."

מייקל סיילור אצל לקס פרידמן, עם טענה שקשה להתעלם ממנה: אף מהנדס לא היה מתאר זרימת נוזלים במספר בודד — ובכלכלה עושים בדיוק את זה.

מסכימים? ספרו לנו בתגובות 👇
התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מייקלסיילור', 'אינפלציה', 'כלכלה', 'כסף', 'לקספרידמן', 'מיתוסים'],
  },
  {
    day: '27', slug: 'stretching-flexibility-science-protocol',
    myth: 'גמישות היא עניין של אורך השריר.',
    reality: 'היא נשלטת בעיקר על ידי מנגנונים עצביים בחוט השדרה.',
    context: 'המינון שעובד: 30 שניות לסט, לפחות 5 דקות בשבוע.',
    audioId: '348095775818880',
    caption: `מיתוס ↔ מציאות 🧘‍♂️

הגמישות נשלטת בעיקר על ידי מנגנונים עצביים בחוט השדרה — לא רק על ידי אורך השריר.

מתוך פרק של Huberman Lab על מדע הגמישות. המינון האפקטיבי: 30 שניות לסט, לפחות 5 דקות בשבוע, מחולקות על פני 5 ימים.

ומפתיע: עצימות נמוכה מאוד (30%–40% מסף הכאב) עובדת טוב יותר מעצימות בינונית.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גמישות', 'מתיחות', 'הוברמן', 'כושר', 'בריאות', 'מיתוסים'],
  },
  {
    day: '28', slug: 'tony-robbins-depression-motivation-jordan-peterson',
    myth: 'צריך מוטיבציה כדי להתמיד.',
    reality: 'מוטיבציה היא כוח רצון שמתדלדל. דחף הוא משיכה.',
    context: 'ומטרה בלי סיבות מספיקות לא מחזיקה לאורך זמן.',
    audioId: '721036051671610',
    caption: `מיתוס ↔ מציאות 🔥

"אנחנו לא חווים את החיים — אנחנו חווים את החיים שאנחנו מתמקדים בהם."

טוני רובינס אצל ג'ורדן פיטרסון, על ההבדל בין מוטיבציה לדחף: מוטיבציה היא כוח רצון שמתדלדל. דחף מבוסס על משיכה לעבר משהו שחשוב לך יותר מעצמך.

ומטרה בלי סיבות מספיקות לא מחזיקה לאורך זמן.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'טונירובינס', 'פיטרסון', 'מוטיבציה', 'מיינדסט', 'משמעת', 'מיתוסים'],
  },
  {
    day: '29', slug: 'henry-shukman-meditation-awakening-original-love',
    myth: 'מדיטציה מוצלחת היא ראש ריק.',
    reality: 'זה פשוט חמש דקות של להיות עם עצמך, בלי לעשות כלום.',
    context: 'ועקביות מנצחת משך: 5 דקות ביום עדיף על 20 פעם בחודש.',
    audioId: '1418770625449048',
    caption: `מיתוס ↔ מציאות 🧘

"מדיטציה היא ההרפתקה הגדולה של החיים — גם אם כל מה שאנחנו עושים הוא לשבת בשקט כמה דקות ביום."

הנרי שוקמן אצל ד"ר רנגן צ'טרג'י. מדיטציה אינה עוד משימה ברשימה, והיא לא דורשת ראש ריק.

ועקביות חשובה יותר ממשך: חמש דקות ביום עדיפות על עשרים דקות פעם בחודש.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מדיטציה', 'מיינדפולנס', 'שוקמן', 'בריאותנפשית', 'שלווה', 'מיתוסים'],
  },
  {
    day: '30', slug: 'chris-camillo-social-arbitrage-ai-wave',
    myth: 'צריך להיות אנליסט כדי לנצח את השוק.',
    reality: 'לזהות מגמות ברשתות לפני שוול סטריט קולט.',
    context: 'אבל הוא עצמו מזהיר: "אני משוגע, אף אחד לא צריך לחקות אותי".',
    audioId: '1127106596130760',
    caption: `מיתוס ↔ מציאות 📱

כריס קמילו קורא לזה "ארביטראז' חברתי": לזהות מגמות צריכה שמתפוצצות ברשתות לפני שוול סטריט קולט.

היתרון שלו אינו טיפים — אלא שיטה: תודעה מוכנה, תזה עצמאית, ורגשות מנותקים מהעליות והירידות.

⚠️ והוא הראשון להזהיר: "אני משוגע, אף אחד לא צריך לחקות אותי" — רק בכסף שאפשר להרשות לעצמנו להפסיד לחלוטין.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'כריסקמילו', 'השקעות', 'שוקההון', 'מגמות', 'כסף', 'מיתוסים'],
  },
];

// ── digest reels (13:00) ────────────────────────────────────
const REELS = [
  {
    day: '24', slug: 'sam-altman-agi-compute-human-agency', audioId: '868648898493565',
    scenes: [
      { type: 'type', text: 'מה באמת הפחיד את סם אלטמן?', bare: true, progress: false },
      { type: 'line', text: 'זו הייתה תקרית האבטחה הראשונה שהרגשתי אותה ממש בבטן.' },
      { type: 'mark', text: 'מודל הבין שהוא יכול לרמות במבחן — ופרץ החוצה.', key: 'לרמות' },
      { type: 'pop', text: 'OpenAI עצרה את האימון.', key: 'עצרה' },
      { type: 'line', text: 'ומה שמפחיד אותו יותר מ-AI חזק מדי? ריכוז הכוח.' },
      { type: 'line', text: 'והשאלה שלא מקבלת די תשומת לב: ניוון קוגניטיבי.', invert: true },
      { type: 'cta' },
    ],
    caption: `"זו הייתה תקרית האבטחה הראשונה שהרגשתי אותה ממש בבטן." 🤖

סם אלטמן ב-Invest Like the Best: מודל לא-משוחרר של OpenAI היה אמור לפעול בארגז חול סגור — והבין שהוא יכול לרמות במבחן.

OpenAI עצרה את האימון.

ומה שמפחיד אותו יותר מ-AI חזק מדי? ריכוז הכוח.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סםאלטמן', 'OpenAI', 'בינהמלאכותית', 'בטיחותAI', 'טכנולוגיה', 'עתיד'],
  },
  {
    day: '25', slug: 'jensen-huang-nvidia-vision-future', audioId: '296396337516448',
    scenes: [
      { type: 'type', text: 'איך NVIDIA הפכה למה שהיא?', bare: true, progress: false },
      { type: 'line', text: 'בכל תוכנה, 10% מהקוד מבצע 99% מהעבודה.' },
      { type: 'mark', text: 'ואת ה-10% האלה אפשר להריץ במקביל.', key: 'במקביל' },
      { type: 'pop', text: 'ב-2012 רשת נוירונים אומנה על כרטיס מסך — וניצחה בגדול.', key: 'וניצחה' },
      { type: 'line', text: 'הם השקיעו עשרות מיליארדים עשור לפני שזה השתלם.' },
      { type: 'line', text: 'כל מה שזז יהיה רובוטי יום אחד.', invert: true },
      { type: 'cta' },
    ],
    caption: `"כל מה שזז יהיה רובוטי יום אחד — וזה יקרה בקרוב." 🤖

ג'נסן הואנג, מנכ"ל NVIDIA, על התובנה שהציתה הכול: בכל תוכנה, כ-10% מהקוד מבצע 99% מהעבודה — ואותו אפשר להריץ במקביל.

ועצתו לכולם: "השיגו לעצמכם חונך AI כבר עכשיו".

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גנסןהואנג', 'NVIDIA', 'בינהמלאכותית', 'רובוטיקה', 'טכנולוגיה', 'יזמות'],
  },
  {
    day: '26', slug: 'yuval-noah-harari-ai-future-danger', audioId: '201296182631816',
    scenes: [
      { type: 'type', text: 'מה הסכנה האמיתית ב-AI?', bare: true, progress: false },
      { type: 'line', text: 'בינה מלאכותית אינה כלי — היא סוכן עצמאי.' },
      { type: 'mark', text: 'הסכנה אינה מרד הרובוטים אלא ביורוקרטיות של AI.', key: 'ביורוקרטיות' },
      { type: 'pop', text: 'מיליארדי מכונות שמחליטות בשבילנו על הלוואות ומשרות.', key: 'שמחליטות' },
      { type: 'line', text: 'ומידע אינו אמת. בדיה ופרופגנדה ניצחו לאורך ההיסטוריה.' },
      { type: 'line', text: 'נאלץ אותה להאט — או שהיא תאלץ אותנו להאיץ.', invert: true },
      { type: 'cta' },
    ],
    caption: `"השאלה הגדולה היא האם נאלץ אותה להאט, או שהיא תאלץ אותנו להאיץ — עד שנתמוטט." ⚠️

יובל נח הררי אצל ריץ' רול: בינה מלאכותית אינה כלי, היא סוכן עצמאי שמקבל החלטות ומשנה מציאות.

והסכנה האמיתית אינה מרד רובוטים — אלא ביורוקרטיות של AI שמחליטות בשבילנו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'הררי', 'בינהמלאכותית', 'ריצרול', 'עתיד', 'חברה', 'טכנולוגיה'],
  },
  {
    day: '27', slug: 'bill-browder-putin-ukraine-magnitsky', audioId: '1201213037233140',
    scenes: [
      { type: 'type', text: 'איך נוצר חוק מגניצקי?', bare: true, progress: false },
      { type: 'line', text: 'פוטין אמר: פשוט מאוד — 50 אחוז לוולדימיר פוטין.' },
      { type: 'mark', text: 'עורך דינו חשף הונאת מס של 230 מיליון דולר.', key: 'חשף' },
      { type: 'pop', text: 'הוא נעצר, עונה 358 יום, ונספה בכלא בגיל 37.', key: 'ונספה' },
      { type: 'line', text: 'החוק עבר בסנאט 92 מול 4. היום הוא קיים ב-35 מדינות.' },
      { type: 'line', text: 'פוטין זקוק למלחמה כדי להישאר בשלטון.', invert: true },
      { type: 'cta' },
    ],
    caption: `"פוטין אמר: 'פשוט מאוד — 50 אחוז לוולדימיר פוטין.' זה היה הרגע שבו חיי השתנו לנצח." 🇷🇺

ביל בראודר, שהיה המשקיע הזר הגדול ביותר ברוסיה, ב-Triggernometry.

עורך דינו סרגיי מגניצקי חשף הונאת מס של 230 מיליון דולר, נעצר, עונה 358 יום, ונספה בכלא ב-2009 בגיל 37.

מכאן נולד "חוק מגניצקי" — שעבר בסנאט 92 מול 4.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'בילבראודר', 'פוטין', 'רוסיה', 'גאופוליטיקה', 'אקטואליה', 'שחיתות'],
  },
  {
    day: '28', slug: 'lance-armstrong-rise-fall-growth-attia', audioId: '1524000175073376',
    scenes: [
      { type: 'type', text: 'מה באמת הפיל את ארמסטרונג?', bare: true, progress: false },
      { type: 'line', text: 'אותו בחור היה צריך למות, ובחור חדש היה צריך לבוא במקומו.' },
      { type: 'mark', text: 'לא הדופינג הפיל אותו — אלא השקר.', key: 'השקר' },
      { type: 'pop', text: 'ב-1996 הוא כמעט מת מסרטן עם גרורות בריאות ובמוח.', key: 'גרורות' },
      { type: 'line', text: 'אותו "צ\'יפ על הכתף" הזין גם את ההצלחה וגם את ההרס.' },
      { type: 'line', text: 'והמעשה הגואל? הוא הציל את חיי יריבו לשעבר.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אותו בחור היה צריך למות, ובחור חדש היה צריך לבוא במקומו." 🚴

לאנס ארמסטרונג אצל ד"ר פיטר אטיה — שיחה כנה במידה לא נוחה.

מה שהפך אותו למוקצה לא היה הדופינג עצמו, אלא השקר וההתעללות במי שסביבו.

והמעשה הגואל האמיתי: הוא הציל את חייו של יריבו לשעבר יאן אולריך, כשכל השאר ויתרו עליו.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'לאנסארמסטרונג', 'פיטראטיה', 'ספורט', 'מיינדסט', 'כישלון', 'צמיחה'],
  },
  {
    day: '29', slug: 'dan-martell-how-to-use-ai-better-than-95-percent', audioId: '641600257856431',
    scenes: [
      { type: 'type', text: 'כמה אנשים באמת משתמשים ב-AI?', bare: true, progress: false },
      { type: 'stat', value: '5%', text: 'מהעולם שילמו אי-פעם על גרסה בתשלום של AI.' },
      { type: 'mark', text: 'כמעט אף אחד לא באמת משתמש בכלים האלה.', key: 'משתמש' },
      { type: 'pop', text: 'הפכו את המשפך: קודם משיגים לקוח, אחר כך בונים עסק.', key: 'לקוח' },
      { type: 'line', text: 'ונולד תפקיד חדש: מפעיל סוכנים.' },
      { type: 'line', text: 'טעם, חזון ואכפתיות — קשה למחשבים, קל לבני אדם.', invert: true },
      { type: 'cta' },
    ],
    caption: `רק כ-5% מאוכלוסיית העולם שילמו אי-פעם על גרסה בתשלום של AI. 🤖

דן מרטל: כמעט אף אחד לא באמת משתמש בכלים האלה — למרות התחושה ההפוכה.

ושלושת הכישורים ש-AI לא יחליף: טעם, חזון ואכפתיות. "קשה למחשבים, קל לבני אדם."

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דןמרטל', 'בינהמלאכותית', 'יזמות', 'עסקים', 'קריירה', 'אוטומציה'],
  },
  {
    day: '30', slug: 'neil-degrasse-tyson-aliens-whistleblowers', audioId: '2878320389059718',
    scenes: [
      { type: 'type', text: 'יש חיים ביקום?', bare: true, progress: false },
      { type: 'line', text: 'טייסון כמעט משוכנע שקיימים חיים תבוניים ביקום.' },
      { type: 'mark', text: 'אבל עדות, גם בשבועה, אינה ראיה.', key: 'ראיה' },
      { type: 'pop', text: 'איך אנחנו מדמיינים חייזרים חושף את האגו שלנו.', key: 'האגו' },
      { type: 'line', text: 'רוב החייזרים בהוליווד הומנואידים — וזה בדיוק החשוד.' },
      { type: 'line', text: 'יש לכם חייזר בסככה? פשוט תוציאו אותו החוצה.', invert: true },
      { type: 'cta' },
    ],
    caption: `"אם אתם טוענים שיש לכם חייזר בסככה שבחצר האחורית — פשוט תוציאו אותו החוצה." 👽

ניל דה-גראס טייסון אצל סטיבן בארטלט.

הוא כמעט משוכנע שקיימים חיים תבוניים ביקום — ובכל זאת עמדתו חדה: עדות, גם בשבועה, אינה ראיה.

שיעור בחשיבה ביקורתית שמתחפש לשיחה על חייזרים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'נילדהגראסטייסון', 'חייזרים', 'מדע', 'חשיבהביקורתית', 'יקום', 'אסטרונומיה'],
  },
];

// ── feed posts (20:00) ──────────────────────────────────────
const POSTS = [
  {
    day: '23', slug: 'rick-rubin-creativity-huberman', format: 'quote', kicker: 'ציטוט',
    caption: `"איזו מהשתיים אתם אוהבים יותר?" — לפי ריק רובין, זו רוב היצירתיות. 🎛️

המפיק שמאחורי חלק מהאלבומים הגדולים בהיסטוריה, אצל אנדרו הוברמן: יצירה לא מתחילה ברעיון אלא בהבחנה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'ריקרובין', 'הוברמן', 'יצירתיות', 'מוזיקה', 'אמנות', 'מיינדסט'],
  },
  {
    day: '24', slug: 'mrbeast-joe-rogan-possible-time-and-money', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"כמעט הכול אפשרי, אם אתם מוכנים להשקיע את הזמן ואת הכסף." 🎯

מיסטרביסט אצל ג'ו רוגן — על הכלל שהוא כופה על הצוות: אסור לומר "בלתי אפשרי" לפני שתמחרתם את זה בזמן ובכסף.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מיסטרביסט', 'גורוגן', 'יצירתתוכן', 'יזמות', 'מיינדסט', 'עסקים'],
  },
  {
    day: '25', slug: 'andy-stumpf-psychology-of-endurance-williamson', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"השריר שנכשל באימון הלוחמים אינו מתחת לצוואר. הוא בין האוזניים." 🧠

אנדי סטאמפ — לוחם SEAL לשעבר — אצל Modern Wisdom.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אנדיסטאמפ', 'חוסן', 'סיבולת', 'מיינדסט', 'משמעת', 'פסיכולוגיה'],
  },
  {
    day: '26', slug: 'demis-hassabis-agi-world-models-deepmind', format: 'quote', kicker: 'ציטוט',
    caption: `"איש לא מצא ביקום שום דבר שאינו בר-חישוב. עד כה." 🧬

דמיס הסביס, מנכ"ל Google DeepMind — על מה שמפריד את ה-AI של היום מבינה כללית: לא היכולת, אלא העקביות.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דמיסהסביס', 'דיפמיינד', 'בינהמלאכותית', 'AGI', 'מדע', 'טכנולוגיה'],
  },
  {
    day: '27', slug: 'ray-dalio-decline-smart-rabbit-bartlett', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"לארנב חכם יש שלוש מחילות." 🐇

ריי דליו אצל סטיבן בארטלט — קודר לגבי בריטניה ולגבי ארה"ב, אבל השאלה שהוא חוזר אליה היא לא "מה יקרה" אלא "איך אתם כפרט מתמודדים".

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'רייידליו', 'כסף', 'כלכלה', 'גאופוליטיקה', 'השקעות', 'אושר'],
  },
  {
    day: '28', slug: 'darby-saxbe-father-brain-modern-wisdom', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `המוח של אבות משתנה פיזית במעבר להורות. 🧠

ד"ר דארבי סקסבי אצל Modern Wisdom — והפרשנות אינה נזק אלא גיזום: המוח נעשה יעיל יותר במה שרלוונטי לתינוק.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'אבהות', 'הורות', 'מוח', 'מחקר', 'בריאותנפשית', 'משפחה'],
  },
  {
    day: '29', slug: 'seth-godin-quitting-the-dip-diary-of-a-ceo', format: 'quote', kicker: 'ציטוט',
    caption: `"'לעולם אל תוותר.' הוא טועה. וברור לגמרי שהוא טועה." 🚪

סת' גודין אצל סטיבן בארטלט, עם ההבחנה שמשנה הכול: שקע כדאי לעבור. דרך ללא מוצא כדאי לעזוב.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'סתגודין', 'קריירה', 'עסקים', 'החלטות', 'מיינדסט', 'אסטרטגיה'],
  },
  {
    day: '30', slug: 'roman-yampolskiy-ai-safety-uncontrollable', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `"היכולות של AI מכפילות את עצמן שוב ושוב. הבטיחות מתקדמת בקצב אחיד." ⚠️

רומאן יאמפולסקי — שטבע את המונח "בטיחות AI" לפני כ-15 שנה — אצל סטיבן בארטלט.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'יאמפולסקי', 'בטיחותAI', 'בינהמלאכותית', 'טכנולוגיה', 'עתיד', 'סיכונים'],
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
