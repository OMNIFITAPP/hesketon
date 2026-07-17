// ============================================================
//  Build-time thumbnail resolution.
//
//  youtubeThumb() hands back the maxresdefault URL, which YouTube only
//  generates for videos uploaded at >=720p — older episodes 404. The
//  visible <img> tags paper over that with an onerror that swaps in a
//  lower quality, but og:image and JSON-LD are read by crawlers that
//  never run JS: they just get a dead URL and the share preview comes up
//  blank. (Found on the Bob Lazar post — a 2019 JRE episode, the only one
//  of 47 without a maxresdefault.)
//
//  So we probe once per video id at build time and hand back a URL that
//  actually resolves. Static site, ~50 posts, one HEAD each, all cached —
//  it costs a second of build time and fixes the crawler path for good.
// ============================================================

import { youtubeId } from '../consts';

// Ordered best-first. maxres and mq are 16:9; sd and hq are 4:3 and get
// letterboxed into a 16:9 slot — but a real 4:3 image beats a dead 16:9
// one, and sd (640x480) is the least-bad of the two.
const CANDIDATES = ['maxresdefault', 'sddefault', 'hqdefault'] as const;

const cache = new Map<string, string>();

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false; // offline/blocked build — fall through to the default
  }
}

/**
 * The best thumbnail URL that actually exists for this video.
 * Falls back to maxresdefault (previous behaviour) if every probe fails,
 * so a network-less build degrades to today's output instead of breaking.
 */
export async function bestThumb(url?: string): Promise<string | undefined> {
  const id = youtubeId(url);
  if (!id) return undefined;

  const hit = cache.get(id);
  if (hit) return hit;

  for (const quality of CANDIDATES) {
    const candidate = `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
    if (await exists(candidate)) {
      cache.set(id, candidate);
      return candidate;
    }
  }

  const fallback = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  cache.set(id, fallback);
  return fallback;
}
