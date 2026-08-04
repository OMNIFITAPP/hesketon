// ============================================================
//  reel-v2.mjs — the whole reel as ONE timeline document.
//
//  v1 rendered a still per scene and let ffmpeg zoom it, which is why
//  the only motion was a Ken Burns push. Here the document contains
//  every scene at once and exposes `window.__reel.render(t)`, which
//  sets the exact visual state for time `t`. frames.mjs steps `t` by
//  1/fps and screenshots, so anything expressible in the browser is
//  expressible in the reel.
//
//  ── the contrast rule ──
//  Text NEVER animates opacity. On this dark ground a near-white at
//  0.6 opacity blends to ~#9a97a2 — the grey mush Roei caught. So
//  reveals are either MASKED (the word slides at full colour behind a
//  clipping edge) or STEPPED (instantly on). Colour may interpolate,
//  but only between two values that are both legible on the ground.
// ============================================================

const T = {
  bg: '#15131c',
  ink: '#edeaf2',
  muted: '#9893a6',
  line: '#2d2a38',
  accent: '#f06595',
  accentDim: '#2c1a24',
  invInk: '#15131c',
  invMuted: '#611233',
};

export const REEL = { width: 1080, height: 1920 };

/**
 * Motion constants, shared by the timeline maths and the in-page renderer so
 * the two can never drift apart.
 *   stagger  gap between consecutive word reveals
 *   maskDur  how long one word takes to slide in
 *   typeRate seconds per character while typing
 *   readRate characters per second a viewer can comfortably read on screen
 */
export const MOTION = {
  stagger: 0.035,
  maskDur: 0.34,
  typeRate: 0.048,
  readRate: 13,
  minHold: 1.6,
  tail: 0.3,
};

/** The text a scene actually puts on screen — what the viewer must read. */
export function sceneText(scene, post) {
  if (scene.type === 'stat') return `${scene.value} ${scene.text}`;
  if (scene.type === 'cta') return ctaText(scene, post);
  return scene.text || '';
}

export function ctaText(scene, post) {
  if (scene.text) return scene.text;
  const rt = Number(post?.readingTime) || 0;
  return rt ? `הפרק המלא — בתקציר של ${rt} דקות.` : 'הפרק המלא — בתקציר קצר אחד.';
}

/**
 * Give every scene the time it actually needs: however long the reveal takes,
 * PLUS time to read what was revealed. A fixed template ran the opening and
 * closing scenes past the viewer before they could finish the line.
 *
 * @returns {object[]} scenes with in/out set, plus a `total`
 */
