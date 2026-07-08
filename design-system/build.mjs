// ============================================================
//  Design-system bundle generator — "Frequency" (הסכתון)
//
//  Emits self-contained preview cards (HTML) into design-system/cards/
//  for syncing to a claude.ai/design project via DesignSync.
//  Each card's first line is the `@dsCard` marker the Design pane indexes.
//
//  Source of truth: src/styles/global.css. Re-run after token changes:
//    node design-system/build.mjs
// ============================================================

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cards');

// ---------- shared foundation (tokens + component CSS from global.css) ----------
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@500;700;900&family=Heebo:wght@400;500;700&family=Space+Mono:wght@700&display=swap">`;

const TOKENS = `
:root{
  --accent:#d6336c; --accent-ink:#a61e4d; --accent-soft:#fbe0ea;
  --bg:#faf8f3; --surface:#ffffff; --ink:#1a1722; --ink-soft:#46424f;
  --muted:#5f5b68; --line:#e8e3da;
  --font-display:'Rubik',system-ui,sans-serif;
  --font-body:'Heebo',system-ui,sans-serif;
  --font-mono:'Space Mono',ui-monospace,monospace;
  --measure:42rem; --wide:71rem; --radius:16px; --radius-sm:10px; --speed:200ms;
}
.dark{
  --accent:#f06595; --accent-ink:#ffa8c5; --accent-soft:#2c1a24;
  --bg:#15131c; --surface:#1e1b28; --ink:#edeaf2; --ink-soft:#c6c1d2;
  --muted:#9893a6; --line:#2d2a38;
}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:var(--font-body);background:var(--bg);color:var(--ink);
  font-size:1.0625rem;line-height:1.8;padding:2rem;-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{font-family:var(--font-display);font-weight:700;line-height:1.15;color:var(--ink);
  margin:0 0 .5em;letter-spacing:-.02em}
h1{font-weight:900;font-size:clamp(2.1rem,1.3rem + 3.4vw,3.5rem)}
h2{font-size:clamp(1.5rem,1.15rem + 1.5vw,2rem)} h3{font-size:1.35rem}
p{margin:0 0 1.25rem}
a{color:var(--accent-ink);text-decoration-thickness:1.5px;text-underline-offset:3px}
.muted{color:var(--muted)}
.eyebrow{font-family:var(--font-display);font-size:.82rem;font-weight:700;color:var(--accent-ink);
  margin:0 0 .6rem;display:inline-flex;align-items:center;gap:.5rem}
.eyebrow::before{content:'';width:1.4rem;height:2px;background:var(--accent);border-radius:2px}
`;

