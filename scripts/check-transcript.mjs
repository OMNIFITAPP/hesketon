#!/usr/bin/env node
// ============================================================
//  Transcript-quality gate — zero API cost, advisory.
//
//  Born from the July 2026 Naval/Lazar failure: both were written from
//  raw ASR transcripts (no punctuation, garbled names, and in the JRE
//  case three unlabeled speakers), and the error rate exploded. This
//  gate classifies a transcript BEFORE writing and prints the exact
//  extra work the writer owes when the input is dirty.
//
//  Usage:
//    node scripts/check-transcript.mjs <file...>     (.rtf/.md/.txt)
//    node scripts/check-transcript.mjs               (scans inbox/)
//
//  Verdicts:
//    CLEAN    — punctuated, edited transcript. Normal pipeline.
//    PARTIAL  — some punctuation; verify names + sentence boundaries.
//    RAW_ASR  — no reliable punctuation. Full normalization ritual due.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readTranscript(file) {
  if (/\.rtf$/i.test(file)) {
    try {
      return execFileSync('textutil', ['-convert', 'txt', '-stdout', file], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      return fs.readFileSync(file, 'utf8'); // best effort
    }
  }
  return fs.readFileSync(file, 'utf8');
}

function analyze(file) {
  const raw = readTranscript(file);
  const text = raw.replace(/^Link:.*$/m, '').trim();
  const words = (text.match(/\S+/g) || []).length;

  // Sentence punctuation per 100 words — the strongest clean/ASR separator.
  const punct = (text.match(/[.!?](\s|$)/g) || []).length;
  const punctPer100 = words ? (punct / words) * 100 : 0;

  // Speaker labels: "ANDREW HUBERMAN:" / "Joe Rogan:" / "Speaker 1:" at line start.
  const labels = (text.match(/^ *(?:[A-Z][A-Za-z.'’-]+(?: [A-Z][A-Za-z.'’-]+){0,3}|SPEAKER ?\d+):/gm) || []).length;

  // All-lowercase streams (JRE-style ASR) — letters that are lowercase.
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const lowers = (text.match(/[a-z]/g) || []).length;
  const lowerRatio = letters ? lowers / letters : 0;

  // Multi-speaker hint from the filename (guest & guest, #NNN episodes with two names).
  const base = path.basename(file);
  const multiHint = /&| and | עם | ו-|,/.test(base.replace(/\.(rtf|md|txt)$/i, ''));

  let verdict;
  if (punctPer100 >= 3) verdict = 'CLEAN';
  else if (punctPer100 >= 1) verdict = 'PARTIAL';
  else verdict = 'RAW_ASR';

  return { file: base, words, punctPer100, labels, lowerRatio, multiHint, verdict };
}

function report(a) {
  const icons = { CLEAN: '✅', PARTIAL: '🟠', RAW_ASR: '🔴' };
  console.log(`\n${icons[a.verdict]} ${a.file}`);
  console.log(
    `   ${a.words.toLocaleString()} מילים · פיסוק ${a.punctPer100.toFixed(1)}/100 מילים · תוויות דוברים: ${a.labels || 'אין'} · ${Math.round(a.lowerRatio * 100)}% אותיות קטנות`,
  );

  if (a.verdict === 'CLEAN') {
    console.log('   תמליל ערוך — זרימה רגילה. עדיין: אמתו שמות פרטיים בהופעה ראשונה.');
  } else {
    console.log(`   תמליל ASR ${a.verdict === 'PARTIAL' ? 'חלקי' : 'גולמי'} — חובות לפני כתיבה:`);
    console.log('   1. נרמול: שחזרו גבולות משפט ופיסוק בקריאה; אל תעגנו ציטוט על קטע שגבולותיו לא ודאיים.');
    console.log('   2. שמות: כל שם פרטי/חברה חשוד כשיבוש ASR ("Vinnie Himmath" = Vinay Hiremath) — אמתו מול מקור חיצוני לפני שימוש.');
    console.log('   3. מספרים ויחידות: קראו את ההקשר המלא סביב כל מספר (feet/meters, 15/50) לפני שמתרגמים.');
  }
  if (a.labels === 0 && (a.multiHint || a.verdict !== 'CLEAN')) {
    console.log('   ⚠️  אין תוויות דוברים: כל ציטוט מחייב ודאות מי אמר אותו מתוך ההקשר (שאלה→תשובה, גוף ראשון). ספק בזהות הדובר → פרוזה עקיפה, לא מרכאות.');
  }
  if (a.words > 35000) {
    console.log(`   ⚠️  פרק ארוך במיוחד (${a.words.toLocaleString()} מילים): קבעו תקציב בחירה מראש — אילו 5–7 רעיונות נכנסים — במקום לדחוס הכול.`);
  }
}

// -- main ---------------------------------------------------------

let files = process.argv.slice(2);
if (files.length === 0) {
  const inbox = path.join(ROOT, 'inbox');
  files = fs.existsSync(inbox)
    ? fs
        .readdirSync(inbox)
        .filter((f) => /\.(rtf|md|txt)$/i.test(f))
        .map((f) => path.join(inbox, f))
    : [];
  if (files.length === 0) {
    console.log('אין תמלולים ב-inbox/ ולא הועברו קבצים. שימוש: node scripts/check-transcript.mjs <קובץ...>');
    process.exit(0);
  }
}

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log(`\n❌ לא נמצא: ${f}`);
    continue;
  }
  report(analyze(f));
}
console.log('');
