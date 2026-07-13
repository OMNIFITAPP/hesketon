// ============================================================
//  Canonical Hebrew name resolver.
//
//  Guest/host names must match how Hebrew speakers actually write them
//  ("ניל דה-גראס טייסון", not a phonetic guess). Instead of transliterating
//  by ear, we ask Wikipedia: the Hebrew article title IS the canonical name.
//
//  Strategy: English Wikipedia → Hebrew interlanguage link only. This is the
//  one high-precision signal. A Hebrew-Wikipedia opensearch fallback was tried
//  and dropped — it happily returns unrelated English titles ("Rickroll" for
//  "Rich Roll"), which is worse than an honest "not found". So: langlink or
//  null. Null means "no Hebrew article — keep the manual transliteration".
//
//  CLI:  node scripts/resolve-name.mjs "Neil deGrasse Tyson"
//  Code: import { resolveHebrewName } from './lib/name-resolver.mjs';
// ============================================================

const UA = 'hesketon-name-resolver/1.0 (https://hesketon.co.il)';

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// English Wikipedia → Hebrew interlanguage link (follows redirects).
async function viaLanglink(nameEn) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=langlinks&lllang=he&titles=' +
    encodeURIComponent(nameEn);
  const data = await getJson(url);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  const he = page?.langlinks?.[0]?.['*'];
  return he || null;
}

// Strip any parenthetical disambiguation Wikipedia appends, e.g. "(אסטרונום)".
function clean(title) {
  return title ? title.replace(/\s*\([^)]*\)\s*$/, '').trim() : title;
}

/**
 * Resolve the canonical Hebrew spelling of a person's name via Wikipedia's
 * English→Hebrew interlanguage link. Returns null when there's no Hebrew
 * article (keep the manual transliteration then — do not guess).
 * @param {string} nameEn - the English name (e.g. "Neil deGrasse Tyson")
 * @returns {Promise<{ he: string|null, source: 'langlink'|null }>}
 */
export async function resolveHebrewName(nameEn) {
  if (!nameEn || !nameEn.trim()) return { he: null, source: null };
  try {
    const he = await viaLanglink(nameEn);
    if (he) return { he: clean(he), source: 'langlink' };
  } catch { /* network/parse failure → treat as unresolved */ }
  return { he: null, source: null };
}
