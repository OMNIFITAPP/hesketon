// ============================================================
//  templates-v2.mjs — the "etched editorial" Instagram look.
//
//  Matches the hand-made posts the user shipped in July 2026 and
//  personally connected with (cream paper, thin frame, raspberry
//  etching illustrations, quote card with accented words, meta row
//  with the compression pill + podcast chip, slide pagination).
//
//  Builders return [{ name, html, width, height }] for render.mjs.
// ============================================================

const T = {
  bg: '#f7f3ec',          // cream paper
  card: '#fbf2f4',        // soft pink card
  cardBorder: '#eddade',
  frame: '#e5d9d2',
  ink: '#232030',
  inkSoft: '#4c4757',
  muted: '#8a8494',
  accent: '#b83d64',      // dusty raspberry
  accentDeep: '#a12e55',
  accentSoft: '#f4dfe6',
};

const FEED = { width: 1080, height: 1350 };

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Small waveform mark (equalizer bars) used beside the logo. */
function waveMark(color = T.accent, h = 34) {
  const bars = [12, 22, 32, 18, 34, 24, 14, 28, 20, 10]
    .map((v, i) => `<rect x="${i * 9}" y="${(h - v) / 2}" width="5" height="${v}" rx="2.5" fill="${color}"/>`)
    .join('');
  return `<svg width="${9 * 10}" height="${h}" viewBox="0 0 ${9 * 10} ${h}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

/** Tiny waveform for the compression pill. */
function waveMini() {
  return waveMark(T.accentDeep, 20);
}

function docV2({ width, height, body }) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${width}px;height:${height}px}
  body{background:${T.bg};color:${T.ink};font-family:'Heebo',system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
    display:flex;flex-direction:column;padding:74px 66px 56px;position:relative;overflow:hidden}
  .frame{position:absolute;inset:26px;border:2px solid ${T.frame};border-radius:34px;pointer-events:none}
  .rub{font-family:'Rubik','Heebo',sans-serif}
  .head{display:flex;align-items:center;gap:16px;z-index:2}
  .head .logo{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:42px;color:${T.ink};letter-spacing:-1px}
  .main{flex:1;display:flex;z-index:2;min-height:0}
  .botline{border-top:2px solid ${T.frame};margin-top:34px;padding-top:26px;display:flex;
    align-items:center;justify-content:space-between;gap:18px;z-index:2}
  .pill{display:inline-flex;align-items:center;gap:14px;background:${T.accentSoft};
    border-radius:999px;padding:12px 26px;font-weight:700;font-size:27px;white-space:nowrap;color:${T.accentDeep};direction:ltr}
  .chip{display:inline-flex;align-items:center;border:2px solid ${T.cardBorder};border-radius:999px;
    padding:10px 26px;font-weight:600;font-size:26px;color:${T.accentDeep};direction:ltr}
  .attr{font-size:26px;color:${T.inkSoft};font-weight:500}
  .attr b{color:${T.ink};font-weight:800}
  .pgn{font-size:26px;color:${T.inkSoft};font-weight:500}
  .accent{color:${T.accent}}
  /* quote card */
  .qcard{background:${T.card};border:2px solid ${T.cardBorder};border-radius:44px;
    padding:56px 60px 48px;display:flex;flex-direction:column}
  .qmarks{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:150px;line-height:.55;
    color:${T.accent};height:86px}
  .qtext{font-family:'Rubik','Heebo',sans-serif;font-weight:900;letter-spacing:-.5px;line-height:1.28}
  .qtext b{color:${T.accent};font-weight:900}
  .qcite{margin-top:40px;font-size:33px;font-weight:700;color:${T.inkSoft}}
  .qcite::before{content:'— '}
  .illu{display:flex;align-items:center;justify-content:center}
  .illu img{max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:multiply}
  /* carousel slides */
  .kick{font-family:'Rubik','Heebo',sans-serif;font-weight:700;font-size:30px;color:${T.accent};margin-bottom:26px}
  .kick::before{content:'— '}
  .bigtitle{font-family:'Rubik','Heebo',sans-serif;font-weight:900;letter-spacing:-1px;line-height:1.12}
  .divider{display:flex;align-items:center;gap:0;margin:44px auto;width:52%}
  .divider .ln{flex:1;height:2px;background:${T.accent};opacity:.75}
  .divider .dot{width:14px;height:14px;border-radius:50%;background:${T.accent}}
  .bodytxt{font-size:41px;line-height:1.62;color:${T.ink};font-weight:500}
  .bodytxt b{color:${T.accent};font-weight:800}
  .ccard{background:${T.card};border:2px solid ${T.cardBorder};border-radius:44px;
    padding:64px 68px;flex:1;display:flex;flex-direction:column;justify-content:center;text-align:center}
  .cta-pill{display:inline-block;background:${T.accent};color:#fff;font-family:'Rubik','Heebo',sans-serif;
    font-weight:800;font-size:38px;padding:24px 48px;border-radius:24px}
  .heart{width:74px;height:74px;border:2px solid ${T.accent};border-radius:50%;display:flex;
    align-items:center;justify-content:center;margin:34px auto 16px;color:${T.accent};font-size:34px}
  .saveline{font-size:29px;color:${T.accentDeep};font-weight:600}
</style></head><body>
<div class="frame"></div>
${body}
</body></html>`;
}