const COMPONENTS = `
/* signature */
.compress{display:inline-flex;align-items:center;gap:.5rem;font-family:var(--font-mono);
  font-size:.74rem;font-weight:700;color:var(--muted);letter-spacing:-.02em;white-space:nowrap;
  direction:ltr;unicode-bidi:isolate}
.compress .arrow{color:var(--accent)}
.wave{display:inline-flex;align-items:center;gap:2px;height:16px}
.wave span{width:2.5px;background:var(--accent);border-radius:2px;opacity:.9}
/* buttons */
.btn{display:inline-block;font-family:var(--font-display);font-weight:700;font-size:.96rem;
  background:var(--accent);color:#fff;padding:.62rem 1.3rem;border-radius:999px;text-decoration:none;
  cursor:pointer;border:0;transition:background var(--speed) ease}
.btn:hover{background:var(--accent-ink)}
.btn--ghost{background:transparent;color:var(--accent-ink);
  border:1.5px solid color-mix(in srgb,var(--accent) 55%,transparent)}
.btn--ghost:hover{background:var(--accent-soft)}
/* chips & tags */
.chip{display:inline-block;font-family:var(--font-display);font-size:.74rem;font-weight:700;
  color:var(--accent-ink);background:var(--accent-soft);padding:.22rem .7rem;border-radius:999px;
  text-decoration:none;line-height:1.7}
.tag{display:inline-block;font-size:.85rem;color:var(--muted);border:1px solid var(--line);
  padding:.18rem .65rem;border-radius:999px;text-decoration:none}
.premium-tag{display:inline-flex;align-items:center;gap:.3rem;font-family:var(--font-display);
  font-weight:700;font-size:.72rem;color:var(--bg);background:var(--ink);padding:.2rem .62rem;
  border-radius:999px;vertical-align:middle}
mark{background:color-mix(in srgb,var(--accent) 20%,transparent);color:inherit;
  padding:.05em .22em;border-radius:4px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
/* card */
.post-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,20.5rem),1fr));gap:1.5rem}
.card{position:relative;display:flex;flex-direction:column;gap:.7rem;background:var(--surface);
  border:1px solid var(--line);border-radius:var(--radius);padding:1.4rem 1.45rem 1.5rem;
  transition:transform var(--speed) ease,border-color var(--speed) ease}
.card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
.card__media{margin:-1.4rem -1.45rem 0;aspect-ratio:16/9;overflow:hidden;
  border-radius:var(--radius) var(--radius) 0 0;background:var(--accent-soft)}
.card__media .ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,var(--accent-soft),color-mix(in srgb,var(--accent) 35%,var(--accent-soft)));
  color:var(--accent-ink);font-family:var(--font-display);font-weight:900;font-size:1.4rem}
.card__top{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap}
.card__title{font-size:1.42rem;line-height:1.2;margin:0}
.card__title a{color:var(--ink);text-decoration:none}
.card__desc{color:var(--muted);margin:0;font-size:.98rem;line-height:1.7}
.card__meta{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;font-size:.85rem;
  color:var(--muted);margin-top:auto;padding-top:.5rem}
.dot::before{content:'·';margin-inline:.15rem}
/* editorial */
blockquote.pull--lead{border:0;background:transparent;padding:0;margin:0 0 1.7rem;
  font-family:var(--font-display);font-weight:700;font-size:clamp(1.45rem,1.1rem + 1.6vw,2.05rem);
  line-height:1.32;color:var(--ink)}
blockquote.pull--lead cite{display:block;margin-top:.7rem;font-family:var(--font-body);
  font-style:normal;font-weight:500;font-size:1rem;color:var(--accent-ink)}
.tldr{margin:0 0 1.5rem;padding:1.25rem 1.5rem 1.35rem;background:var(--accent-soft);
  border:1px solid color-mix(in srgb,var(--accent) 28%,var(--line));border-radius:var(--radius)}
.tldr__label{display:flex;align-items:center;gap:.5rem;font-family:var(--font-display);
  font-weight:700;font-size:.82rem;color:var(--accent-ink);margin:0 0 .7rem}
.tldr ul{margin:0;padding-inline-start:1.2rem}
.tldr li{margin-bottom:.45rem;font-size:1.02rem;line-height:1.6}
.tldr li::marker{color:var(--accent)}
blockquote.body-quote{margin:1.5rem 0;padding:.5rem 1.3rem;border-inline-start:3px solid var(--accent);
  background:var(--accent-soft);color:var(--ink);font-family:var(--font-display);font-weight:500;
  font-size:1.18rem;line-height:1.6}
.source-box{margin:0;padding:1.25rem 1.4rem;background:var(--surface);border:1px solid var(--line);
  border-radius:var(--radius);font-size:.96rem;line-height:1.7}
/* newsletter */
.nl-form{display:flex;gap:.5rem}
.nl-form__input{flex:1;min-width:0;padding:.7rem .9rem;border:1px solid var(--line);
  border-radius:10px;background:var(--bg);font:inherit;color:var(--ink)}
.nl-form__btn{padding:.7rem 1.3rem;border:none;border-radius:10px;background:var(--accent-ink);
  color:#fff;font:inherit;font-weight:600;cursor:pointer;white-space:nowrap}
.newsletter{padding:1.6rem 1.8rem;border:1px solid var(--line);border-radius:14px;
  background:var(--accent-soft);display:flex;flex-wrap:wrap;align-items:center;
  justify-content:space-between;gap:1.2rem}
.newsletter__heading{font-family:var(--font-display);font-weight:700;font-size:1.15rem;margin:0 0 .25rem}
.newsletter__subtext{margin:0;font-size:.9rem;color:var(--muted)}
.newsletter .nl-form{flex:1 1 280px;max-width:420px}
.nl-slidein{position:relative;width:min(21.5rem,100%);padding:1.15rem 1.2rem 1.2rem;
  background:var(--surface);border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line));
  border-radius:var(--radius);box-shadow:0 10px 32px rgba(0,0,0,.18)}
.nl-slidein__close{position:absolute;top:.4rem;inset-inline-end:.55rem;border:0;background:transparent;
  color:var(--muted);font-size:1.35rem;line-height:1;cursor:pointer;padding:.25rem}
.nl-slidein__heading{font-family:var(--font-display);font-weight:900;font-size:1.1rem;margin:0 0 .2rem}
.nl-slidein__sub{margin:0 0 .8rem;font-size:.88rem;color:var(--muted)}
.nl-slidein .nl-form{flex-direction:column;gap:.55rem}
/* header */
.site-header{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 86%,transparent)}
.site-header__inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;
  padding:.85rem 1.4rem}
.brand{display:inline-flex;align-items:center;gap:.6rem;font-family:var(--font-display);
  font-weight:900;font-size:1.5rem;letter-spacing:-.03em;color:var(--ink);text-decoration:none}
.brand .wave{height:22px}.brand .wave span{width:3px}
.nav{display:flex;align-items:center;gap:1.3rem;flex-wrap:wrap}
.nav a{color:var(--ink-soft);text-decoration:none;font-size:.98rem;font-weight:500}
.nav a[aria-current='page']{color:var(--accent-ink)}
/* read-next */
.readnext__hero{display:block;overflow:hidden;background:var(--surface);
  border:1px solid color-mix(in srgb,var(--accent) 30%,var(--line));border-radius:var(--radius);
  text-decoration:none;color:inherit;max-width:34rem}
.readnext__body{display:block;padding:1.25rem 1.4rem 1.4rem}
.readnext__row{display:flex;align-items:center;justify-content:space-between;gap:.75rem;
  flex-wrap:wrap;margin-bottom:.7rem}
.readnext__title{display:block;font-family:var(--font-display);font-weight:900;font-size:1.4rem;
  line-height:1.2;color:var(--ink);margin-bottom:.5rem}
.readnext__desc{display:block;color:var(--muted);font-size:.98rem;line-height:1.6;margin-bottom:.85rem}
.readnext__cta{display:inline-block;font-family:var(--font-display);font-weight:700;
  font-size:.95rem;color:var(--accent-ink)}
.readnext__more{display:grid;grid-template-columns:1fr 1fr;gap:.9rem;margin-top:.9rem;max-width:34rem}
.readnext__item{display:flex;flex-direction:column;gap:.35rem;padding:.9rem 1rem;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);text-decoration:none}
.readnext__item-cat{font-family:var(--font-display);font-weight:700;font-size:.72rem;color:var(--accent-ink)}
.readnext__item-title{font-family:var(--font-display);font-weight:700;font-size:1rem;
  line-height:1.3;color:var(--ink)}
`;

