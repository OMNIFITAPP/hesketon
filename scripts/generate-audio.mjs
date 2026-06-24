#!/usr/bin/env node
// ============================================================
//  Generate spoken-audio (MP3) for each post via Google Cloud TTS.
//
//  Runs in CI (and optionally locally). Skips posts that already have an
//  MP3, so it only ever generates new ones — keeping the free tier happy.
//  No-ops cleanly if GOOGLE_TTS_API_KEY isn't set (browser-voice fallback).
//
//  Env:
//    GOOGLE_TTS_API_KEY   required to do anything
//    GOOGLE_TTS_VOICE     optional (default he-IL-Neural2-B; falls back to Wavenet)
// ============================================================

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS = path.join(ROOT, 'src', 'content', 'posts');
const AUDIO = path.join(ROOT, 'public', 'audio');

const KEY = process.env.GOOGLE_TTS_API_KEY;
const VOICE = process.env.GOOGLE_TTS_VOICE || 'he-IL-Neural2-B';
const FALLBACK_VOICE = 'he-IL-Wavenet-C';
const MAX_BYTES = 4200; // Google caps input at 5000 bytes; stay safely under

if (!KEY) {
  console.log('GOOGLE_TTS_API_KEY not set — skipping audio generation (browser voice will be used).');
  process.exit(0);
}

fs.mkdirSync(AUDIO, { recursive: true });

/** Turn the post markdown into clean spoken text. */
function mdToText(md) {
  return md
    .replace(/<cite>[\s\S]*?<\/cite>/g, '') // drop "— name" attributions
    .replace(/<[^>]+>/g, ' ') // strip remaining HTML tags (keep their text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/[*_`>#]/g, ' ') // markdown syntax
    .replace(/^\s*[-•]\s*/gm, '') // list bullets
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split into <=MAX_BYTES UTF-8 chunks on sentence boundaries. */
function chunk(text) {
  const enc = new TextEncoder();
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const out = [];
  let buf = '';
  for (const s of sentences) {
    if (buf && enc.encode(buf + s).length > MAX_BYTES) {
      out.push(buf.trim());
      buf = s;
    } else buf += s;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

async function synth(text, voice) {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'he-IL', name: voice },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
      }),
    },
  );
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const { audioContent } = await res.json();
  return Buffer.from(audioContent, 'base64');
}

async function speakPost(parts, voice) {
  const buffers = [];
  for (const p of parts) buffers.push(await synth(p, voice));
  return Buffer.concat(buffers);
}

const files = fs
  .readdirSync(POSTS)
  .filter((f) => f.endsWith('.md') && !f.startsWith('_'));

let made = 0;
for (const f of files) {
  const slug = f.replace(/\.md$/, '');
  const outPath = path.join(AUDIO, `${slug}.mp3`);
  if (fs.existsSync(outPath)) continue;

  const { data, content } = matter(fs.readFileSync(path.join(POSTS, f), 'utf8'));
  if (data.draft) continue;

  const text = `${data.title ? data.title + '. ' : ''}${mdToText(content)}`;
  const parts = chunk(text);
  console.log(`🎙️  ${slug}: ${parts.length} chunk(s), ${text.length} chars`);

  let audio;
  try {
    audio = await speakPost(parts, VOICE);
  } catch (e) {
    if (VOICE !== FALLBACK_VOICE) {
      console.warn(`   voice "${VOICE}" failed (${e.message}); falling back to ${FALLBACK_VOICE}`);
      audio = await speakPost(parts, FALLBACK_VOICE);
    } else {
      throw e;
    }
  }
  fs.writeFileSync(outPath, audio);
  made++;
  console.log(`   ✓ ${slug}.mp3 (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
}

console.log(`Done — generated ${made} new audio file(s).`);
