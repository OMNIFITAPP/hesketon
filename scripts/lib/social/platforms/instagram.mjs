// ============================================================
//  instagram.mjs — Meta Graph API publishing adapter (free).
//
//  Implements the common platform interface so the dispatcher can
//  later treat IG / TikTok / X / LinkedIn the same way:
//     publishImage(url, caption)
//     publishCarousel(urls[], caption)
//     publishReel(videoUrl, caption)
//     publishStory(url)            // image or video
//
//  Flow per Meta docs: create media container(s) → publish container.
//  Media URLs MUST be publicly reachable over HTTPS (we host them on
//  GitHub Pages / hesketon.co.il).
//
//  Requires env: IG_USER_ID, IG_ACCESS_TOKEN.
//  Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing
// ============================================================

const GRAPH = 'https://graph.facebook.com/v23.0';

function creds() {
  const userId = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!userId || !token) {
    throw new Error('IG_USER_ID / IG_ACCESS_TOKEN are not set. See .env.example → "פרסום אוטומטי לרשתות".');
  }
  return { userId, token };
}

async function graph(method, pathname, params) {
  const { token } = creds();
  const url = new URL(`${GRAPH}/${pathname}`);
  const all = { ...params, access_token: token };
  // GET can't carry a body, so its params (incl. the token!) must ride in the
  // query string. Only POST/DELETE send a form-encoded body.
  let body;
  if (method === 'GET') {
    for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  } else {
    body = new URLSearchParams(all);
  }
  const res = await fetch(url, {
    method,
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(`Graph API ${res.status}: ${e.message || res.statusText} (code ${e.code ?? '?'})`);
  }
  return json;
}

/** Create a media container and return its id. */
async function createContainer(fields) {
  const { userId } = creds();
  const out = await graph('POST', `${userId}/media`, fields);
  return out.id;
}

/** Publish a finished container to the feed/story. */
async function publishContainer(creationId) {
  const { userId } = creds();
  const out = await graph('POST', `${userId}/media_publish`, { creation_id: creationId });
  return out.id; // the published media id
}

/** Poll a (video/reel) container until it's FINISHED. */
async function waitForContainer(containerId, { tries = 30, delayMs = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const out = await graph('GET', `${containerId}`, { fields: 'status_code,status' });
    if (out.status_code === 'FINISHED') return;
    if (out.status_code === 'ERROR') throw new Error(`Container ${containerId} failed: ${out.status || 'ERROR'}`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Container ${containerId} not FINISHED in time`);
}

/** Fetch the public permalink of a published media id (best-effort). */
async function permalink(mediaId) {
  try {
    const out = await graph('GET', `${mediaId}`, { fields: 'permalink' });
    return out.permalink || '';
  } catch {
    return '';
  }
}

// ── Public interface ───────────────────────────────────────

export async function publishImage(imageUrl, caption) {
  const id = await createContainer({ image_url: imageUrl, caption: caption || '' });
  // Single-image containers process asynchronously too. This wait was added to
  // the carousel path after the 2026-07-10 failure but not here, and on
  // 2026-07-26 the Naval quote died the same way (9007, "Media ID is not
  // available") and never retried.
  await waitForContainer(id);
  const mediaId = await publishContainer(id);
  return { mediaId, permalink: await permalink(mediaId) };
}

export async function publishCarousel(imageUrls, caption) {
  if (!imageUrls?.length) throw new Error('publishCarousel: no images');
  if (imageUrls.length > 10) imageUrls = imageUrls.slice(0, 10); // IG max
  const children = [];
  for (const url of imageUrls) {
    children.push(await createContainer({ image_url: url, is_carousel_item: 'true' }));
  }
  const parent = await createContainer({
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption: caption || '',
  });
  // Carousel containers process asynchronously; publishing before the parent
  // reaches FINISHED intermittently fails with Graph error 9007
  // ("Media ID is not available") — seen live on 2026-07-10.
  await waitForContainer(parent);
  const mediaId = await publishContainer(parent);
  return { mediaId, permalink: await permalink(mediaId) };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.coverUrl]
 * @param {object} [opts.audio]  Instagram licensed audio to attach:
 *   { audioId, audioVolume = 100, videoVolume = 0 }. Only audio cleared
 *   for third-party use works here — discover ids with scripts/ig-audio.mjs.
 *   Docs: /docs/instagram-platform/content-publishing/audio-api/
 */
export async function publishReel(videoUrl, caption, { coverUrl, audio } = {}) {
  const fields = { media_type: 'REELS', video_url: videoUrl, caption: caption || '' };
  if (coverUrl) fields.cover_url = coverUrl;
  if (audio?.audioId) {
    // Graph expects this as a JSON-encoded object on the form body.
    fields.audio_configuration = JSON.stringify({
      audio_id: String(audio.audioId),
      audio_volume: audio.audioVolume ?? 100,
      video_volume: audio.videoVolume ?? 0,
    });
  }
  const id = await createContainer(fields);
  await waitForContainer(id);
  const mediaId = await publishContainer(id);
  return { mediaId, permalink: await permalink(mediaId) };
}

export async function publishStory(mediaUrl, { isVideo = false } = {}) {
  const fields = isVideo
    ? { media_type: 'STORIES', video_url: mediaUrl }
    : { media_type: 'STORIES', image_url: mediaUrl };
  const id = await createContainer(fields);
  await waitForContainer(id);   // images race here too, not just video
  const mediaId = await publishContainer(id);
  return { mediaId, permalink: await permalink(mediaId) };
}

/** Verify creds + return the connected account's @handle (used for sanity checks). */
export async function whoami() {
  const { userId } = creds();
  return graph('GET', `${userId}`, { fields: 'username,name' });
}

export const platform = 'instagram';
