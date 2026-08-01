#!/usr/bin/env node
// Week of 2026-08-02 → 08-08: 7 v2 reels (13:00 IDT) + 7 feed posts (20:00 IDT).
//
//   node scripts/batch-week-2026-08-02.mjs [--only=reels|posts]
//
// Reels use the v2 timeline renderer: cold open → hook → 3 beats → invert
// punch → CTA, ~18s, masked/stepped reveals only (text never fades), hard
// cuts, silent audio with a licensed Instagram track attached at publish.
// Every frame passes the pixel gate before a single frame is rendered.
//
// Feed posts use the proven v1 slide templates, whose on-image text is
// pulled verbatim from the published posts.
//
// Also requeues the Naval quote that failed on 2026-07-26 with Graph 9007
// (publishImage was missing the container wait — fixed in instagram.mjs).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { loadQueue, saveQueue } from './lib/social/select.mjs';
import { fontCss, renderSlides } from './lib/social/render.mjs';
import { buildCarousel, buildQuoteCard, buildLessonsCarousel } from './lib/social/templates.mjs';
import { buildReelHtml, REEL } from './lib/social/reel-v2.mjs';
import { renderFrames } from './lib/social/frames.mjs';
import { verifyReel } from './lib/social/verify-reel.mjs';
import { encodeFrames, probe } from './lib/social/video.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.SOCIAL_PUBLIC_BASE || 'https://hesketon.co.il').replace(/\/$/, '');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || 'all';
const FPS = 30;

const posts = loadPublishedPosts(path.join(ROOT, 'src/content/posts'));
const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
const need = (s) => { if (!bySlug[s]) throw new Error(`missing post: ${s}`); return bySlug[s]; };

