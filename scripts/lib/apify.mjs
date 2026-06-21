// ============================================================
//  Phase 2 — fetch a YouTube transcript via an Apify actor.
//  Configure APIFY_TOKEN and APIFY_ACTOR in .env (or repo secrets).
// ============================================================

const DEFAULT_ACTOR = 'pintostudio~youtube-transcript-scraper';

export async function fetchApifyTranscript(youtubeUrl) {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_ACTOR || DEFAULT_ACTOR;
  if (!token) throw new Error('APIFY_TOKEN is not set.');

  // run-sync-get-dataset-items runs the actor and returns its output in one call.
  const endpoint = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token,
  )}`;

  // Different transcript actors expect different input keys; send the common ones.
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoUrl: youtubeUrl,
      url: youtubeUrl,
      youtubeUrl,
      startUrls: [{ url: youtubeUrl }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Apify error ${res.status}: ${body.slice(0, 300)}`);
  }

  const items = await res.json();
  return extractTranscriptText(items);
}

/** Normalize the many possible output shapes into one transcript string. */
function extractTranscriptText(items) {
  const arr = Array.isArray(items) ? items : [items];
  const parts = [];
  for (const item of arr) {
    if (!item) continue;
    if (typeof item.transcript === 'string') parts.push(item.transcript);
    else if (Array.isArray(item.transcript)) parts.push(item.transcript.map((s) => s?.text ?? s).join(' '));
    else if (Array.isArray(item.captions)) parts.push(item.captions.map((s) => s?.text ?? s).join(' '));
    else if (typeof item.text === 'string') parts.push(item.text);
  }
  return parts.join('\n').trim();
}