const WAVE = (n = 18) =>
  `<span class="wave" aria-hidden="true">${Array.from({ length: n }, () => `<span style="height:${4 + Math.round(Math.random() * 12)}px"></span>`).join('')}</span>`;

function page({ group, name, subtitle, body, width = 760, height }) {
  const vp = height ? `width="${width}" height="${height}"` : `width="${width}"`;
  return `<!-- @dsCard group="${group}" name="${name}"${subtitle ? ` subtitle="${subtitle}"` : ''} ${vp} -->
<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} · הסכתון Frequency</title>${FONTS}
<style>${TOKENS}${COMPONENTS}</style></head>
<body>${body}</body></html>`;
}

// ---------- cards ----------
const cards = {};

cards['foundations/colors.html'] = page({
  group: 'Foundations',
  name: 'צבעים — Frequency',
  subtitle: 'פטל אחד נועז, כל השאר ממושמע · בהיר + כהה',
  width: 860,
  body: `
<h2 style="margin-bottom:1rem">צבעי המערכת</h2>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr));gap:.9rem">
${[
  ['--accent', '#d6336c', 'Accent · פטל'],
  ['--accent-ink', '#a61e4d', 'Accent ink · טקסט/לינקים'],
  ['--accent-soft', '#fbe0ea', 'Accent soft · שטיפות'],
  ['--bg', '#faf8f3', 'Background · שנהב חם'],
  ['--surface', '#ffffff', 'Surface · כרטיסים'],
  ['--ink', '#1a1722', 'Ink · אינדיגו-שחור'],
  ['--ink-soft', '#46424f', 'Ink soft'],
  ['--muted', '#5f5b68', 'Muted · AA על הרקע'],
  ['--line', '#e8e3da', 'Line · גבולות'],
]
  .map(
    ([v, hex, label]) => `<div style="border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface)">
  <div style="height:64px;background:var(${v})"></div>
  <div style="padding:.5rem .7rem;font-size:.78rem;line-height:1.5"><strong style="font-family:var(--font-display)">${label}</strong><br>
  <span class="muted" style="font-family:var(--font-mono);font-size:.7rem;direction:ltr;unicode-bidi:isolate">${v} · ${hex}</span></div></div>`,
  )
  .join('')}
</div>
<div class="dark" style="margin-top:1.5rem;background:var(--bg);border-radius:var(--radius);padding:1.3rem 1.5rem;border:1px solid var(--line)">
  <p style="color:var(--ink);font-family:var(--font-display);font-weight:700;margin:0 0 .5rem">מצב כהה (אוטומטי לפי המכשיר)</p>
  <p style="color:var(--muted);margin:0 0 1rem;font-size:.9rem">accent ‎#f06595 · bg ‎#15131c · surface ‎#1e1b28 · ink ‎#edeaf2</p>
  <span class="chip">בריאות וכושר</span> <a class="btn" href="#">הרשמה</a> <a class="btn btn--ghost" href="#" style="margin-inline-start:.4rem">לכל הפרקים</a>
</div>`,
});