const at = (day, hhmmZ) => `2026-08-${String(day).padStart(2, '0')}T${hhmmZ}:00.000Z`;
const cleanTag = (t) => '#' + String(t).replace(/[\s'"׳״’‘`.]+/g, '');

// Shared 18.4s shape. Every reel uses it, so the feed has a recognisable rhythm.
const timeline = (sc) => {
  const marks = [[0, 1.5], [1.5, 5.2], [5.2, 8.3], [8.3, 11.6], [11.6, 14.4], [14.4, 16.1], [16.1, 18.4]];
  return sc.map((s, i) => ({ ...s, in: marks[i][0], out: marks[i][1] }));
};

// ── 7 reels ─────────────────────────────────────────────────
// Lines are trimmed from each post's אמ;לק / takeaways for screen; the
// meaning is never restated. `key` marks the word that carries the beat.
const REELS = [
  {
    day: 2, slug: 'mrbeast-joe-rogan-possible-time-and-money', kicker: 'אמ;לק',
    scenes: [
      { type: 'type', text: 'מתי מותר להגיד "בלתי אפשרי"?', bare: true, progress: false },
      { type: 'line', text: 'כמעט הכול אפשרי, אם אתם מוכנים להשקיע את הזמן ואת הכסף.' },
      { type: 'mark', text: 'אסור לומר בלתי אפשרי לפני שתמחרו את זה בזמן ובכסף.', key: 'שתמחרו' },
      { type: 'pop', text: 'מבחן הדופק: אם הדופק עולה כשאתם מספרים על רעיון — הוא טוב.', key: 'הדופק' },
      { type: 'line', text: 'יוצרים רבים נעצרים בדיוק כשהם מתחילים להרוויח.' },
      { type: 'line', text: 'ההתנגדות היחידה שמותרת: לא שווה את זה.', invert: true },
      { type: 'cta' },
    ],
    caption: `"כמעט הכול אפשרי, אם אתם מוכנים להשקיע את הזמן ואת הכסף." 🎯

מיסטרביסט אצל ג'ו רוגן — על הכלל שהוא כופה על הצוות: אסור לומר "בלתי אפשרי" לפני שתמחרתם את זה בזמן ובכסף.

ההתנגדות היחידה שמותרת היא "לא שווה את זה".

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מיסטרביסט', 'גורוגן', 'יצירתתוכן', 'יזמות', 'מיינדסט', 'עסקים'],
    audioId: '1621000558910293',
  },
  {
    day: 3, slug: 'james-clear-habits-getting-started-huberman', kicker: 'אמ;לק',
    scenes: [
      { type: 'type', text: 'מה הכי כבד בחדר הכושר?', bare: true, progress: false },
      { type: 'line', text: 'המשקל הכבד ביותר בחדר הכושר הוא דלת הכניסה.' },
      { type: 'mark', text: 'כמעט כל בעיית הרגלים מסתכמת באמנות ההתחלה.', key: 'ההתחלה' },
      { type: 'pop', text: 'ארבעת החוקים: ברור, מושך, קל ומספק.', key: 'ברור' },
      { type: 'line', text: 'ביום רע עשו את הגרסה הקצרה. אל תרשמו אפס.' },
      { type: 'line', text: 'אל תשאלו מה אני רוצה להשיג — אלא מי אני רוצה להיות.', invert: true },
      { type: 'cta' },
    ],
    caption: `"המשקל הכבד ביותר בחדר הכושר הוא דלת הכניסה." 🚪

ג'יימס קליר — מחבר "הרגלים אטומיים" — אצל אנדרו הוברמן, על למה כמעט כל בעיית הרגלים היא בעצם בעיה של התחלה.

ביום רע: עשו את הגרסה הקצרה. רק אל תרשמו אפס.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'גיימסקליר', 'הרגליםאטומיים', 'הוברמן', 'הרגלים', 'מיינדסט', 'משמעת'],
    audioId: '9513789255356881',
  },
  {
    day: 4, slug: 'demis-hassabis-agi-world-models-deepmind', kicker: 'אמ;לק',
    scenes: [
      { type: 'type', text: 'מה מפריד AI מבינה כללית?', bare: true, progress: false },
      { type: 'line', text: 'אותם מודלים זוכים במדליית זהב — ונכשלים בתרגיל לוגי פשוט.' },
      { type: 'mark', text: 'חוסר העקביות, לא חוסר היכולת, הוא מה שמפריד.', key: 'העקביות' },
      { type: 'pop', text: 'הזיות נובעות מכך שהמודל עונה כשהיה צריך לסרב.', key: 'לסרב' },
      { type: 'line', text: 'המהפכה התעשייתית לקחה מאה שנה. זו תהיה גדולה פי עשרה.' },
      { type: 'line', text: 'אין קיר בסקיילינג — אבל גם אין הכפלה בכל גרסה.', invert: true },
      { type: 'cta' },
    ],
    caption: `אותם מודלים זוכים במדליית זהב באולימפיאדת המתמטיקה — ונכשלים בתרגיל לוגי פשוט. 🤖

דמיס הסביס, מנכ"ל Google DeepMind, על מה שבאמת מפריד את ה-AI של היום מבינה כללית: לא היכולת, אלא העקביות.

וגם: למה הזיה היא בעצם כישלון בסירוב.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'דמיסהסביס', 'דיפמיינד', 'בינהמלאכותית', 'AGI', 'טכנולוגיה', 'מדע'],
    audioId: '627735556288874',
  },
  {
    day: 5, slug: 'rick-rubin-creativity-huberman', kicker: 'אמ;לק',
    scenes: [
      { type: 'type', text: 'איך יודעים אם משהו טוב?', bare: true, progress: false },
      { type: 'line', text: 'איזו מהשתיים אתם אוהבים יותר? זו רוב היצירתיות.' },
      { type: 'mark', text: 'יצירה לא מתחילה ברעיון אלא בהבחנה.', key: 'בהבחנה' },
      { type: 'pop', text: 'במקום להסביר מה לא עובד — הציעו משהו שאפשר לנסות.', key: 'לנסות' },
      { type: 'line', text: 'ספק עצמי אינו אויב אלא בקרה.' },
      { type: 'line', text: 'אספו בלי מטרה. זה מה שממלא את המאגר.', invert: true },
      { type: 'cta' },
    ],
    caption: `"איזו מהשתיים אתם אוהבים יותר?" — לפי ריק רובין, זו רוב היצירתיות. 🎛️

המפיק שמאחורי חלק מהאלבומים הגדולים בהיסטוריה, אצל אנדרו הוברמן: יצירה לא מתחילה ברעיון אלא בהבחנה.

והשאלה "איך זה יתפקד ברשתות"? זה עיסוק אחר לגמרי.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'ריקרובין', 'הוברמן', 'יצירתיות', 'מוזיקה', 'אמנות', 'מיינדסט'],
    audioId: '692868096200013',
  },
  {
    day: 6, slug: 'andrew-huberman-neuroplasticity-focus-rich-roll', kicker: 'אמ;לק',
    scenes: [
      { type: 'type', text: 'מתי המוח באמת משתנה?', bare: true, progress: false },
      { type: 'line', text: 'נוירופלסטיות מופעלת במיקוד עז — אבל מתרחשת בשינה עמוקה.' },
      { type: 'mark', text: 'מיקוד משחרר אצטילכולין שמסמן את הנוירונים לשינוי.', key: 'אצטילכולין' },
      { type: 'pop', text: 'התסיסה בהתחלה אינה כישלון — היא השער שחייבים לעבור.', key: 'השער' },
      { type: 'line', text: 'דופמין אינו פרס על היעד. הוא משתחרר בכל אבן-דרך.' },
      { type: 'line', text: 'מיקוד מסמן. מנוחה משנה.', invert: true },
      { type: 'cta' },
    ],
    caption: `נוירופלסטיות מופעלת על ידי מיקוד עז — אבל מתרחשת בזמן שינה עמוקה. 🧠

פרופ' אנדרו הוברמן אצל ריץ' רול, על איך המוח באמת משתנה אחרי גיל 25 — ולמה התסיסה והבלבול בהתחלה הם השער, לא הכישלון.

שמרו לעצמכם 💾 והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'הוברמן', 'נוירופלסטיות', 'ריצרול', 'מוח', 'למידה', 'מיקוד'],
    audioId: '1301427616977145',
  },
  {
    day: 7, slug: 'ray-dalio-decline-smart-rabbit-bartlett', kicker: 'אמ;לק',
    scenes: [
      { type: 'type', text: 'כמה מחילות יש לארנב חכם?', bare: true, progress: false },
      { type: 'line', text: 'לארנב חכם יש שלוש מחילות.' },
      { type: 'mark', text: 'שמרו על גמישות — נכס נעול עלול לקרקע אתכם.', key: 'גמישות' },
      { type: 'pop', text: 'להמלצה על ארה"ב ליזמות אין קשר למסים — אלא לתרבות.', key: 'לתרבות' },
      { type: 'line', text: 'מעבר לרמה בסיסית, אין קשר בין כסף לרווחה.' },
      { type: 'line', text: 'מה שמנבא אושר בכל המחקרים? קהילה.', invert: true },
      { type: 'cta' },
    ],
    caption: `"לארנב חכם יש שלוש מחילות." 🐇

ריי דליו אצל סטיבן בארטלט — קודר לגבי בריטניה ולגבי ארה"ב, אבל השאלה שהוא חוזר אליה היא לא "מה יקרה" אלא "איך אתם כפרט מתמודדים".

ומה מנבא אושר בכל המחקרים? לא הכנסה — קהילה.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'רייידליו', 'כסף', 'השקעות', 'כלכלה', 'גיאופוליטיקה', 'אושר'],
    audioId: '974432747187721',
  },
  {
    day: 8, slug: 'creatine-dosing-myths-candow', kicker: 'אמ;לק',
    scenes: [
      { type: 'type', text: 'כמה קריאטין באמת צריך?', bare: true, progress: false },
      { type: 'stat', value: '3–5', text: 'גרם ליום לשריר — אבל אין מינון אחד נכון.' },
      { type: 'mark', text: 'החששות סביב כליות, מים ושיער אינם נתמכים היטב במחקר.', key: 'במחקר' },
      { type: 'pop', text: 'למוח בדחק — מינון גבוה יותר. ככל שהלחץ גדול, המינון עולה.', key: 'בדחק' },
      { type: 'line', text: 'לעצם — רק בשילוב אימון.' },
      { type: 'line', text: 'מוח בריא כנראה לא זקוק לקריאטין בכלל.', invert: true },
      { type: 'cta' },
    ],
    caption: `"מוח בריא כנראה לא זקוק לקריאטין בכלל. אבל מוח בלחץ — כן." 💊

ד"ר דארן קנדו אצל סטיבן בארטלט, מפרק את המיתוסים סביב קריאטין: כליות, מים, שיער — ומה המחקר באמת מראה.

ואין מינון אחד נכון. יש סולם.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'קריאטין', 'תוספים', 'בריאות', 'כושר', 'מדע', 'תזונה'],
    audioId: '872667339759392',
  },
];

// ── 7 feed posts ────────────────────────────────────────────
const POSTS = [
  {
    day: 2, slug: 'naval-ravikant-44-harsh-truths-modern-wisdom', format: 'quote', kicker: 'ציטוט',
    // Re-run of the item that failed on 26.7 (Graph 9007). Assets already
    // rendered and deployed, so this reuses them rather than re-rendering.
    reuseAssets: ['https://hesketon.co.il/social/2026-07-26_quote-naval-ravikant-44-harsh-/naval-ravikant-44-harsh-truths-modern-wisdom-01-quote.png'],
    caption: `"לא לרצות משהו שווה ערך לכך שכבר יש לך אותו." 🧘

נאבל רביקאנט אצל Modern Wisdom, בשיחה על 44 אמיתות על החיים — על סיפוק, שאפתנות, וההבדל בין להשיג לבין לרצות.

לפעמים הדרך הקצרה לשלווה היא פשוט להפסיק לרדוף.

התקציר המלא בבלוג. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'נאבלרביקאנט', 'מיינדסט', 'פילוסופיה', 'שלווה', 'חוכמתחיים', 'פסיכולוגיה'],
  },
  {
    day: 3, slug: 'sam-altman-agi-compute-human-agency', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `סם אלטמן על מה שבאמת משתנה כשהמחשוב מפסיק להיות המחסום. 🤖

מנכ"ל OpenAI על AGI, על מה שנשאר אנושי, ועל השאלה שהוא חוזר אליה: מה קורה לתחושת המסוגלות שלנו.

החליקו את הקרוסלה, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'סםאלטמן', 'OpenAI', 'בינהמלאכותית', 'AGI', 'טכנולוגיה', 'עתיד'],
  },
  {
    day: 4, slug: 'andrew-huberman-peptides-training-tim-ferriss', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `פפטידים, אימון והתאוששות — בלי הרעש. 💪

פרופ' אנדרו הוברמן אצל טים פריס, על מה שבאמת יש לו בסיס ומה עדיין בגדר ניסוי.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'הוברמן', 'טיםפריס', 'פפטידים', 'אימון', 'בריאות', 'התאוששות'],
  },
  {
    day: 5, slug: 'michael-saylor-inflation-scalar-lex-fridman', format: 'quote', kicker: 'ציטוט',
    caption: `מייקל סיילור על אינפלציה — ולמה הוא חושב שאנחנו מודדים אותה לא נכון. 📉

בשיחה עם לקס פרידמן, על כסף, זמן, ועל מה שקורה לחיסכון כשהמדד שאתם סומכים עליו הוא לא המדד הנכון.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'מייקלסיילור', 'לקספרידמן', 'אינפלציה', 'כסף', 'השקעות', 'כלכלה'],
  },
  {
    day: 6, slug: 'seth-godin-this-is-strategy-tim-ferriss', format: 'carousel', kicker: 'תקציר מזוקק',
    caption: `סת' גודין: אסטרטגיה היא לא תוכנית. 🎯

אצל טים פריס, גודין מפרק מחדש מילה שכולם משתמשים בה ומעטים מגדירים — ומסביר למה רוב מה שאנחנו קוראים לו אסטרטגיה הוא בעצם טקטיקה.

החליקו, שמרו 💾 — התקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'סתגודין', 'טיםפריס', 'אסטרטגיה', 'עסקים', 'שיווק', 'קריירה'],
  },
  {
    day: 7, slug: 'lower-back-pain-mcgill', format: 'lessons', kicker: '3 דברים שלמדנו',
    caption: `"אין דבר כזה כאב גב 'לא-ספציפי'. תמיד יש מנגנון." 🦴

פרופ' סטיוארט מקגיל אצל פיטר אטיה — אחד החוקרים הגדולים בעולם של עמוד השדרה, על מה שבאמת גורם לכאב גב ומה עושים איתו.

3 דברים שלמדנו, בקרוסלה 👇

שמרו לעצמכם, והתקציר המלא באתר. קישור בביו.`,
    hashtags: ['הסכתון', 'פודקאסט', 'מקגיל', 'כאבגב', 'פיטראטיה', 'בריאות', 'עמודשדרה', 'אימון'],
  },
  {
    day: 8, slug: 'neil-degrasse-tyson-aliens-whistleblowers', format: 'quote', kicker: 'ציטוט',
    caption: `"אם אתם טוענים שיש לכם חייזר בסככה שבחצר — פשוט תוציאו אותו החוצה." 👽

ניל דה-גראס טייסון אצל סטיבן בארטלט, על עדויות, על ראיות, ועל ההבדל ביניהן.

שיעור בחשיבה ביקורתית שמתחפש לשיחה על חייזרים.

התקציר המלא באתר. קישור בביו 🔗`,
    hashtags: ['הסכתון', 'פודקאסט', 'נילדהגראסטייסון', 'חייזרים', 'מדע', 'חשיבהביקורתית', 'אסטרונומיה', 'יופו'],
  },
];

