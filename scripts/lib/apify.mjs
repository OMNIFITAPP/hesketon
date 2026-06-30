// ============================================================
//  Phase 2 — fetch a YouTube transcript via an Apify actor.
//  Configure APIFY_TOKEN in repo secrets; APIFY_ACTOR in repo variables.
//
//  Default: codepoetry~youtube-transcript-ai-scraper
//    → uses YouTube captions when available, Whisper AI when not.
//    → works for videos with disabled CC (podcasts, interviews).
//    Cost: ~$0.001 captions / $0.012/min Whisper on Apify free tier.
// ============================================================

const DEFAULT_ACTOR = 'codepoetry~youtube-transcript-ai-scraper';
const POLL_INTERVAL_MS = 20_000;        // 20 s between status polls
const MAX_WAIT_MS     = 35 * 60_000;   // 35 min ceiling (8× realtime, 3 hr video ≈ 23 min)
const MIN_USABLE_CHARS = 200;          // below this we treat the run as "empty"
const MAX_ATTEMPTS     = 2;            // a SUCCEEDED-but-empty run is usually transient (Whisper flaked)

/**
 * Fetch a transcript via Apify. An actor run can finish SUCCEEDED yet return
 * no text (Whisper occasionally flakes on a perfectly valid video — this is
 * what happened to the Jiang episode). When that happens we retry once before
 * giving up, so one bad roll of the dice doesn't kill the post.
 */
export async function fetchApifyTranscript(youtubeUrl) {
  let lastDiag = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { text, diag } = await runOnce(youtubeUrl, attempt);
    if (text.length >= MIN_USABLE_CHARS) return text;
    lastDiag = diag;
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`  ⚠️  Apify run returned no usable text (${diag}) — retrying (${attempt + 1}/${MAX_ATTEMPTS})`);
    }
  }
  throw new Error(`Apify returned no usable transcript after ${MAX_ATTEMPTS} attempts (${lastDiag})`);
}

async function runOnce(youtubeUrl, attempt) {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_ACTOR || DEFAULT_ACTOR;
  if (!token) throw new Error('APIFY_TOKEN is not set.');

  // Start the actor run (async — sync API times out after 5 min, too short for Whisper)
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/runs?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Common input keys across popular transcript actors
        startUrls:            [{ url: youtubeUrl }],
        youtubeUrl,
        url:                  youtubeUrl,
        videoUrl:             youtubeUrl,
        // Enable Whisper fallback on codepoetry actor
        enableAiTranscription: true,
        aiTranscription:       true,
      }),
    },
  );

  if (!startRes.ok) {
    const body = await startRes.text().catch(() => '');
    throw new Error(`Apify start error ${startRes.status}: ${body.slice(0, 300)}`);
  }

  const { data: run } = await startRes.json();
  const runId    = run.id;
  const deadline = Date.now() + MAX_WAIT_MS;

  process.stdout.write(`  ⏳ Apify run ${runId} started — polling`);

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    process.stdout.write('.');

    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`,
    );
    const { data: status } = await statusRes.json();

    if (status.status === 'SUCCEEDED') {
      process.stdout.write(' ✓\n');
      const dsRes  = await fetch(
        `https://api.apify.com/v2/datasets/${status.defaultDatasetId}/items?token=${encodeURIComponent(token)}`,
      );
      const items = await dsRes.json();
      const text  = extractTranscriptText(items);
      // When empty, report what the actor actually returned so the failure is
      // diagnosable from the run log instead of a silent "little/no text".
      const diag  = text.length >= MIN_USABLE_CHARS ? `${text.length} chars` : describeEmpty(items);
      return { text, diag };
    }

    if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(status.status)) {
      process.stdout.write('\n');
      throw new Error(`Apify run ended with status ${status.status}`);
    }
  }

  throw new Error(`Apify run ${runId} exceeded ${MAX_WAIT_MS / 60_000} min ceiling`);
}

/** Normalize many possible output shapes → one transcript string. */
function extractTranscriptText(items) {
  const arr   = Array.isArray(items) ? items : [items];
  const parts = [];
  for (const item of arr) {
    if (!item) continue;
    // codepoetry actor returns transcript_llm (clean, ready for LLMs)
    if (typeof item.transcript_llm === 'string')  { parts.push(item.transcript_llm);  continue; }
    if (typeof item.transcript     === 'string')  { parts.push(item.transcript);       continue; }
    if (Array.isArray(item.transcript))           { parts.push(item.transcript.map((s) => s?.text ?? s).join(' ')); continue; }
    if (Array.isArray(item.captions))             { parts.push(item.captions.map((s) => s?.text ?? s).join(' '));   continue; }
    if (typeof item.text           === 'string')  { parts.push(item.text);             continue; }
  }
  return parts.join('\n').trim();
}

/** Summarize an empty/unusable dataset for the log (item count, keys, any error). */
function describeEmpty(items) {
  const arr = Array.isArray(items) ? items : [items];
  if (arr.length === 0) return 'dataset empty (0 items)';
  const first = arr[0] || {};
  const keys = Object.keys(first).join(',') || 'no keys';
  const err = first.error || first.errorMessage || first.message;
  return `${arr.length} item(s); keys=[${keys}]${err ? `; error="${String(err).slice(0, 120)}"` : ''}`;
}
