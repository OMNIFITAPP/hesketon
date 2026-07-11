// ============================================================
//  templates-v2.mjs — the "etched editorial" Instagram look.
//
//  Calibrated 2026-07-11 against the account's real posts
//  (OMNIFIT_Knowledge_Base/hesketon/media-content/), with pixel-
//  sampled tokens and the user's standing rules:
//    • ALL backgrounds uniform #f9f4f0 (user rule, 2026-07-11)
//    • quote posts: full-height guest portrait (continuous line
//      drawing, supplied as PNG), quote ALL-ink & airy — no
//      colored words; vivid #ec3564 accents for marks/brand only
//    • carousel covers: clean poster — no kicker/sub/pill/chip,
//      dotted-orbit motifs, bottom rule + pagination only
//    • content slides: one idea, few short lines, lots of air
//
//  Builders return [{ name, html, width, height }] for render.mjs.
// ============================================================

const T = {
  bg: '#f9f4f0',           // unified warm cream (user rule)
  ink: '#131321',
  inkSoft: '#3f3b4a',
  muted: '#8a8494',
  pink: '#ec3564',         // vivid — quote posts (marks, brand, rules)
  pinkSoft: '#fbdfe7',
  raspberry: '#b23a60',    // muted — carousel typography
  cardBorder: '#f0d3da',
  line: '#e7ddd6',
};

const FEED = { width: 1080, height: 1350 };
const MONO = `'Menlo','Consolas','Courier New',monospace`;

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Waveform mark beside the logo (denser, like the account's). */
function waveMark(color = T.pink, h = 40, bars = 14) {
  const hs = [10, 20, 32, 16, 38, 26, 12, 34, 22, 40, 18, 28, 14, 24];
  const cells = hs.slice(0, bars)
    .map((v, i) => `<rect x="${i * 10}" y="${(h - v) / 2}" width="5.5" height="${v}" rx="2.75" fill="${color}"/>`)
    .join('');
  return `<svg width="${10 * bars}" height="${h}" viewBox="0 0 ${10 * bars} ${h}" xmlns="http://www.w3.org/2000/svg">${cells}</svg>`;
}

/** Dotted-orbit + stars decorative motif (carousel covers). */
function orbitMotif(accent = T.raspberry) {
  return `<svg width="520" height="560" viewBox="0 0 520 560" xmlns="http://www.w3.org/2000/svg" fill="none">
    <circle cx="150" cy="300" r="60"  stroke="${accent}" stroke-width="1.6" stroke-dasharray="3 7" opacity=".55"/>
    <circle cx="150" cy="300" r="105" stroke="${accent}" stroke-width="1.6" stroke-dasharray="3 8" opacity=".4"/>
    <circle cx="150" cy="300" r="160" stroke="${accent}" stroke-width="1.6" stroke-dasharray="3 9" opacity=".3"/>
    <path d="M 30 80 Q 300 90 470 330" stroke="${accent}" stroke-width="1.6" stroke-dasharray="3 8" opacity=".45"/>
    <circle cx="150" cy="300" r="7" fill="${accent}" opacity=".9"/>
    <circle cx="118" cy="128" r="17" fill="${accent}" opacity=".85"/>
    <circle cx="380" cy="215" r="9" stroke="${accent}" stroke-width="2" opacity=".6"/>
    <circle cx="60" cy="470" r="5" fill="${accent}" opacity=".5"/>
    <path d="M 330 90 l 5 14 l 14 5 l -14 5 l -5 14 l -5 -14 l -14 -5 l 14 -5 z" fill="${accent}" opacity=".7"/>
    <path d="M 240 470 l 4 11 l 11 4 l -11 4 l -4 11 l -4 -11 l -11 -4 l 11 -4 z" fill="${accent}" opacity=".5"/>
  </svg>`;
}

function docV2({ width, height, body }) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${width}px;height:${height}px}
  body{background:${T.bg};color:${T.ink};font-family:'Heebo',system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
    display:flex;flex-direction:column;padding:64px 72px 52px;position:relative;overflow:hidden}
  .frame{position:absolute;inset:22px;border:1.5px solid ${T.line};border-radius:38px;pointer-events:none}
  .head{display:flex;align-items:center;gap:22px;z-index:2}
  .head .logo{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:52px;color:${T.ink};letter-spacing:-1px}
  .main{flex:1;display:flex;z-index:2;min-height:0}
  .accent{color:${T.raspberry}}
  /* ── quote post ── */
  .qcard{background:#fdfaf8;border:1.5px solid ${T.cardBorder};border-radius:52px;
    padding:60px 64px 52px;display:flex;flex-direction:column}
  .qmarks{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:170px;line-height:.55;
    color:${T.pink};height:100px}
  .qtext{font-weight:800;font-size:44px;line-height:1.9;letter-spacing:.2px;color:${T.ink}}
  .qcite{margin-top:34px;font-size:34px;font-weight:700;color:${T.ink}}
  .qcite::before{content:'— ';color:${T.pink}}
  .portrait{display:flex;align-items:flex-end;justify-content:center}
  .portrait img{max-width:100%;max-height:100%;object-fit:contain}
  .botline{border-top:1.5px solid ${T.line};margin-top:30px;padding-top:24px;display:flex;
    align-items:center;justify-content:space-between;gap:18px;z-index:2}
  .pill{display:inline-flex;align-items:center;gap:14px;background:${T.pinkSoft};
    border-radius:14px;padding:12px 24px;font-family:${MONO};font-weight:700;font-size:26px;
    white-space:nowrap;color:${T.ink};direction:ltr}
  .chip{display:inline-flex;align-items:center;border:2px solid ${T.pink};border-radius:999px;
    padding:10px 28px;font-weight:700;font-size:26px;color:${T.pink};direction:ltr;white-space:nowrap}
  .attr{font-size:27px;color:${T.ink};font-weight:500}
  .attr b{color:${T.pink};font-weight:800}
  /* ── carousel ── */
  .kick{font-family:'Rubik','Heebo',sans-serif;font-weight:700;font-size:30px;color:${T.raspberry}}
  .kick::before{content:'— '}
  .poster{font-family:'Rubik','Heebo',sans-serif;font-weight:900;letter-spacing:-1.5px;line-height:1.14}
  .divider{display:flex;align-items:center;margin:42px auto;width:46%}
  .divider .ln{flex:1;height:2.5px;background:${T.raspberry};opacity:.8}
  .divider .dot{width:13px;height:13px;border-radius:50%;background:${T.raspberry}}
  .bodytxt{font-size:40px;line-height:1.85;color:${T.ink};font-weight:500}
  .pgn{position:absolute;bottom:52px;right:80px;font-size:26px;color:${T.inkSoft};font-weight:500;z-index:3}
  .rule{position:absolute;bottom:66px;left:80px;right:340px;height:2px;background:${T.line};z-index:1}
  .rule::after{content:'';position:absolute;left:-1px;top:-5px;width:12px;height:12px;border-radius:50%;background:${T.raspberry};opacity:.85}
  .cta-pill{display:inline-block;background:${T.raspberry};color:#fff;font-family:'Rubik','Heebo',sans-serif;
    font-weight:800;font-size:38px;padding:26px 52px;border-radius:22px}
  .heart{width:78px;height:78px;border:2.5px solid ${T.raspberry};border-radius:50%;display:flex;
    align-items:center;justify-content:center;margin:38px auto 16px;color:${T.raspberry};font-size:36px}
  .saveline{font-size:29px;color:${T.raspberry};font-weight:600}