// ── build ───────────────────────────────────────────────────
const queueFile = path.join(ROOT, 'social-queue.yml');
const queue = loadQueue(queueFile);
const outRoot = path.join(ROOT, 'public/social');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hesketon-week-'));
const css = fontCss();

if (only === 'all' || only === 'reels') {
  for (const r of REELS) {
    const post = need(r.slug);
    const id = `2026-08-${String(r.day).padStart(2, '0')}_reelv2-${r.slug.slice(0, 22)}`;
    const sb = { total: 18.4, kicker: r.kicker, scenes: timeline(r.scenes) };
    const html = buildReelHtml(post, sb, css);

    const { samples, violations } = await verifyReel(html, {
      duration: sb.total, step: 0.25, width: REEL.width, height: REEL.height,
    });
    if (violations.length) {
      console.log(`\n❌ ${id} — ${violations.length}/${samples} frames out of spec:`);
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
      outMp4: path.join(outDir, `${r.slug}-reel.mp4`),
      coverJpg: path.join(outDir, `${r.slug}-cover.jpg`),
      coverAt: 2.8,
    });
    const info = await probe(out.file);

    queue.items.push({
      id, slug: r.slug, platform: 'instagram', format: 'reel', kicker: 'ריל',
      scheduledFor: at(r.day, '10:00'),
      status: 'approved',
      caption: r.caption,
      hashtags: r.hashtags.map(cleanTag),
      assets: [`${BASE}/social/${id}/${path.basename(out.file)}`],
      cover: `${BASE}/social/${id}/${path.basename(out.cover)}`,
      audio: { audioId: r.audioId, audioVolume: 100, videoVolume: 0 },
      permalink: '',
    });
    console.log(`🎬 ${id} · ${info.duration}s · ${info.sizeMB}MB · gate ${samples} clean`);
  }
}

