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
import { assertWebfontCoverage } from './font-gate.mjs';

const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');

// Build @font-face CSS from the bundled font files (base64 data URIs) so
// rendering never depends on a font CDN being reachable.
//
// ⚠️ Every file here must actually CARRY HEBREW. Until 2026-09-13 six of the
// seven were Latin-only subsets. document.fonts.check() still passed, and every
// feed post — plus the reel wordmark, label and CTA — painted its Hebrew in the
// system font (Lucida Grande). Roei spotted it as "the quote font doesn't match
// the reels". assertWebfontCoverage() now proves coverage from what Chrome
// actually painted.
//
// Rubik: the one file with Hebrew is the ExtraBold cut, so it is registered
// across the whole weight range and every Rubik rule paints 800 — the weight
// the reels already use. Verified: identical ink at 400–900, no synthetic bold.
// Heebo: full static cuts vendored from Google Fonts (SIL OFL), Hebrew complete.
const FONT_FACES = [
  ['Heebo', 400, 'Heebo-400.ttf'],
  ['Heebo', 500, 'Heebo-500.ttf'],
  ['Heebo', 700, 'Heebo-700.ttf'],
  ['Heebo', 800, 'Heebo-800.ttf'],
  ['Heebo', 900, 'Heebo-900.ttf'],
  ['Rubik', '100 900', 'Rubik-800.woff2'],
];

function buildFontCss() {
  return FONT_FACES.map(([family, weight, file, range]) => {
    const b64 = fs.readFileSync(path.join(FONTS_DIR, file)).toString('base64');
    const ext = path.extname(file).slice(1);
    const fmt = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }[ext];
    if (!fmt) throw new Error(`unsupported font file: ${file}`);
    const ur = range ? `unicode-range:${range};` : '';
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/${ext};base64,${b64}) format('${fmt}');${ur}}`;
  }).join('\n');
}

const FONT_CSS = buildFontCss();

/** The same @font-face block, for other renderers (reels) to embed. */
export function fontCss() {
  return FONT_CSS;
}

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
    // chrome-headless-shell, not full "new" headless: on macOS the full browser
    // stops producing frames once the display sleeps, and every screenshot then
    // hangs to protocolTimeout (2026-09-13 — batches run unattended).
    headless: 'shell',
    // Tall reel frames (2160×3840) occasionally exceeded the default CDP
    // deadline on screenshot capture; give it room rather than fail a batch.
    protocolTimeout: 300000,
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
          '400 100px Heebo', '500 100px Heebo', '700 100px Heebo', '800 100px Heebo', '900 100px Heebo',
          '800 100px Rubik',
        ];
        await Promise.all(faces.map((f) => document.fonts.load(f, 'אבג ABC').catch(() => {})));
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      });
      // Settle one more frame so the freshly-applied fonts are painted.
      await new Promise((r) => setTimeout(r, 250));
      // Hard gate on what Chrome actually PAINTED. A fonts.check() list used to
      // stand here and passed while the Hebrew was drawn in Lucida Grande.
      await assertWebfontCoverage(page, { label: `${prefix} · ${s.name}` });

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