function headV2() {
  return `<div class="head"><span class="logo">הסכתון</span>${waveMark()}</div>`;
}

/** Compression pill: `2:29:00 → 10'` + mini waveform. */
function compressPill(post) {
  const dm = post.durationMinutes, rt = post.readingTime;
  if (!dm || !rt) return '';
  const t = `${Math.floor(dm / 60)}:${String(dm % 60).padStart(2, '0')}:00`;
  return `<span class="pill"><span>${t} → ${rt}′</span>${waveMini()}</span>`;
}

function pagination(i, n) {
  return `<span class="pgn">שקופית ${i} מתוך ${n}</span>`;
}

// ── Quote post (Sinclair-style): card right, etching left ──

/**
 * quoteHtml: the quote WITH <b> around the words to accent.
 * illu: data-URI of the etched illustration (or '' to skip).
 */
export function buildQuoteV2(post, { quoteHtml, cite, illu = '', attr = '' }) {
  const len = quoteHtml.replace(/<[^>]+>/g, '').length;
  const size = len <= 90 ? 64 : len <= 140 ? 58 : len <= 200 ? 52 : 46;
  const body = `${headV2()}
  <div class="main" style="gap:44px;align-items:stretch;margin-top:40px">
    <div class="qcard" style="flex:1.25">
      <div class="qmarks">”</div>
      <div class="qtext" style="font-size:${size}px">${quoteHtml}</div>
      <div class="qcite">${esc(cite)}</div>
    </div>
    <div class="illu" style="flex:.95">${illu ? `<img src="${illu}">` : ''}</div>
  </div>
  <div class="botline">
    ${compressPill(post)}
    ${post.podcast ? `<span class="chip">${esc(post.podcast)}</span>` : ''}
    <span class="attr">${attr || `מתוך הפרק עם ${esc(post.guest)} · <b>הסכתון</b>`}</span>
  </div>`;
  return [{ name: 'quote-v2', html: docV2({ ...FEED, body }), ...FEED }];
}

// ── Carousel v2: cover → content cards → CTA ───────────────

function coverSlideV2(post, { kicker, titleTop, titleAccent, sub, illu = '' }, n) {
  const body = `${headV2()}
  <div class="main" style="flex-direction:column;justify-content:center;text-align:center">
    <div class="kick" style="margin-bottom:30px">${esc(kicker)}</div>
    <div class="bigtitle" style="font-size:92px">${esc(titleTop)}<br><span class="accent">${esc(titleAccent)}</span></div>
    <div class="divider"><span class="dot"></span><span class="ln"></span><span class="dot"></span></div>
    <div class="bodytxt" style="font-size:37px;color:${T.inkSoft}">${esc(sub)}</div>
    ${illu ? `<div class="illu" style="margin-top:26px"><img src="${illu}" style="max-height:300px"></div>` : ''}
    <div style="margin-top:${illu ? 26 : 56}px;font-size:32px;font-weight:700;color:${T.accentDeep}">← החליקו</div>
  </div>
  <div class="botline">${compressPill(post)}${post.podcast ? `<span class="chip">${esc(post.podcast)}</span>` : ''}${pagination(1, n)}</div>`;
  return { name: '01-cover', html: docV2({ ...FEED, body }), ...FEED };
}