if (only === 'all' || only === 'posts') {
  for (const p of POSTS) {
    const post = need(p.slug);
    const id = `2026-08-${String(p.day).padStart(2, '0')}_${p.format}-${p.slug.slice(0, 22)}`;
    let assets = p.reuseAssets;

    if (!assets) {
      const slides = p.format === 'carousel' ? buildCarousel(post, { kicker: p.kicker })
        : p.format === 'lessons' ? buildLessonsCarousel(post, { kicker: p.kicker })
          : buildQuoteCard(post, { kicker: p.kicker });
      const files = await renderSlides(slides, path.join(outRoot, id), p.slug);
      assets = files.map((f) => `${BASE}/social/${id}/${path.basename(f)}`);
    }

    queue.items.push({
      id, slug: p.slug, platform: 'instagram', format: p.format, kicker: p.kicker,
      scheduledFor: at(p.day, '17:00'),
      status: 'approved',
      caption: p.caption,
      hashtags: p.hashtags.map(cleanTag),
      assets,
      permalink: '',
    });
    console.log(`🖼  ${id} · ${assets.length} asset(s)${p.reuseAssets ? ' (reused — was the 26.7 failure)' : ''}`);
  }
}

fs.rmSync(scratch, { recursive: true, force: true });
saveQueue(queueFile, queue);
console.log('\n✅ queue updated');
