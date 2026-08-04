// ============================================================
//  pick-audio.mjs — never score two reels with the same track twice.
//
//  The first two reel batches drew from a hand-picked list of seven ids,
//  so across 14 reels every single track ran exactly twice and the feed
//  started sounding repetitive. Freshness is now enforced by the code
//  rather than by whoever writes the batch.
//
//  The pool is a snapshot of Meta's third-party-cleared catalogue, taken
//  with `.github/workflows/ig-audio.yml`. Refresh it by re-running that
//  workflow with new single-word queries (search is literal, so single
//  words return far more than descriptive phrases).
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POOL = JSON.parse(fs.readFileSync(path.join(HERE, 'audio-pool.json'), 'utf8'));

/** Every audio id the queue has ever attached to a reel. */
export function usedAudioIds(queue) {
  return new Set((queue.items || []).map((i) => i?.audio?.audioId).filter(Boolean));
}

/** Pool entries not yet used anywhere in the queue. */
export function freshTracks(queue) {
  const used = usedAudioIds(queue);
  return POOL.filter((t) => !used.has(t.id));
}

/**
 * Assert a chosen set is fresh and internally unique.
 * Throws rather than warns: a duplicate track is exactly the kind of thing
 * that ships quietly and is only noticed a week later, in the feed.
 */
export function assertFresh(queue, ids) {
  const used = usedAudioIds(queue);
  const seen = new Set();
  for (const id of ids) {
    if (used.has(id)) throw new Error(`audio ${id} already used on another reel — pick a fresh one (${freshTracks(queue).length} available)`);
    if (seen.has(id)) throw new Error(`audio ${id} used twice within this batch`);
    seen.add(id);
  }
}

/** Look a track up for logging, so the batch can print what it chose. */
export function trackTitle(id) {
  return POOL.find((t) => t.id === id)?.title || '(not in pool)';
}

export { POOL };
