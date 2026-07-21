#!/usr/bin/env node
// ============================================================
//  ig-audio.mjs — search Instagram's licensed audio catalogue.
//
//  Meta's Audio API exposes the subset of Instagram audio that is
//  cleared for third-party (API) use, so a Reel published through the
//  API can carry real licensed music instead of a baked-in track.
//  With no search query it returns trending audio.
//
//  Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing/audio-api/
//
//  Usage:
//    node scripts/ig-audio.mjs                 # trending music
//    node scripts/ig-audio.mjs "lofi"          # search
//    node scripts/ig-audio.mjs --type=original_audio
// ============================================================

import 'dotenv/config';

const GRAPH = 'https://graph.facebook.com/v23.0';

const args = process.argv.slice(2);
const typeArg = args.find((a) => a.startsWith('--type='));
const audioType = typeArg ? typeArg.split('=')[1] : 'music';
const query = args.filter((a) => !a.startsWith('--')).join(' ').trim();

const userId = process.env.IG_USER_ID;
const token = process.env.IG_ACCESS_TOKEN;
if (!userId || !token) {
  console.error('IG_USER_ID / IG_ACCESS_TOKEN are not set.');
  process.exit(1);
}

// Several moods in one run: pass them semicolon-separated. Each search is a
// separate Graph call, but one workflow run beats one dispatch per mood.
const queries = query.includes(';') ? query.split(';').map((q) => q.trim()).filter(Boolean) : [query];

async function search(q) {
  const url = new URL(`${GRAPH}/ig_audio`);
  url.searchParams.set('audio_type', audioType);
  url.searchParams.set('user_id', userId);
  if (q) url.searchParams.set('search_query', q);
  url.searchParams.set('access_token', token);

  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error || {};
    console.error(`❌ "${q}" → Graph API ${res.status}: ${e.message || res.statusText} (code ${e.code ?? '?'})`);
    return null;
  }
  return json;
}

for (const q of queries) {
  const json = await search(q);
  if (json) report(q, json);
}
process.exit(0);

function report(q, json) {

// The response nests results under `audio` (not `data`), and uses
// audio_id / display_artist / duration_in_ms.
const items = Array.isArray(json.audio) ? json.audio : Array.isArray(json.data) ? json.data : [];
console.log(`\n🎵 ${q ? `search="${q}"` : 'trending'} → ${items.length} results\n`);

for (const a of items) {
  const ms = a.duration_in_ms ?? a.duration_ms;
  const dur = ms ? `${(ms / 1000).toFixed(0)}s` : '?';
  const ads = a.is_ads_eligible ? 'ads-ok' : 'organic-only';
  console.log(`  ${a.audio_id || a.id}  [${dur}] [${ads}]`);
  console.log(`     ${a.title || '(untitled)'} — ${a.display_artist || a.ig_username || '?'}`);
  if (a.on_platform_audio_preview_link) console.log(`     ▶ ${a.on_platform_audio_preview_link}`);
}

if (!items.length) {
  console.log('  (empty — the catalogue may be unavailable for this account/region)');
  console.log('\nRaw:', JSON.stringify(json).slice(0, 800));
}
console.log('');
}