cards['foundations/type.html'] = page({
  group: 'Foundations',
  name: 'טיפוגרפיה',
  subtitle: 'Rubik (תצוגה) · Heebo (גוף) · Space Mono (דאטה)',
  width: 820,
  body: `
<p class="eyebrow">Rubik · תצוגה</p>
<h1 style="margin-bottom:.3em">כל מה שחשוב מהפודקאסטים <span style="color:var(--accent-ink)">הכי טובים.</span></h1>
<h2>כותרת משנה H2 — Rubik 700</h2>
<h3>כותרת H3 — Rubik 700</h3>
<hr style="border:none;border-top:1px solid var(--line);margin:1.6rem 0">
<p class="eyebrow">Heebo · גוף</p>
<p style="max-width:38rem">גוף הטקסט נכתב ב-Heebo 400 בגובה שורה 1.8 — עברית נעימה לקריאה ארוכה.
<strong>הדגשות ב-700</strong>, <a href="#">קישורים בפטל-דיו</a>, ו<mark>סימון מרקר</mark> לרעיונות ששווה לזכור.</p>
<p class="muted" style="font-size:.92rem">טקסט משני muted — עומד ב-AA על הרקע.</p>
<hr style="border:none;border-top:1px solid var(--line);margin:1.6rem 0">
<p class="eyebrow">Space Mono · דאטה</p>
<p class="compress" style="font-size:1rem">02:14:00 <span class="arrow">⟶</span> 6′</p>
<p class="muted" style="font-size:.85rem;margin-top:.4rem">חתימת הדחיסה: שעות של אודיו ⟵ דקות של קריאה. תמיד LTR, תמיד מונו.</p>`,
});

cards['foundations/signature.html'] = page({
  group: 'Foundations',
  name: 'החתימה — גל + דחיסה',
  subtitle: 'ה-waveform וסטטיסטיקת האודיו⟵קריאה',
  width: 700,
  body: `
<div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:1.6rem;max-width:26rem">
  <div style="display:flex;align-items:flex-end;gap:4px;height:96px;margin-bottom:1rem">
    ${[30, 55, 80, 45, 95, 60, 40, 75, 100, 50, 70, 35, 85, 55, 90, 42, 65, 30, 78, 52].map((h) => `<span style="flex:1;background:linear-gradient(var(--accent),color-mix(in srgb,var(--accent) 45%,transparent));border-radius:3px;opacity:.85;height:${h}%"></span>`).join('')}
  </div>
  <p class="compress" style="justify-content:center;display:flex;font-size:.88rem">02:14:00 <span class="arrow">⟶</span> 6′</p>
  <p class="muted" style="text-align:center;margin:0;font-size:.88rem">מהאוזניים לעיניים</p>
</div>
<p style="margin-top:1.4rem">מיני-גל למותג: ${WAVE()} <strong style="font-family:var(--font-display);font-weight:900;font-size:1.3rem;margin-inline-start:.4rem">הסכתון</strong></p>
<p class="muted" style="font-size:.9rem;max-width:34rem">האלמנט המזהה של המותג — מופיע בלוגו, בכרטיסי הרשתות, בעמוד הבית ובדף התודה. פסים ורודים ברוחב 2.5–5px, קצוות מעוגלים.</p>`,
});

