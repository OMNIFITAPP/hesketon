// ============================================================
//  font-gate.mjs — prove every glyph paints in an EMBEDDED font.
//
//  document.fonts.check() only confirms a face is loaded. It never
//  looks inside the file, so it passed while six of the seven embedded
//  woff2 files carried no Hebrew at all — and every feed post, plus the
//  reel wordmark, label and CTA, rendered its Hebrew in Lucida Grande.
//
//  Chrome's CSS.getPlatformFontsForNode reports the font that actually
//  drew each run of text. That is the only signal that catches a face
//  which is present but missing the glyphs.
// ============================================================

// Emoji are intentionally drawn by the system (🔗 in "קישור בביו").
const ALLOWED_SYSTEM = /emoji/i;

/**
 * Throw if any visible glyph on the page was painted by a system font.
 * Hidden elements report no fonts, so for timeline documents call this
 * once per rendered state.
 */
export async function assertWebfontCoverage(page, { label = 'page' } = {}) {
  const cdp = await page.target().createCDPSession();
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'body *' });
    const bad = new Map();
    for (const nodeId of nodeIds) {
      let fonts;
      try { ({ fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })); } catch { continue; }
      for (const f of fonts) {
        if (f.isCustomFont || ALLOWED_SYSTEM.test(f.familyName)) continue;
        bad.set(f.familyName, (bad.get(f.familyName) || 0) + f.glyphCount);
      }
    }
    if (bad.size) {
      const detail = [...bad].map(([n, c]) => `${n}×${c}`).join(', ');
      throw new Error(
        `${label}: glyphs painted by a SYSTEM font instead of the embedded brand fonts — ${detail}. ` +
        'An embedded face is missing those glyphs; check the file actually covers the script.',
      );
    }
  } finally {
    await cdp.detach().catch(() => {});
  }
}
