// ============================================================
//  templates-reel.mjs — vertical 1080×1920 scenes for Reels (Phase B).
//
//  Hebrew is RTL, so ffmpeg's drawtext can't shape it. Instead each
//  scene is rendered to a PNG through the same Puppeteer pipeline as
//  the feed slides (render.mjs injects the Heebo/Rubik woff2), and
//  video.mjs animates the stills with ffmpeg.
//
//  Dark palette: the vertical treatment already used by stories, and
//  it reads better in a dark-dominant Reels feed.
//
//  Safe zones: Instagram overlays the top ~120px (profile) and bottom
//  ~400px (caption, audio, action rail). All content sits between.
// ============================================================

const T = {
  bg: '#15131c',
  surface: '#1e1b28',
  ink: '#edeaf2',
  inkSoft: '#c6c1d2',
  muted: '#9893a6',
  line: '#2d2a38',
  accent: '#f06595',
  accentSoft: '#2c1a24',
};

const REEL = { width: 1080, height: 1920 };

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function waveform(bars = 34) {
  const cells = Array.from({ length: bars }, (_, i) => {
    const h = 18 + Math.round(40 * Math.abs(Math.sin(i * 1.7)) + 10 * Math.abs(Math.cos(i * 0.6)));
    return `<span style="height:${h}%"></span>`;
  }).join('');
  return `<div class="wave">${cells}</div>`;
}