cards['components/buttons.html'] = page({
  group: 'Components',
  name: 'כפתורים',
  subtitle: 'ראשי / רפאים / טופס',
  width: 640,
  body: `
<h3>ראשי</h3>
<p><a class="btn" href="#">קראו את המומלץ</a></p>
<h3>רפאים (משני)</h3>
<p><a class="btn btn--ghost" href="#">לכל הפרקים</a></p>
<h3>כפתור טופס (ניוזלטר)</h3>
<div class="nl-form" style="max-width:24rem"><input class="nl-form__input" type="email" placeholder="כתובת אימייל"><button class="nl-form__btn">הרשמה</button></div>
<p class="muted" style="font-size:.85rem;margin-top:1rem">פינות: btn עגול מלא (999px) · form 10px. hover: ראשי מכהה ל-accent-ink; רפאים מקבל רקע soft.</p>`,
});

cards['components/chips.html'] = page({
  group: 'Components',
  name: "צ'יפים, תגיות וסימונים",
  subtitle: 'קטגוריה / תגית / פרימיום / מרקר / מטא',
  width: 640,
  body: `
<h3>צ'יפ קטגוריה</h3>
<p><span class="chip">בריאות וכושר</span> <span class="chip">פסיכולוגיה ומיינדסט</span> <span class="chip">פוליטיקה ואקטואליה</span></p>
<h3>תגיות</h3>
<p><a class="tag" href="#">#תנועה</a> <a class="tag" href="#">#אריכות־חיים</a> <a class="tag" href="#">#פוטין</a></p>
<h3>פרימיום</h3>
<p><span class="premium-tag">✦ פרימיום</span></p>
<h3>מרקר "כדאי לזכור"</h3>
<p style="max-width:32rem">ההזדקנות, לפי סינקלייר, היא <mark>משבר זהות של התאים</mark> — לא בלאי.</p>
<h3>שורת מטא</h3>
<p class="muted" style="font-size:.92rem;display:flex;align-items:center;gap:.55rem;flex-wrap:wrap">
<span class="compress">01:14:00 <span class="arrow">⟶</span> 10′</span>
<span>2 ביולי 2026</span><span class="dot">מתוך «Huberman Lab»</span></p>`,
});

cards['components/post-card.html'] = page({
  group: 'Components',
  name: 'כרטיס פוסט',
  subtitle: 'תמונת פרק + צ׳יפ + דחיסה + מטא',
  width: 420,
  body: `
<article class="card" style="max-width:22rem">
  <div class="card__media"><div class="ph">▶ תמונת הפרק</div></div>
  <div class="card__top">
    <span class="chip">בריאות וכושר</span>
    <span class="compress">02:59:00 <span class="arrow">⟶</span> 12′</span>
  </div>
  <h2 class="card__title"><a href="#">עידו פורטל אצל הוברמן: תנועה, רצון ומשחק</a></h2>
  <p class="card__desc">מורה התנועה מסביר למה משמעת לבדה לא מספיקה, ואיך להפוך את היום־יום כולו לתרגול.</p>
  <div class="card__meta"><span>29 ביוני 2026</span><span class="dot">מתוך «Huberman Lab»</span></div>
</article>`,
});

cards['components/editorial.html'] = page({
  group: 'Components',
  name: 'בלוקים מערכתיים',
  subtitle: 'ציטוט פותח · אמ;לק · ציטוט גוף · קופסת מקור',
  width: 760,
  body: `
<blockquote class="pull--lead">"החיים לא נועדו לכך שפשוט נחיה אותם; הם נועדו לתרגול."
<cite>— עידו פורטל</cite></blockquote>
<aside class="tldr">
<p class="tldr__label">אמ;לק · אם יש לכם 30 שניות</p>
<ul><li>נקודת תמצית ראשונה של הפרק — משפט אחד חד.</li>
<li>נקודה שנייה עם <strong>הדגשה</strong> במקום הנכון.</li>
<li>3–5 נקודות סה"כ. הבטחת הדחיסה של המותג, פשוטו כמשמעו.</li></ul>
</aside>
<blockquote class="body-quote">"תגלו שהרצון שלכם חלש כמו זמזום של יתוש."</blockquote>
<aside class="source-box"><strong>על מה מבוסס התקציר?</strong><br>
התקציר מבוסס על הפרק «Movement Practice» מתוך הפודקאסט <a href="#"><strong>Huberman Lab</strong></a> עם עידו פורטל.
<a href="#">צפו במקור המלא ביוטיוב ↗</a><br>
<span class="muted">זהו תקציר מקורי ופרשני. כל הזכויות על התוכן המקורי שמורות ליוצרים.</span></aside>`,
});