</style></head><body>
<div class="frame"></div>
${body}
</body></html>`;
}

function headV2({ small = false } = {}) {
  return `<div class="head" style="${small ? 'transform:scale(.82);transform-origin:right center' : ''}">
    <span class="logo">הסכתון</span>${waveMark()}
  </div>`;
}

/** Compression pill — mono digits, e.g. `2:01:00 → 9'`. */
function compressPill(post) {
  const dm = post.durationMinutes, rt = post.readingTime;
  if (!dm || !rt) return '<span></span>';
  const t = `${Math.floor(dm / 60)}:${String(dm % 60).padStart(2, '0')}:00`;
  return `<span class="pill"><span>${t} → ${rt}′</span>${waveMark(T.pink, 22, 8)}</span>`;
}

// ── Quote post: full-height portrait + airy all-ink quote ───

/**
 * quote: plain text (NO html accents — the quote stays all-ink).
 * portrait: data-URI PNG (transparent bg), continuous-line etching.
 */
export function buildQuoteV2(post, { quote, cite, portrait = '', attr = '' }) {
  const len = quote.length;
  const size = len <= 120 ? 46 : len <= 190 ? 42 : len <= 260 ? 38 : 34;
  const body = `${headV2()}
  <div class="main" style="gap:30px;align-items:stretch;margin-top:34px;margin-bottom:0">
    <div class="qcard" style="flex:1.06">
      <div class="qmarks">“</div>
      <div class="qtext" style="font-size:${size}px">${esc(quote)}</div>
      <div class="qcite">${esc(cite)}</div>
    </div>
    <div class="portrait" style="flex:1;margin-left:-26px">${portrait ? `<img src="${portrait}">` : ''}</div>
  </div>
  <div class="botline">
    ${compressPill(post)}
    ${post.podcast ? `<span class="chip">${esc(post.podcast)}</span>` : ''}
    <span class="attr">${attr || `מתוך הפרק עם ${esc(post.guest)} · <b>הסכתון</b>`}</span>
  </div>`;
  return [{ name: 'quote-v2', html: docV2({ ...FEED, body }), ...FEED }];
}

// ── Carousel: poster cover → airy content cards → CTA ───────