export function layoutTimeline(scenes, post, opts = {}) {
  const m = { ...MOTION, ...opts };
  let t = 0;
  const out = scenes.map((s) => {
    const text = sceneText(s, post);
    const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
    const reveal = s.type === 'type'
      ? text.length * m.typeRate
      : 0.06 + (words - 1) * m.stagger + m.maskDur;
    const read = Math.max(m.minHold, text.length / m.readRate);
    const dur = reveal + read + m.tail;
    const scene = { ...s, in: +t.toFixed(3), out: +(t + dur).toFixed(3) };
    t += dur;
    return scene;
  });
  return { scenes: out, total: +t.toFixed(3) };
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Punctuation a highlight key shouldn't have to include. */
const strip = (w) => String(w).replace(/[.,—:;"'?!״׳]/g, '');

/**
 * A key that matches nothing yields a beat with no highlight — the reel still
 * renders, it just quietly loses the thing that points at the idea. Fail loudly
 * instead.
 */
function assertKey(text, key, kind) {
  const words = String(text).trim().split(/\s+/).map(strip);
  if (!words.includes(key)) {
    throw new Error(`${kind} key "${key}" not found in line: "${text}" (words: ${words.join('|')})`);
  }
}

/** Split a line into mask-reveal word spans. */
function words(text) {
  return String(text).trim().split(/\s+/)
    .map((w) => `<span class="mw"><b>${esc(w)}</b></span>`).join(' ');
}

/**
 * Same, but one word wrapped in a marker-sweep highlight.
 * `key` must appear in `text` exactly.
 */
function wordsWithMark(text, key) {
  assertKey(text, key, 'mark');
  return String(text).trim().split(/\s+/).map((w) => {
    const bare = strip(w);
    if (bare !== key) return `<span class="mw"><b>${esc(w)}</b></span>`;
    return `<span class="mw"><b><span class="mark"><span class="mark-bg"></span><span class="mark-tx">${esc(w)}</span></span></b></span>`;
  }).join(' ');
}

/**
 * Same, but one word gets the colour pop.
 * The pop class goes on the MASK, not inside it: the pop scales up from a
 * right origin, and anything scaled inside an overflow:hidden box gets its
 * leading edge clipped (this ate the "7" of 70% the first time round).
 */
function wordsWithPop(text, key) {
  assertKey(text, key, 'pop');
  return String(text).trim().split(/\s+/).map((w) => {
    const bare = strip(w);
    if (bare !== key) return `<span class="mw"><b>${esc(w)}</b></span>`;
    return `<span class="mw pop"><b>${esc(w)}</b></span>`;
  }).join(' ');
}

const waveform = (bars = 34) => `<div class="wave">${
  Array.from({ length: bars }, (_, i) => {
    const h = 18 + Math.round(40 * Math.abs(Math.sin(i * 1.7)) + 10 * Math.abs(Math.cos(i * 0.6)));
    return `<span style="height:${h}%"></span>`;
  }).join('')}</div>`;

/**
 * @param {object} post   parsed post (for guest / podcast / readingTime)
 * @param {object} sb     storyboard { total, scenes[] }
 * @param {string} fontCss  @font-face rules (from render.mjs)
 */
export function buildReelHtml(post, sb, fontCss) {
  const total = sb.total;
  const beats = sb.scenes.filter((s) => s.progress !== false).length;

  const scenesHtml = sb.scenes.map((s, i) => {
    const cls = ['scene', s.invert ? 'is-invert' : '', s.bare ? 'is-bare' : ''].filter(Boolean).join(' ');
    let inner = '';

    if (s.type === 'type') {
      const typeDur = (s.text || '').length * MOTION.typeRate;
      inner = `<p class="line type-line"><span class="typed" data-text="${esc(s.text)}" data-dur="${typeDur.toFixed(3)}"></span><span class="tcaret"></span></p>`;
    } else if (s.type === 'stat') {
      inner = `<p class="stat"><span class="mw pop"><b>${esc(s.value)}</b></span></p>
               <p class="line sub">${words(s.text)}</p>`;
    } else if (s.type === 'mark') {
      inner = `<p class="line">${wordsWithMark(s.text, s.key)}</p>`;
    } else if (s.type === 'pop') {
      inner = `<p class="line">${wordsWithPop(s.text, s.key)}</p>`;
    } else if (s.type === 'cta') {
      // Derived, not passed in: reading time comes from the post's own
      // frontmatter, and an omitted `text` previously rendered "undefined"
      // straight into a finished reel.
      inner = `<p class="line cta-ttl">${words(ctaText(s, post))}</p>
               <p class="cta-pill"><span class="mw"><b>קישור בביו</b></span></p>
               <p class="cta-url"><span class="mw"><b>hesketon.co.il</b></span></p>`;
    } else {
      inner = `<p class="line">${words(s.text)}</p>`;
    }

    return `<section class="${cls}" data-in="${s.in}" data-out="${s.out}" data-i="${i}">
      <div class="body">${inner}</div>
    </section>`;
  }).join('\n');

  const segs = Array.from({ length: beats }, () => '<b><i></i></b>').join('');

  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${REEL.width}px;height:${REEL.height}px;overflow:hidden}
body{
  background:radial-gradient(1250px 1250px at 88% 5%,#f0659524 0%,transparent 66%),${T.bg};
  color:${T.ink};font-family:'Heebo',sans-serif;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  position:relative;
}
/* ground flips whole-frame for the invert punch */
body.invert{background:${T.accent};color:${T.invInk}}

.frame{position:absolute;inset:44px;border:2px solid ${T.line};border-radius:44px;pointer-events:none;z-index:1}
body.invert .frame{border-color:#00000022}

/* ── chrome ── */
.chrome{position:absolute;inset:190px 88px auto;display:flex;align-items:center;justify-content:space-between;z-index:4}
.brand{font-family:'Rubik',sans-serif;font-weight:900;font-size:46px;color:${T.accent};letter-spacing:-.02em}
.brand i{color:${T.ink};font-style:normal}
body.invert .brand,body.invert .brand i{color:${T.invInk}}
.pill{font-family:'Rubik',sans-serif;font-weight:700;font-size:29px;background:${T.accentDim};color:${T.accent};padding:12px 28px;border-radius:99px}
body.invert .pill{background:${T.invInk};color:${T.accent}}

.foot{position:absolute;inset:auto 88px 210px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;z-index:4}
.attr{font-size:31px;color:${T.muted}}
.attr b{color:${T.ink};font-weight:700}
body.invert .attr{color:${T.invMuted}}
body.invert .attr b{color:${T.invInk}}
.wave{display:flex;align-items:flex-end;gap:8px;height:54px;width:300px}
.wave span{flex:1;background:${T.accent};border-radius:6px;min-height:8px}
body.invert .wave span{background:${T.invInk}}

/* ── segmented progress ── */
.seg{position:absolute;inset:96px 88px auto;display:flex;gap:10px;z-index:5}
.seg b{flex:1;height:8px;border-radius:4px;background:#ffffff26;overflow:hidden;display:block}
.seg b i{display:block;height:100%;width:0;background:${T.accent};border-radius:4px}
body.invert .seg b{background:#00000026}
body.invert .seg b i{background:${T.invInk}}

/* ── scenes ── */
.scene{position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;
  padding:330px 88px 380px;z-index:3}
.scene .body{width:100%}

.line{font-family:'Rubik',sans-serif;font-weight:800;font-size:74px;line-height:1.3}
.sub{font-size:46px;font-weight:700;line-height:1.4;color:${T.ink}}
/* 148, not 172: the keyword pop scales this by 1.11 from a right origin, and
   at 172 the scaled "70%–45%" ran past the safe area into the frame border.
   Budget the pop into the type size, not the other way round. */
.stat{font-family:'Rubik',sans-serif;font-weight:900;font-size:148px;line-height:1.05;margin-bottom:26px}
.type-line{font-size:80px}
.cta-ttl{font-size:78px;margin-bottom:44px}
.cta-pill{display:inline-block;font-family:'Rubik',sans-serif;font-weight:700;font-size:42px;
  background:${T.accent};color:#fff;padding:28px 56px;border-radius:99px}
.cta-url{font-family:'Rubik',sans-serif;font-weight:900;font-size:52px;color:${T.accent};
  direction:ltr;text-align:right;margin-top:40px}

/* the mask primitive — padding gives ק ן ף room so nothing is clipped */
.mw{display:inline-block;overflow:hidden;vertical-align:bottom;
  padding:.06em .04em .2em;margin:-.06em -.04em -.2em}
.mw b{display:inline-block;font-weight:inherit;will-change:transform}
/* the popped word swells, so it needs real air around it — without this the
   scaled box touches its neighbours */
.mw.pop{margin-inline:.12em}

/* marker sweep: a real element, not ::before, so render(t) can drive it */
.mark{position:relative;display:inline-block;padding:0 .14em}
/* no horizontal bleed: the .14em padding on .mark already gives the highlight
   breathing room, and an outward inset pushed it past the safe edge */
.mark-bg{position:absolute;inset:.06em 0 .04em;background:${T.accent};border-radius:6px;
  transform-origin:right center;transform:scaleX(0)}
.mark-tx{position:relative}

.typed{white-space:pre-wrap}
.tcaret{display:inline-block;width:.07em;height:.92em;background:${T.accent};
  vertical-align:-.1em;margin-inline-start:.08em}
</style></head><body>
<div class="frame"></div>
<div class="seg">${segs}</div>
<div class="chrome"><span class="brand">הסכתון<i>.</i></span><span class="pill">${esc(sb.kicker || 'אמ;לק')}</span></div>
${scenesHtml}
<div class="foot">
  <span class="attr">${post.guest ? `<b>${esc(post.guest)}</b>` : ''}${post.guest && post.podcast ? ' · ' : ''}${esc(post.podcast || '')}</span>
  ${waveform()}
</div>

<script>
(function(){
  var TOTAL = ${total};
  var scenes = [].slice.call(document.querySelectorAll('.scene'));
  var body = document.body;
  var chrome = document.querySelector('.chrome');
  var foot = document.querySelector('.foot');
  var seg = document.querySelector('.seg');
  var segBars = [].slice.call(document.querySelectorAll('.seg b i'));
  var beatIns = ${JSON.stringify(sb.scenes.filter(s=>s.progress!==false).map(s=>[s.in,s.out]))};

  var clamp = function(x){ return x < 0 ? 0 : x > 1 ? 1 : x; };
  // easeOutQuint — lands hard, which is what makes a reveal feel cut rather than drifted
  var ease = function(p){ return 1 - Math.pow(1 - p, 5); };

  function setMasks(scene, t0, stagger, dur){
    var mws = scene.querySelectorAll('.mw b');
    for (var i = 0; i < mws.length; i++){
      var p = clamp((t0 - i * stagger) / dur);
      // full colour at all times; only position changes
      mws[i].style.transform = 'translateY(' + ((1 - ease(p)) * 115).toFixed(3) + '%)';
    }
  }

  window.__reel = {
    duration: TOTAL,
    render: function(t){
      var active = null;
      for (var i = 0; i < scenes.length; i++){
        var s = scenes[i];
        var tin = parseFloat(s.dataset.in), tout = parseFloat(s.dataset.out);
        var on = t >= tin && t < tout;
        s.style.display = on ? 'flex' : 'none';   // hard cut, never a dissolve
        if (on) active = s;
      }
      if (!active) return;

      var tin = parseFloat(active.dataset.in);
      var local = t - tin;
      var isBare = active.classList.contains('is-bare');
      var isInv = active.classList.contains('is-invert');

      // chrome is hidden during the cold open, then simply present
      var chromeOn = !isBare;
      chrome.style.display = chromeOn ? 'flex' : 'none';
      foot.style.display = chromeOn ? 'flex' : 'none';
      seg.style.display = chromeOn ? 'flex' : 'none';
      body.classList.toggle('invert', isInv);

      // segmented progress: each beat fills across its own span
      for (var k = 0; k < segBars.length; k++){
        var b = beatIns[k];
        var p = clamp((t - b[0]) / (b[1] - b[0]));
        segBars[k].style.width = (p * 100).toFixed(2) + '%';
      }

      // typing — stepped by character, so every glyph is instantly full contrast
      var typed = active.querySelector('.typed');
      if (typed){
        var txt = typed.dataset.text;
        var dur = parseFloat(typed.dataset.dur) || 1.05;   // scales with length
        var n = Math.floor(clamp(local / dur) * txt.length);
        typed.textContent = txt.slice(0, n);
        var caret = active.querySelector('.tcaret');
        if (caret){
          var done = local >= dur;
          // solid while typing, blinking once finished
          caret.style.visibility = (!done || Math.floor((local - dur) * 2.4) % 2 === 0) ? 'visible' : 'hidden';
        }
      }

      setMasks(active, local - 0.06, ${MOTION.stagger}, ${MOTION.maskDur});

      // marker sweep
      var bg = active.querySelector('.mark-bg');
      if (bg){
        var sp = clamp((local - 0.85) / 0.38);
        bg.style.transform = 'scaleX(' + ease(sp).toFixed(4) + ')';
        var tx = active.querySelector('.mark-tx');
        if (tx) tx.style.color = sp > 0.55 ? '${T.invInk}' : '${T.ink}';
      }

      // keyword colour pop — both endpoints legible, so the tween is safe
      var pop = active.querySelector('.pop');
      if (pop){
        var pp = clamp((local - 0.9) / 0.3);
        var c0 = [0xed,0xea,0xf2], c1 = [0xf0,0x65,0x95];
        if (isInv){ c0 = [0x15,0x13,0x1c]; c1 = [0x15,0x13,0x1c]; }
        var e = ease(pp);
        var mix = c0.map(function(c, idx){ return Math.round(c + (c1[idx] - c) * e); });
        pop.style.color = 'rgb(' + mix.join(',') + ')';
        // pop is the .mw itself, so the clip box scales with the glyphs and
        // nothing is shaved off the leading edge.
        // Origin is CENTRE, not right: a right origin grows the word leftward
        // only, and in RTL that is straight into the next word — "הדופק:" ran
        // over "אם". Centre splits the growth, the scale is gentler, and .pop
        // carries its own inline margin so the swollen box still keeps clear.
        pop.style.transform = 'scale(' + (1 + 0.06 * e).toFixed(4) + ')';
        pop.style.transformOrigin = 'center center';
      }
    }
  };
  window.__reel.render(0);
})();
</script>
</body></html>`;
}