cards['components/newsletter.html'] = page({
  group: 'Components',
  name: 'ניוזלטר',
  subtitle: 'קופסת פוטר · Slide-in · טופס hero',
  width: 780,
  body: `
<h3>קופסת פוטר</h3>
<aside class="newsletter">
  <div><p class="newsletter__heading">הפודקאסטים הכי טובים, מזוקקים לתיבה שלך</p>
  <p class="newsletter__subtext">גיליון שבועי. בלי ספאם, אפשר לבטל בכל רגע.</p></div>
  <form class="nl-form"><input class="nl-form__input" type="email" placeholder="כתובת אימייל"><button class="nl-form__btn">הרשמה</button></form>
</aside>
<h3 style="margin-top:1.6rem">Slide-in (מופיע ב-55% גלילה, נסגר ל-14 יום)</h3>
<aside class="nl-slidein">
  <button class="nl-slidein__close">×</button>
  <p class="nl-slidein__heading">אהבתם? יש עוד.</p>
  <p class="nl-slidein__sub">התקצירים הכי טובים, ישר לתיבה. בלי ספאם.</p>
  <form class="nl-form"><input class="nl-form__input" type="email" placeholder="כתובת אימייל"><button class="nl-form__btn">הרשמה</button></form>
</aside>`,
});

cards['components/header.html'] = page({
  group: 'Components',
  name: 'Header',
  subtitle: 'מותג + ניווט (דסקטופ) · במובייל: המבורגר ↦ overlay',
  width: 900,
  body: `
<header class="site-header"><div class="site-header__inner">
  <a class="brand" href="#">${WAVE(14)}<span>הסכתון</span></a>
  <nav class="nav">
    <a href="#" aria-current="page">כל הפרקים</a><a href="#">קטגוריות</a>
    <a href="#">חיפוש</a><a href="#">אודות</a>
    <a href="#" aria-label="אינסטגרם" style="display:inline-flex"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
  </nav>
</div></header>
<p class="muted" style="font-size:.85rem;margin-top:1rem">Sticky עם blur על ::before (לא על ה-header עצמו — backdrop-filter לוכד position:fixed של ה-overlay). הפריט הפעיל בצבע accent-ink.</p>`,
});

cards['components/readnext.html'] = page({
  group: 'Components',
  name: 'הבא בשבילכם',
  subtitle: 'המלצת סוף-פוסט: כרטיס ראשי + 2 חלופות',
  width: 640,
  body: `
<p class="eyebrow">הבא בשבילכם</p>
<a class="readnext__hero" href="#"><span class="readnext__body">
  <span class="readnext__row"><span class="chip">בריאות וכושר</span>
  <span class="compress">01:09:00 <span class="arrow">⟶</span> 10′</span></span>
  <span class="readnext__title">מדריך התוספים של אנדי גלפין: מה באמת עובד</span>
  <span class="readnext__desc">אותו אורח שאהבתם — הצלילה המלאה לקריאטין, חלבון ושינה.</span>
  <span class="readnext__cta">לקריאה ←</span>
</span></a>
<div class="readnext__more">
  <a class="readnext__item" href="#"><span class="readnext__item-cat">בריאות וכושר</span>
  <span class="readnext__item-title">דיוויד סינקלייר: ההזדקנות ניתנת לביטול</span></a>
  <a class="readnext__item" href="#"><span class="readnext__item-cat">בריאות וכושר</span>
  <span class="readnext__item-title">טומי ווד: איך לשמור על המוח חד</span></a>
</div>
<p class="muted" style="font-size:.85rem;margin-top:1rem">דירוג build-time: אורח (5) > פודקאסט (4) > קטגוריה (3) > תגיות (+1). כרטיס אחד גדול = חיכוך נמוך.</p>`,
});

// ---------- write ----------
mkdirSync(path.join(OUT, 'foundations'), { recursive: true });
mkdirSync(path.join(OUT, 'components'), { recursive: true });
for (const [rel, html] of Object.entries(cards)) {
  writeFileSync(path.join(OUT, rel), html);
  console.log('✓', rel);
}
console.log(`\n${Object.keys(cards).length} cards → design-system/cards/`);