function coverSlideV2(post, { titleTop, titleAccent }, n) {
  const body = `<div style="position:absolute;top:120px;left:-40px;z-index:1;opacity:.9">${orbitMotif()}</div>
  ${headV2({ small: true })}
  <div class="main" style="flex-direction:column;justify-content:center;text-align:right;padding-right:40px">
    <div class="poster" style="font-size:124px;z-index:2">${esc(titleTop)}</div>
    <div class="poster accent" style="font-size:106px;margin-top:18px;margin-right:70px;z-index:2">${esc(titleAccent)}</div>
  </div>
  <div class="rule"></div>
  <div class="pgn">שקופית 1 מתוך ${n}</div>`;
  return { name: '01-cover', html: docV2({ ...FEED, body }), ...FEED };
}

function contentSlideV2(post, { kicker, head, lines }, i, n) {
  const body = `${headV2({ small: true })}
  <div class="main" style="flex-direction:column;justify-content:center;padding-bottom:70px">
    <div style="background:#fdf7f5;border-radius:56px;padding:88px 84px;text-align:right">
      <div class="kick">${esc(kicker)}</div>
      <div class="poster accent" style="font-size:76px;margin-top:22px">${esc(head)}</div>
      <div style="width:64%;height:2.5px;background:${T.raspberry};opacity:.8;margin:44px 0"></div>
      <div class="bodytxt">${lines.map(esc).join('<br>')}</div>
    </div>
  </div>
  <div class="rule"></div>
  <div class="pgn">שקופית ${i} מתוך ${n}</div>`;
  return { name: `s${String(i).padStart(2, '0')}`, html: docV2({ ...FEED, body }), ...FEED };
}

function ctaSlideV2(post, { titleTop, titleAccent, lines }, n) {
  const body = `${headV2({ small: true })}
  <div class="main" style="flex-direction:column;justify-content:center;text-align:center;padding-bottom:60px">
    <div class="kick" style="margin-bottom:28px">מה לוקחים מזה</div>
    <div class="poster" style="font-size:92px">${esc(titleTop)}<br><span class="accent">${esc(titleAccent)}</span></div>
    <div class="divider"><span class="ln"></span><span class="dot"></span><span class="ln"></span></div>
    <div class="bodytxt" style="font-size:37px;line-height:1.7">${lines.map(esc).join('<br>')}</div>
    <div style="margin-top:48px"><span class="cta-pill">לקריאה מלאה באתר הסכתון. ←</span></div>
    <div class="heart">♥</div>
    <div class="saveline">לשמירה — אם גם אתם אוהבים רעיונות שפותחים את הראש.</div>
  </div>
  <div class="rule"></div>
  <div class="pgn">שקופית ${n} מתוך ${n}</div>`;
  return { name: `99-cta`, html: docV2({ ...FEED, body }), ...FEED };
}

export function buildCarouselV2(post, { cover, slides, cta }) {
  const n = slides.length + 2;
  return [
    coverSlideV2(post, cover, n),
    ...slides.map((s, i) => contentSlideV2(post, s, i + 2, n)),
    ctaSlideV2(post, cta, n),
  ];
}

// ── "מיתוס ↔ מציאות" — 2-slide swipe ────────────────────────

export function buildMythV2(post, { myth, realityHead, realityLines, attr }) {
  const chip = (txt, filled) => `<div style="display:inline-block;margin-bottom:44px;
    font-family:'Rubik','Heebo',sans-serif;font-weight:800;font-size:34px;padding:16px 46px;border-radius:999px;
    ${filled ? `background:${T.raspberry};color:#fff` : `border:2.5px solid ${T.raspberry};color:${T.raspberry}`}">${txt}</div>`;

  const s1 = `${headV2({ small: true })}
  <div class="main" style="flex-direction:column;justify-content:center;text-align:center;padding-bottom:60px">
    <div>${chip('מיתוס', false)}</div>
    <div class="poster" style="font-size:88px">${esc(myth)}</div>
    <div class="divider"><span class="ln"></span><span class="dot"></span><span class="ln"></span></div>
    <div style="font-size:33px;font-weight:700;color:${T.raspberry}">← החליקו למציאות</div>
  </div>
  <div class="rule"></div><div class="pgn">שקופית 1 מתוך 2</div>`;

  const s2 = `${headV2({ small: true })}
  <div class="main" style="flex-direction:column;justify-content:center;text-align:center;padding-bottom:60px">
    <div>${chip('מציאות ✓', true)}</div>
    <div class="poster accent" style="font-size:82px">${esc(realityHead)}</div>
    <div class="divider"><span class="ln"></span><span class="dot"></span><span class="ln"></span></div>
    <div class="bodytxt" style="max-width:84%;margin:0 auto">${realityLines.map(esc).join('<br>')}</div>
    <div style="margin-top:44px" class="attr">${attr}</div>
  </div>
  <div class="rule"></div><div class="pgn">שקופית 2 מתוך 2</div>`;

  return [
    { name: '01-myth', html: docV2({ ...FEED, body: s1 }), ...FEED },
    { name: '02-reality', html: docV2({ ...FEED, body: s2 }), ...FEED },
  ];
}

export { T as TOKENS_V2, FEED as FEED_V2 };