function contentSlideV2(post, { kicker, head, bodyHtml }, i, n) {
  const body = `${headV2()}
  <div class="main" style="flex-direction:column;margin-top:40px">
    <div class="ccard">
      <div class="kick">${esc(kicker)}</div>
      <div class="bigtitle accent" style="font-size:66px">${esc(head)}</div>
      <div class="divider"><span class="ln"></span><span class="dot"></span></div>
      <div class="bodytxt">${bodyHtml}</div>
    </div>
  </div>
  <div class="botline"><span></span>${pagination(i, n)}</div>`;
  return { name: `s${String(i).padStart(2, '0')}`, html: docV2({ ...FEED, body }), ...FEED };
}

function ctaSlideV2(post, { titleTop, titleAccent, lines }, n) {
  const body = `${headV2()}
  <div class="main" style="flex-direction:column;justify-content:center;text-align:center">
    <div class="kick" style="margin-bottom:30px">מה לוקחים מזה</div>
    <div class="bigtitle" style="font-size:88px">${esc(titleTop)}<br><span class="accent">${esc(titleAccent)}</span></div>
    <div class="divider"><span class="ln"></span><span class="dot"></span><span class="ln"></span></div>
    <div class="bodytxt" style="font-size:38px">${lines.map(esc).join('<br>')}</div>
    <div style="margin-top:52px"><span class="cta-pill">לקריאה מלאה באתר הסכתון. ←</span></div>
    <div class="heart">♥</div>
    <div class="saveline">לשמירה — אם גם אתם אוהבים רעיונות שפותחים את הראש.</div>
  </div>
  <div class="botline"><span class="attr"><b>הסכתון</b> · hesketon.co.il</span>${pagination(n, n)}</div>`;
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

// ── "מיתוס ↔ מציאות" — new 2-slide swipe format ────────────

export function buildMythV2(post, { myth, realityHead, realityBody, attr, illu = '' }) {
  const chip = (txt, filled) => `<div style="margin:0 auto 40px;display:inline-block;
    font-family:'Rubik','Heebo',sans-serif;font-weight:800;font-size:34px;padding:16px 44px;border-radius:999px;
    ${filled ? `background:${T.accent};color:#fff` : `border:2px solid ${T.accent};color:${T.accentDeep}`}">${txt}</div>`;

  const s1body = `${headV2()}
  <div class="main" style="flex-direction:column;justify-content:center;text-align:center">
    <div>${chip('מיתוס', false)}</div>
    <div class="bigtitle" style="font-size:84px">${esc(myth)}</div>
    <div class="divider"><span class="ln"></span><span class="dot"></span><span class="ln"></span></div>
    <div style="font-size:34px;font-weight:700;color:${T.accentDeep}">← החליקו למציאות</div>
  </div>
  <div class="botline">${compressPill(post)}${post.podcast ? `<span class="chip">${esc(post.podcast)}</span>` : ''}${pagination(1, 2)}</div>`;

  const s2body = `${headV2()}
  <div class="main" style="flex-direction:column;justify-content:center;text-align:center;position:relative">
    ${illu ? `<div class="illu" style="position:absolute;left:-20px;top:0;bottom:0;width:300px;opacity:.85"><img src="${illu}"></div>` : ''}
    <div>${chip('מציאות ✓', true)}</div>
    <div class="bigtitle accent" style="font-size:74px">${esc(realityHead)}</div>
    <div class="divider"><span class="ln"></span><span class="dot"></span><span class="ln"></span></div>
    <div class="bodytxt" style="font-size:40px;max-width:82%;margin:0 auto">${realityBody}</div>
  </div>
  <div class="botline"><span class="attr">${attr}</span>${pagination(2, 2)}</div>`;

  return [
    { name: '01-myth', html: docV2({ ...FEED, body: s1body }), ...FEED },
    { name: '02-reality', html: docV2({ ...FEED, body: s2body }), ...FEED },
  ];
}

export { T as TOKENS_V2, FEED as FEED_V2 };
