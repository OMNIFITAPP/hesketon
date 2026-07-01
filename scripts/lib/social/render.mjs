// ============================================================
//  render.mjs — turn slide HTML into PNG files via headless Chrome.
//  One browser, many pages. Waits for web-fonts (Rubik/Heebo) to
//  load so Hebrew RTL renders correctly before the screenshot.
//
//  Phase B (reels) will add an ffmpeg compositor here.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');

// Build @font-face CSS from the bundled woff2 files (base64 data URIs) so
// rendering never depends on a font CDN being reachable.
const FONT_FACES = [
  ['Heebo', 400, 'Heebo-400.woff2'],
  ['Heebo', 500, 'Heebo-500.woff2'],
  ['Heebo', 700, 'Heebo-700.woff2'],
  ['Rubik', 500, 'Rubik-500.woff2'],
  ['Rubik', 700, 'Rubik-700.woff2'],
  ['Rubik', 900, 'Rubik-900.woff2'],
];

function buildFontCss() {
  return FONT_FACES.map(([family, weight, file]) => {
    const b64 = fs.readFileSync(path.join(FONTS_DIR, file)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  }).join('\n');
}

const FONT_CSS = buildFontCss();

/**
 * Render an array of slides ({ name, html, width, height }) to PNGs.
 * @param {object[]} slides
 * @param {string} outDir  absolute output directory
 * @param {string} prefix  filename prefix (usually the slug)
 * @returns {Promise<string[]>} written file paths
 */
export async function renderSlides(slides, outDir, prefix) {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  });

  const written = [];
  try {
    for (let i = 0; i < slides.length; i++) {
      const s = slides[i];
      const page = await browser.newPage();
      // Render at 2× so Hebrew text is crisp (1× smears letters at this size);
      // Instagram happily downscales the larger PNG.
      await page.setViewport({ width: s.width, height: s.height, deviceScaleFactor: 2 });
      await page.setContent(s.html, { waitUntil: 'load', timeout: 60000 });
      // Inject the bundled fonts (local base64 → no network), then wait until
      // they're parsed and ready before shooting so Hebrew RTL renders right.
      await page.addStyleTag({ content: FONT_CSS });
      // Explicitly load each weight, then wait for the font set — addStyleTag
      // alone can resolve before the @font-face rules are actually usable.
      await page.evaluate(async () => {
        const faces = [
          '400 100px Heebo', '500 100px Heebo', '700 100px Heebo',
          '500 100px Rubik', '700 100px Rubik', '900 100px Rubik',
        ];
        await Promise.all(faces.map((f) => document.fonts.load(f).catch(() => {})));
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      });
      // Settle one more frame so the freshly-applied fonts are painted.
      await new Promise((r) => setTimeout(r, 250));

      const file = path.join(outDir, `${prefix}-${String(i + 1).padStart(2, '0')}-${s.name}.png`);
      // No `clip`: the viewport already equals the slide size, and clip +
      // captureBeyondViewport can capture a blank frame. Full-page = exact size.
      await page.screenshot({ path: file, type: 'png' });
      await page.close();
      written.push(file);
    }
  } finally {
    await browser.close();
  }
  return written;
}
