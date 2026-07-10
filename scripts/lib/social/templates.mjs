// ============================================================
//  templates.mjs — branded, RTL HTML for each social slide.
//  Reuses the site's "Frequency" tokens (src/styles/global.css):
//    raspberry #d6336c · cream #faf8f3 · ink #1a1722 · Rubik + Heebo.
//
//  Each builder returns an array of { name, html, width, height }.
//  render.mjs turns each into a PNG via headless Chrome.
// ============================================================

const BRAND = {
  accent: '#d6336c',
  accentInk: '#a61e4d',
  accentSoft: '#fbe0ea',
  bg: '#faf8f3',
  surface: '#ffffff',
  ink: '#1a1722',
  inkSoft: '#46424f',
  muted: '#5f5b68',
  line: '#e8e3da',
  brand: 'הסכתון',
  handle: '@hesketon',
};

const FEED = { width: 1080, height: 1350 };
const STORY = { width: 1080, height: 1920 };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** A decorative equalizer/waveform strip — the brand's audio motif. */
function waveform(bars = 42) {
  const cells = Array.from({ length: bars }, (_, i) => {
    // deterministic pseudo-random heights so renders are reproducible
    const h = 18 + Math.round(40 * Math.abs(Math.sin(i * 1.7)) + 10 * Math.abs(Math.cos(i * 0.6)));
    return `<span style="height:${h}%"></span>`;
  }).join('');
  return `<div class="wave">${cells}</div>`;
}

