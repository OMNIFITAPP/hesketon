import { fetchApifyTranscript } from './apify.mjs';

// Below this length we assume nothing real was pasted.
const MIN_TRANSCRIPT = 200;

/**
 * Resolve a transcript from the best available source, in order:
 *   1. Text pasted into the brief (manual phase).
 *   2. Apify, if APIFY_TOKEN is set (Phase 2).
 *   3. The free `youtube-transcript` package (no key; may be blocked).
 */
export async function resolveTranscript({ pasted, youtubeUrl, log = console }) {
  const clean = (pasted || '').trim();
  if (clean.length >= MIN_TRANSCRIPT) {
    return { transcript: clean, source: 'pasted' };
  }

  if (!youtubeUrl) {
    throw new Error('no transcript pasted and no youtubeUrl to fetch from');
  }

  // Phase 2: Apify (reliable, paid).
  if (process.env.APIFY_TOKEN) {
    try {
      log.info?.('  ↳ fetching transcript via Apify…');
      const t = await fetchApifyTranscript(youtubeUrl);
      if (t && t.length >= MIN_TRANSCRIPT) return { transcript: t, source: 'apify' };
      log.warn?.('Apify returned little/no text — falling back to the free fetcher');
    } catch (err) {
      log.warn?.(`Apify failed (${err.message}) — falling back to the free fetcher`);
    }
  }

  // Free fallback: youtube-transcript (works when captions are public).
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const items = await YoutubeTranscript.fetchTranscript(youtubeUrl);
    const t = items
      .map((i) => i.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (t.length >= MIN_TRANSCRIPT) return { transcript: t, source: 'youtube-transcript' };
  } catch (err) {
    log.warn?.(`free transcript fetch failed: ${err.message}`);
  }

  throw new Error('could not obtain a transcript automatically — paste it into the brief body instead');
}
