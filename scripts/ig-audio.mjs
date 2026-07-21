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

const url = new URL(`${GRAPH}/ig_audio`);
url.searchParams.set('audio_type', audioType);
url.searchParams.set('user_id', userId);
if (query) url.searchParams.set('search_query', query);
url.searchParams.set('access_token', token);

const res = await fetch(url);
const json = await res.json().catch(() => ({}));

if (!res.ok || json.error) {
  const e = json.error || {};
  console.error(`\n❌ Graph API ${res.status}: ${e.message || res.statusText} (code ${e.code ?? '?'}, subcode ${e.error_subcode ?? '-'})`);
  console.error('\nRaw response:');
  console.error(JSON.stringify(json, null, 2).slice(0, 2000));
  process.exit(2);
}

const items = Array.isArray(json.data) ? json.data : [];
console.log(`\n🎵 audio_type=${audioType}${query ? ` search="${query}"` : ' (trending)'} → ${items.length} results\n`);

for (const a of items) {
  const dur = a.duration_ms ? `${(a.duration_ms / 1000).toFixed(0)}s` : '?';
  console.log(`  id=${a.id}`);
  console.log(`     ${a.title || a.display_name || '(untitled)'} — ${a.artist_name || a.owner_username || '?'}  [${dur}]`);
}

if (!items.length) {
  console.log('  (empty — the catalogue may be unavailable for this account/region)');
  console.log('\nRaw:', JSON.stringify(json).slice(0, 800));
}
console.log('');