/** Full HTML document wrapper. `dark` flips to the night palette. */
function doc({ width, height, body, dark = false }) {
  const t = dark
    ? { bg: '#15131c', surface: '#1e1b28', ink: '#edeaf2', inkSoft: '#c6c1d2', muted: '#9893a6', line: '#2d2a38', accent: '#f06595', accentSoft: '#2c1a24' }
    : { bg: BRAND.bg, surface: BRAND.surface, ink: BRAND.ink, inkSoft: BRAND.inkSoft, muted: BRAND.muted, line: BRAND.line, accent: BRAND.accent, accentSoft: BRAND.accentSoft };

  // Fonts (Rubik/Heebo, Hebrew subset) are injected at render time from local
  // woff2 files (see render.mjs) — no network dependency at publish time.
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${width}px;height:${height}px}
  body{
    background:${t.bg};color:${t.ink};
    font-family:'Heebo',system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
    display:flex;flex-direction:column;
    padding:88px 84px;position:relative;overflow:hidden;
  }
  .frame{position:absolute;inset:40px;border:2px solid ${t.line};border-radius:36px;pointer-events:none}
  .head{display:flex;align-items:center;justify-content:space-between;gap:20px;z-index:2}
  .brand{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:900;font-size:40px;color:${t.accent};letter-spacing:-.5px}
  .brand .dot{color:${t.ink}}
  .kicker{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:700;font-size:26px;color:${t.muted};
    background:${t.accentSoft};color:${t.accent};padding:10px 22px;border-radius:999px}
  .main{flex:1;display:flex;flex-direction:column;justify-content:center;z-index:2}
  .foot{display:flex;align-items:center;justify-content:space-between;gap:20px;z-index:2}
  .src{font-size:26px;color:${t.muted};font-weight:500}
  .src b{color:${t.ink};font-weight:700}
  .handle{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:700;font-size:26px;color:${t.muted}}
  .wave{display:flex;align-items:flex-end;gap:7px;height:54px;width:300px;opacity:.9}
  .wave span{flex:1;background:${t.accent};border-radius:6px;min-height:8px}
  /* ---- cover ---- */
  .eyebrow{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:700;font-size:30px;color:${t.accent};margin-bottom:28px}
  .title{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:900;font-size:84px;line-height:1.08;letter-spacing:-1px}
  .sub{font-size:36px;line-height:1.5;color:${t.inkSoft};margin-top:36px;font-weight:400}
  /* ---- quote ---- */
  .qmark{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:900;font-size:200px;line-height:.6;color:${t.accent};opacity:.25;height:120px}
  .quote{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:700;font-size:66px;line-height:1.32}
  .cite{margin-top:48px;font-size:36px;font-weight:700;color:${t.accent}}
  .cite::before{content:'— '}
  /* ---- bullet / takeaway ---- */
  .idx{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:900;font-size:120px;color:${t.accentSoft};line-height:1;margin-bottom:8px}
  .ttl{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:900;font-size:60px;line-height:1.18;margin-bottom:30px}
  .bd{font-size:44px;line-height:1.55;color:${t.inkSoft};font-weight:400}
  .bullet{font-size:50px;line-height:1.5;font-weight:500}
  /* ---- cta ---- */
  .cta-ttl{font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:900;font-size:76px;line-height:1.12;margin-bottom:32px}
  .cta-pill{display:inline-block;font-family:'Rubik','Heebo',system-ui,sans-serif;font-weight:700;font-size:38px;
    background:${t.accent};color:#fff;padding:26px 52px;border-radius:999px;margin-top:20px}
  .cta-sub{font-size:34px;color:${t.muted};margin-top:36px;font-weight:500}
</style></head><body>
<div class="frame"></div>
${body}
</body></html>`;
}

function header(kicker) {
  return `<div class="head">
    <div class="brand">הסכתון<span class="dot">.</span></div>
    ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}
  </div>`;
}

function footer(post, { showSrc = true } = {}) {
  const src = showSrc && (post.guest || post.podcast)
    ? `<div class="src">${post.guest ? `<b>${esc(post.guest)}</b>` : ''}${post.guest && post.podcast ? ' · ' : ''}${esc(post.podcast)}</div>`
    : `<div class="src"></div>`;
  return `<div class="foot">${src}${waveform()}</div>`;
}

// ── Slide builders ─────────────────────────────────────────

function coverSlide(post, { kicker, eyebrow } = {}) {
  const body = `${header(kicker)}
    <div class="main">
      ${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}
      <div class="title">${esc(post.title)}</div>
      ${post.description ? `<div class="sub">${esc(post.description)}</div>` : ''}
    </div>
    ${footer(post)}`;
  return { name: '01-cover', html: doc({ ...FEED, body }), ...FEED };
}

function quoteSlide(post, { dark = false, kicker = 'ציטוט' } = {}) {
  const q = post.lead;
  const body = `${header(kicker)}
    <div class="main">
      <div class="qmark">”</div>
      <div class="quote">${esc(q.text)}</div>
      ${q.cite ? `<div class="cite">${esc(q.cite)}</div>` : ''}
    </div>
    ${footer(post)}`;
  return { name: 'quote', html: doc({ ...FEED, body, dark }), ...FEED };
}

function bulletSlide(post, text, idx, { kicker } = {}) {
  const body = `${header(kicker)}
    <div class="main">
      <div class="idx">${String(idx).padStart(2, '0')}</div>
      <div class="bullet">${esc(text)}</div>
    </div>
    ${footer(post)}`;
  return { name: `b${String(idx).padStart(2, '0')}`, html: doc({ ...FEED, body }), ...FEED };
}

function takeawaySlide(post, t, idx, { kicker } = {}) {
  const body = `${header(kicker)}
    <div class="main">
      <div class="idx">${String(idx).padStart(2, '0')}</div>
      ${t.head ? `<div class="ttl">${esc(t.head)}</div>` : ''}
      <div class="bd">${esc(t.body)}</div>
    </div>
    ${footer(post)}`;
  return { name: `t${String(idx).padStart(2, '0')}`, html: doc({ ...FEED, body }), ...FEED };
}

function ctaSlide(post, { title = 'הסיפור המלא בבלוג', kicker } = {}) {
  const body = `${header(kicker)}
    <div class="main">
      <div class="cta-ttl">${esc(title)}</div>
      <div><span class="cta-pill">קישור בביו 🔗</span></div>
      <div class="cta-sub">hesketon.co.il · תקצירים חכמים מהפודקאסטים הכי טובים</div>
    </div>
    ${footer(post, { showSrc: false })}`;
  return { name: '99-cta', html: doc({ ...FEED, body }), ...FEED };
}

function storySlide(post, inner, { dark = true } = {}) {
  const body = `${header('')}
    <div class="main">${inner}</div>
    ${footer(post, { showSrc: false })}`;
  return { name: 'story', html: doc({ ...STORY, body, dark }), ...STORY };
}

// ── Public composers ───────────────────────────────────────

/**
 * Full carousel for the weekly "תקציר השבוע" slot.
 * cover → up to `maxBullets` TL;DR slides → takeaways → CTA.
 * `microcopy` (optional, from caption.mjs) overrides per-slide text.
 */
export function buildCarousel(post, { kicker = 'תקציר השבוע', maxBullets = 4 } = {}) {
  const slides = [coverSlide(post, { kicker, eyebrow: post.category })];
  let i = 1;
  for (const t of post.tldr.slice(0, maxBullets)) {
    slides.push(bulletSlide(post, t, i++, { kicker }));
  }
  let j = 1;
  for (const t of post.takeaways.slice(0, 4)) {
    slides.push(takeawaySlide(post, t, j++, { kicker: 'מה לוקחים מזה' }));
  }
  slides.push(ctaSlide(post, { kicker }));
  return slides;
}

/** Compact "3 דברים שלמדנו" carousel: cover → 3 takeaways → CTA. */
export function buildLessonsCarousel(post, { kicker = '3 דברים שלמדנו' } = {}) {
  const picks = (post.takeaways.length ? post.takeaways : post.tldr.map((b) => ({ head: '', body: b }))).slice(0, 3);
  const slides = [coverSlide(post, { kicker, eyebrow: post.category })];
  let j = 1;
  for (const t of picks) slides.push(takeawaySlide(post, t, j++, { kicker }));
  slides.push(ctaSlide(post, { kicker }));
  return slides;
}

/** Single branded quote card. */
export function buildQuoteCard(post, opts = {}) {
  return [quoteSlide(post, opts)];
}

/** A story: reuse the lead quote, 9:16. */
export function buildStory(post) {
  const q = post.lead;
  const inner = `<div class="qmark">”</div>
    <div class="quote" style="font-size:72px">${esc(q.text)}</div>
    ${q.cite ? `<div class="cite">${esc(q.cite)}</div>` : ''}
    <div style="margin-top:80px"><span class="cta-pill">קישור בביו 🔗</span></div>`;
  return [storySlide(post, inner)];
}

/**
 * Share-kit story (9:16) — for READERS/friends who repost to their own
 * story, so no "קישור בביו": the exact URL + a scannable QR live on the
 * image itself. Content is inset extra from top/bottom so Instagram's UI
 * overlays (avatar, reply bar) don't cover anything.
 */
export function buildShareStory(post, { qrSvg = '', url = 'hesketon.co.il' } = {}) {
  // Dark story palette (matches doc()'s dark theme).
  const t = { surface: '#1e1b28', ink: '#edeaf2', muted: '#9893a6', line: '#2d2a38', accent: '#f06595' };

  const q = post.lead;
  const len = (q?.text || '').length;
  const size = len <= 90 ? 74 : len <= 150 ? 64 : len <= 220 ? 56 : 48;

  // Brand compression stat: "2:38:00 ⟵ 11 דק׳"
  const dm = post.durationMinutes, rt = post.readingTime;
  const stat = dm && rt
    ? `${Math.floor(dm / 60)}:${String(dm % 60).padStart(2, '0')}:00 האזנה ⟵ ${rt} דק׳ קריאה`
    : '';

  const inner = `
    <style>
      .share-src{margin-top:44px;font-size:30px;color:${t.muted};font-weight:500}
      .share-src b{color:${t.ink};font-weight:700}
      .share-card{margin-top:88px;display:flex;align-items:center;gap:40px;
        background:${t.surface};border:2px solid ${t.line};border-radius:32px;padding:40px 44px}
      .share-qr{flex:none;width:210px;height:210px;background:#fff;border-radius:20px;padding:20px}
      .share-qr svg{width:100%;height:100%;display:block}
      .share-txt{display:flex;flex-direction:column;gap:14px;min-width:0}
      .share-lbl{font-size:30px;color:${t.muted};font-weight:500}
      .share-url{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:46px;color:${t.accent};direction:ltr;text-align:right}
      .share-stat{font-size:26px;color:${t.muted};font-weight:500;direction:rtl}
    </style>
    <div class="qmark">”</div>
    <div class="quote" style="font-size:${size}px">${esc(q.text)}</div>
    ${q.cite ? `<div class="cite">${esc(q.cite)}</div>` : ''}
    ${post.podcast ? `<div class="share-src">מתוך «<b>${esc(post.podcast)}</b>»</div>` : ''}
    <div class="share-card">
      <div class="share-qr">${qrSvg}</div>
      <div class="share-txt">
        <div class="share-lbl">התקציר המלא באתר</div>
        <div class="share-url">${esc(url)}</div>
        ${stat ? `<div class="share-stat">${stat}</div>` : ''}
      </div>
    </div>`;

  // Custom slide (not storySlide): extra top/bottom spacers keep everything
  // inside Instagram's story safe zone (~250px is covered top & bottom).
  const body = `<div style="height:100px"></div>
    ${header(post.category)}
    <div class="main">${inner}</div>
    <div class="foot" style="justify-content:center">${waveform()}</div>
    <div style="height:130px"></div>`;
  return [{ name: 'story-share', html: doc({ ...STORY, body, dark: true }), ...STORY }];
}

export { BRAND, FEED, STORY };
