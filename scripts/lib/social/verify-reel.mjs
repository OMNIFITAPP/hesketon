// ============================================================
//  verify-reel.mjs — pixel gate for a reel timeline.
//
//  Layout maths lies. getBoundingClientRect reports the layout box,
//  which misses two things that actually bit us:
//    · overflow:hidden on the mask silently CLIPPING glyph ink, and
//    · a transform pushing ink OUTSIDE the safe area.
//  Both are invisible to the DOM and obvious in pixels. So this walks
//  the timeline, samples real frames, and measures where the ink is.
//
//  Also asserts the contrast rule: any text pixel must be far enough
//  from the ground it sits on to be legible.
// ============================================================

import puppeteer from 'puppeteer';

const SAFE = { left: 88, right: 992, top: 150, bottom: 1780 };

// Elements that carry reader-facing text. Decorative chrome (frame border,
// progress track, waveform) is deliberately faint and is not judged here.
const SEL = '.line, .stat, .sub, .cta-ttl, .cta-pill, .cta-url, .typed, .attr, .brand, .pill';

/**
 * @param {string} html
 * @param {object} o
 * @param {number} o.duration
 * @param {number} [o.step=0.2]  seconds between samples
 * @param {number} o.width
 * @param {number} o.height
 * @returns {Promise<{samples:number, violations:object[]}>}
 */
export async function verifyReel(html, { duration, step = 0.2, width, height }) {
  const browser = await puppeteer.launch({
    headless: 'new', protocolTimeout: 300000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });
  const violations = [];
  let samples = 0;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });

    // Placeholder leakage: a missing storyboard field renders the literal
    // string "undefined" into a finished reel. Cheap to check, expensive to miss.
    const junk = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('.scene')) {
        const txt = el.textContent;
        for (const w of ['undefined', 'null', 'NaN', '[object']) {
          if (txt.includes(w)) bad.push({ scene: el.dataset.i, word: w, text: txt.trim().slice(0, 80) });
        }
      }
      return bad;
    });
    for (const j of junk) violations.push({ t: -1, issues: [`placeholder "${j.word}" in scene ${j.scene}: ${j.text}`] });

    for (let t = 0; t <= duration; t += step) {
      await page.evaluate((tt) => window.__reel.render(tt), t);
      const shot = await page.screenshot({ encoding: 'base64' });
      const r = await page.evaluate(async (b64, SAFE, SEL) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, img.width, img.height).data;

        // Ground truth for "background": sample a corner well inside the frame
        // but away from any content.
        const gi = (60 * img.width + 60) * 4;
        const bg = [d[gi], d[gi + 1], d[gi + 2]];
        const dist = (i) => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);

        // Only judge TEXT. The frame border and the progress track are
        // deliberately faint decoration; scanning every ink pixel flagged
        // them as low-contrast text, which they are not.
        const boxes = [];
        for (const el of document.querySelectorAll(SEL)) {
          if (!el.textContent.trim()) continue;
          if (!el.getClientRects().length) continue;
          const sc = el.closest('.scene');
          if (sc && sc.style.display === 'none') continue;
          const r = el.getBoundingClientRect();
          // pad outward so scaled/overhanging glyph ink is included
          boxes.push({
            x0: Math.max(0, Math.floor(r.left) - 30), y0: Math.max(0, Math.floor(r.top) - 20),
            x1: Math.min(img.width, Math.ceil(r.right) + 30), y1: Math.min(img.height, Math.ceil(r.bottom) + 20),
          });
        }

        const lum = (r0, g0, b0) => 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
        const bgLum = lum(bg[0], bg[1], bg[2]);
        let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, inkPixels = 0;
        // Histogram of ink colours. Glyph edges are antialiased blends, so a
        // MINIMUM contrast is always ~0 and meaningless; the dominant colour
        // is the actual text colour and the thing a viewer reads.
        const hist = new Map();

        for (const b of boxes) {
          for (let y = b.y0; y < b.y1; y++) {
            for (let x = b.x0; x < b.x1; x++) {
              const i = (y * img.width + x) * 4;
              if (dist(i) <= 70) continue;             // ground or gradient
              inkPixels++;
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
              const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
              hist.set(key, (hist.get(key) || 0) + 1);
            }
          }
        }

        let bestKey = -1, bestN = 0;
        for (const [k, n] of hist) if (n > bestN) { bestN = n; bestKey = k; }
        let inkContrast = 999, inkRgb = null;
        if (bestKey >= 0) {
          inkRgb = [((bestKey >> 10) & 31) << 3, ((bestKey >> 5) & 31) << 3, (bestKey & 31) << 3];
          inkContrast = Math.abs(lum(inkRgb[0], inkRgb[1], inkRgb[2]) - bgLum);
        }
        return { minX, maxX, minY, maxY, inkContrast, inkRgb, inkPixels, bg };
      }, shot, SAFE, SEL);

      samples++;
      if (r.maxX < 0) continue;                        // empty frame, nothing to check

      const issues = [];
      if (r.minX < SAFE.left) issues.push(`ink left ${r.minX} < ${SAFE.left}`);
      if (r.maxX > SAFE.right) issues.push(`ink right ${r.maxX} > ${SAFE.right}`);
      if (r.minY < SAFE.top) issues.push(`ink top ${r.minY} < ${SAFE.top}`);
      if (r.maxY > SAFE.bottom) issues.push(`ink bottom ${r.maxY} > ${SAFE.bottom}`);
      // 40 is roughly where large display type stops reading cleanly on this ground
      if (r.inkContrast < 40) issues.push(`low-contrast text (gap ${r.inkContrast.toFixed(0)}, ink rgb(${r.inkRgb}))`);

      if (issues.length) violations.push({ t: +t.toFixed(2), issues });
    }
  } finally {
    await browser.close();
  }

  return { samples, violations };
}
