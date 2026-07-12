#!/usr/bin/env node
// ============================================================
//  הסכתון — local transcript fetcher (the free path)
//
//  Pulls a YouTube episode's transcript + metadata FROM THIS MACHINE
//  (residential IPs work; GitHub CI IPs are blocked by YouTube) and
//  writes a ready-to-run brief into inbox/. This replaces the paid
//  Apify/Whisper step entirely for any episode that has captions.
//
//  Usage:
//    npm run fetch -- <youtube-url>
//    npm run fetch -- <youtube-url> --guest "שם האורח" --category "בריאות וכושר"
//
//  Then: npm run new-post   (or commit the queue item and run the Action)
//
//  Requires: python3 + youtube-transcript-api (pip install --user youtube-transcript-api)
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INBOX = path.join(ROOT, 'inbox');

// ---------- args ----------
const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
};

if (!url) {
  console.error('שימוש: npm run fetch -- <קישור-יוטיוב> [--guest "..."] [--host "..."] [--podcast "..."] [--category "..."]');
  process.exit(1);
}

const videoId = (url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) || [])[1];
if (!videoId) {
  console.error(`❌ לא הצלחתי לחלץ מזהה וידאו מהקישור: ${url}`);
  process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ ' + err.message + '\n');
  process.exit(1);
});

async function main() {
  console.log(`\n🎙️  מושך תמליל מקומית עבור ${videoId} …\n`);

  // 1) transcript (local python — free, no Apify)
  const { text: transcript, language } = fetchTranscript(videoId);
  console.log(`  ↳ תמליל: ${transcript.length.toLocaleString('en-US')} תווים (שפה: ${language})`);

  // 2) title + channel via oEmbed (no API key needed)
  let title = flag('episode') || '';
  let channel = flag('podcast') || '';
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
    );
    if (res.ok) {
      const o = await res.json();
      title = title || o.title || '';
      channel = channel || o.author_name || '';
    }
  } catch {
    /* best-effort */
  }
  if (title) console.log(`  ↳ פרק: ${title}`);
  if (channel) console.log(`  ↳ ערוץ: ${channel}`);

  // 3) duration + episode publish date from the watch page
  let durationMinutes;
  let publishedAt;
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'user-agent': 'Mozilla/5.0' },
    });
    const html = await res.text();
    const len = html.match(/"lengthSeconds":"(\d+)"/);
    if (len) durationMinutes = Math.round(Number(len[1]) / 60);
    const pub = html.match(/"publishDate":"(\d{4}-\d{2}-\d{2})/);
    if (pub) publishedAt = pub[1];
  } catch {
    /* best-effort */
  }
  if (durationMinutes) console.log(`  ↳ אורך: ${durationMinutes} דקות`);
  if (publishedAt) console.log(`  ↳ תאריך הפרק: ${publishedAt}`);

  // 4) write the brief into inbox/ (gitignored — the transcript stays local)
  fs.mkdirSync(INBOX, { recursive: true });
  const file = path.join(INBOX, `${videoId}.md`);
  const fm = [
    '---',
    yamlLine('podcast', channel),
    yamlLine('episode', title),
    yamlLine('host', flag('host')),
    yamlLine('guest', flag('guest')),
    yamlLine('youtubeUrl', `https://www.youtube.com/watch?v=${videoId}`),
    yamlLine('publishedAt', publishedAt),
    durationMinutes ? `durationMinutes: ${durationMinutes}` : undefined,
    yamlLine('categoryHint', flag('category')),
    '# הוסיפו כאן 2-3 שורות משלכם: למה הפרק הזה, מה עניין אתכם, מה יעניין את הקהל.',
    '# curatorNotes: ""',
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  fs.writeFileSync(file, `${fm}\n\n${transcript}\n`, 'utf8');
  console.log(`\n✅ brief מוכן: ${path.relative(ROOT, file)}`);
  console.log('   השלימו guest/categoryHint אם חסר, ואז:  npm run new-post\n');
}

function yamlLine(key, value) {
  if (!value) return undefined;
  return `${key}: ${JSON.stringify(String(value))}`;
}

// ---------- transcript via local python (youtube-transcript-api) ----------

function fetchTranscript(vid) {
  const py = `
import json, sys
from youtube_transcript_api import YouTubeTranscriptApi

vid = sys.argv[1]
api = YouTubeTranscriptApi()

def out(t, lang):
    text = " ".join(s.text.replace("\\n", " ").strip() for s in t)
    print(json.dumps({"text": text, "language": lang}))

try:
    t = api.fetch(vid, languages=["en", "en-US", "en-GB"])
    out(t, t.language_code)
except Exception:
    # fall back to whatever exists (prefer any English, then anything)
    listing = api.list(vid)
    chosen = None
    for tr in listing:
        if tr.language_code.startswith("en"):
            chosen = tr
            break
        chosen = chosen or tr
    if chosen is None:
        print(json.dumps({"error": "no transcript available"}))
        sys.exit(2)
    t = chosen.fetch()
    out(t, chosen.language_code)
`;
  let stdout;
  try {
    stdout = execFileSync('python3', ['-c', py, vid], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const stderr = (err.stderr || '').toString();
    if (/ModuleNotFoundError/.test(stderr)) {
      throw new Error('חסרה החבילה youtube-transcript-api. התקינו:  python3 -m pip install --user youtube-transcript-api');
    }
    throw new Error(`שליפת התמליל נכשלה (ייתכן שאין כתוביות לסרטון הזה — נסו דרך Apify):\n${stderr.slice(-600)}`);
  }
  const parsed = JSON.parse(stdout.trim().split('\n').pop());
  if (parsed.error) throw new Error('אין תמליל זמין לסרטון הזה (גם לא אוטומטי). נסו דרך Apify/Whisper.');
  if (!parsed.text || parsed.text.length < 500) throw new Error('התמליל שחזר קצר באופן חשוד — בדקו את הסרטון.');
  return parsed;
}