function doc(body) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${REEL.width}px;height:${REEL.height}px}
  body{
    /* The corner glow is painted into the body background on purpose. As its
       own positioned div it became a separate composited layer, and at
       2160×3840 that intermittently hung Chrome's screenshot capture. */
    background:radial-gradient(1200px 1200px at 88% 6%,${T.accent}22 0%,transparent 68%),${T.bg};
    color:${T.ink};
    font-family:'Heebo',system-ui,sans-serif;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
    display:flex;flex-direction:column;
    /* top/bottom padding keeps content clear of Instagram's UI overlays */
    padding:190px 88px 400px;position:relative;overflow:hidden;
  }
  .frame{position:absolute;inset:44px;border:2px solid ${T.line};border-radius:44px;pointer-events:none}
  .head{display:flex;align-items:center;justify-content:space-between;gap:20px;z-index:2}
  .brand{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:44px;color:${T.accent};letter-spacing:-.5px}
  .brand .dot{color:${T.ink}}
  .kicker{font-family:'Rubik','Heebo',sans-serif;font-weight:700;font-size:28px;
    background:${T.accentSoft};color:${T.accent};padding:12px 26px;border-radius:999px}
  .main{flex:1;display:flex;flex-direction:column;justify-content:center;z-index:2}
  .foot{display:flex;align-items:center;justify-content:space-between;gap:20px;z-index:2}
  .src{font-size:30px;color:${T.muted};font-weight:500}
  .src b{color:${T.ink};font-weight:700}
  .wave{display:flex;align-items:flex-end;gap:8px;height:52px;width:300px;opacity:.85}
  .wave span{flex:1;background:${T.accent};border-radius:6px;min-height:8px}
  /* hook */
  .qmark{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:190px;line-height:.6;
    color:${T.accent};opacity:.28;height:112px}
  .quote{font-family:'Rubik','Heebo',sans-serif;font-weight:800;line-height:1.3}
  .cite{margin-top:52px;font-size:38px;font-weight:700;color:${T.accent}}
  .cite::before{content:'— '}
  /* beat */
  .idx{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:150px;
    color:${T.accent};opacity:.32;line-height:1;margin-bottom:16px}
  .beat{font-family:'Rubik','Heebo',sans-serif;font-weight:700;line-height:1.38}
  /* cta */
  .cta-ttl{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:82px;line-height:1.14;margin-bottom:40px}
  .cta-pill{display:inline-block;font-family:'Rubik','Heebo',sans-serif;font-weight:700;font-size:42px;
    background:${T.accent};color:#fff;padding:30px 58px;border-radius:999px}
  .cta-sub{font-size:36px;color:${T.muted};margin-top:44px;font-weight:500}
  .cta-url{font-family:'Rubik','Heebo',sans-serif;font-weight:900;font-size:46px;color:${T.accent};
    direction:ltr;text-align:right;margin-top:18px}
</style></head><body>
<div class="frame"></div>
${body}
</body></html>`;
}

function head(kicker) {
  return `<div class="head">
    <div class="brand">הסכתון<span class="dot">.</span></div>
    ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}
  </div>`;
}

function foot(post, { showSrc = true } = {}) {
  const src = showSrc && (post.guest || post.podcast)
    ? `<div class="src">${post.guest ? `<b>${esc(post.guest)}</b>` : ''}${post.guest && post.podcast ? ' · ' : ''}${esc(post.podcast)}</div>`
    : '<div class="src"></div>';
  return `<div class="foot">${src}${waveform()}</div>`;
}

/**
 * How long a scene should stay up, from how much there is to read.
 * Hebrew at a comfortable social-video pace is ~16 chars/sec, plus a
 * beat to register the scene change. Clamped so nothing flashes past
 * or overstays.
 */
function readSeconds(text, { base = 2.4, min = 3.2, max = 6.5 } = {}) {
  const secs = base + String(text || '').length / 16;
  return +Math.min(max, Math.max(min, secs)).toFixed(2);
}

/** Type scale that shrinks as the line gets longer, so nothing overflows. */
function fit(text, { max, min, longAt }) {
  const n = String(text || '').length;
  if (n <= longAt) return max;
  const shrunk = Math.round(max - ((n - longAt) / longAt) * (max - min));
  return Math.max(min, shrunk);
}

function hookScene(post, { kicker = 'ציטוט' } = {}) {
  const q = post.lead;
  const size = fit(q.text, { max: 78, min: 48, longAt: 90 });
  const body = `${head(kicker)}
    <div class="main">
      <div class="qmark">”</div>
      <div class="quote" style="font-size:${size}px">${esc(q.text)}</div>
      ${q.cite ? `<div class="cite">${esc(q.cite)}</div>` : ''}
    </div>
    ${foot(post)}`;
  return { name: '01-hook', html: doc(body), seconds: readSeconds(q.text, { base: 3.0, min: 4.0 }), ...REEL };
}

function beatScene(post, text, idx, { kicker } = {}) {
  const size = fit(text, { max: 66, min: 42, longAt: 95 });
  const body = `${head(kicker)}
    <div class="main">
      <div class="idx">${String(idx).padStart(2, '0')}</div>
      <div class="beat" style="font-size:${size}px">${esc(text)}</div>
    </div>
    ${foot(post)}`;
  return { name: `b${String(idx).padStart(2, '0')}`, html: doc(body), seconds: readSeconds(text), ...REEL };
}

function ctaScene(post) {
  // Reading time comes from the post's own frontmatter — never hardcode a
  // number here, it differs per episode and would be a false claim.
  const rt = Number(post.readingTime) || 0;
  const ttl = rt
    ? `הפרק המלא —<br>בתקציר של ${rt} דקות.`
    : 'הפרק המלא —<br>בתקציר קצר אחד.';
  const body = `${head('')}
    <div class="main">
      <div class="cta-ttl">${ttl}</div>
      <div><span class="cta-pill">קישור בביו 🔗</span></div>
      <div class="cta-sub">תקצירים חכמים מהפודקאסטים הכי טובים</div>
      <div class="cta-url">hesketon.co.il</div>
    </div>
    ${foot(post, { showSrc: false })}`;
  return { name: '99-cta', html: doc(body), seconds: 3.6, ...REEL };
}

/**
 * Build the scene list for one reel.
 * hook → up to `beats` tl;dr beats → CTA.
 * @returns {object[]} scenes for renderSlides()
 */
export function buildReelScenes(post, { kicker = 'ציטוט', beats = 4 } = {}) {
  if (!post.lead?.text) throw new Error(`no lead quote: ${post.slug}`);
  const source = post.tldr?.length ? post.tldr : (post.takeaways || []).map((t) => t.body);
  const picks = source.slice(0, beats);
  const scenes = [hookScene(post, { kicker })];
  let i = 1;
  for (const b of picks) scenes.push(beatScene(post, b, i++, { kicker: 'אמ;לק' }));
  scenes.push(ctaScene(post));
  return scenes;
}

export { REEL, T as REEL_THEME };
