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
  ['Rubik', 800, 'Rubik-800.woff2'],
  ['Rubik', 900, 'Rubik-900.woff2'],
];

function buildFontCss() {
  return FONT_FACES.map(([family, weight, file, range]) => {
    const b64 = fs.readFileSync(path.join(FONTS_DIR, file)).toString('base64');
    const fmt = file.endsWith('.woff2') ? 'woff2' : 'woff';
    const ur = range ? `unicode-range:${range};` : '';
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/${fmt};base64,${b64}) format('${fmt}');${ur}}`;
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
      // Embed the fonts INSIDE the document before it parses. Injecting them
      // after load (addStyleTag) raced in CI: Chrome painted the big text with
      // a serif fallback and the screenshots shipped off-brand.
      const html = s.html.replace('<head>', `<head><style>${FONT_CSS}</style>`);
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
      // Load every weight with actual Hebrew+Latin sample text, then wait.
      await page.evaluate(async () => {
        const faces = [
          '400 100px Heebo', '500 100px Heebo', '700 100px Heebo',
          '500 100px Rubik', '700 100px Rubik', '800 100px Rubik', '900 100px Rubik',
        ];
        await Promise.all(faces.map((f) => document.fonts.load(f, 'אבג ABC').catch(() => {})));
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      });
      // Hard gate: verify every face actually resolves Hebrew glyphs.
      // Better to fail the run than to silently publish a fallback font.
      const fontsOk = await page.evaluate(() => {
        const specs = [
          '400 32px Heebo', '500 32px Heebo', '700 32px Heebo',
          '500 32px Rubik', '700 32px Rubik', '800 32px Rubik', '900 32px Rubik',
        ];
        return specs.every((f) => document.fonts.check(f, 'אבג'));
      });
      if (!fontsOk) {
        throw new Error('Hebrew webfonts failed to load in the render browser — refusing to render with a fallback font.');
      }
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
