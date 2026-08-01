// ============================================================
//  frames.mjs — drive a reel timeline document frame by frame.
//
//  Calls window.__reel.render(t) for t = 0, 1/fps, 2/fps … and
//  screenshots each state. Deterministic: nothing depends on wall
//  clock or on CSS animations settling, so a rerun is byte-stable.
//
//  Captured at 2× and downscaled by ffmpeg — supersampling is what
//  keeps Hebrew crisp at 1080 wide.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

/**
 * @param {string} html   full reel document (from reel-v2.buildReelHtml)
 * @param {object} o
 * @param {number} o.duration seconds
 * @param {number} [o.fps=30]
 * @param {number} o.width
 * @param {number} o.height
 * @param {string} o.outDir
 * @param {(n:number,total:number)=>void} [o.onProgress]
 * @returns {Promise<{dir:string, count:number, pattern:string}>}
 */
export async function renderFrames(html, { duration, fps = 30, width, height, outDir, onProgress }) {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 300000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  const total = Math.round(duration * fps);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 });

    await page.evaluate(async () => {
      const faces = ['400 100px Heebo', '700 100px Heebo', '800 100px Rubik', '900 100px Rubik'];
      await Promise.all(faces.map((f) => document.fonts.load(f, 'אבג ABC').catch(() => {})));
      if (document.fonts?.ready) await document.fonts.ready;
    });

    // Same hard gate as the slide renderer: a fallback font is worse than a failure.
    const fontsOk = await page.evaluate(() =>
      ['400 32px Heebo', '700 32px Heebo', '800 32px Rubik', '900 32px Rubik']
        .every((f) => document.fonts.check(f, 'אבג')));
    if (!fontsOk) throw new Error('Hebrew webfonts failed to load — refusing to render with a fallback font.');

    const hasRender = await page.evaluate(() => typeof window.__reel?.render === 'function');
    if (!hasRender) throw new Error('reel document did not expose window.__reel.render');

    for (let i = 0; i < total; i++) {
      const t = i / fps;
      await page.evaluate((tt) => window.__reel.render(tt), t);
      await page.screenshot({
        path: path.join(outDir, `f${String(i).padStart(5, '0')}.jpg`),
        type: 'jpeg',
        quality: 95,       // intermediate only; the 2× downscale hides any artefact
        optimizeForSpeed: true,
      });
      if (onProgress && (i % 30 === 0 || i === total - 1)) onProgress(i + 1, total);
    }
  } finally {
    await browser.close();
  }

  return { dir: outDir, count: total, pattern: path.join(outDir, 'f%05d.jpg') };
}
