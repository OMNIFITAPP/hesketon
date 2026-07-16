#!/usr/bin/env node
// ============================================================
//  Review-application gate — zero API cost.
//
//  Born from the July 2026 Naval failure: a 16-item review sat in
//  reviews/ and was never applied; the post shipped with 15 of the
//  flagged phrases still in it. This gate makes that impossible to
//  miss: for every review file it finds the matching post, extracts
//  the "original text" column of the review table, and fails if a
//  flagged phrase is still present in a PUBLISHED post.
//
//  Conventions it understands:
//   - review files live in reviews/, named "<post-slug>-סקירה.md"
//     (stray spaces / " copy" suffixes are tolerated when matching).
//   - a review table row = a line starting with "|" holding ≥3 pipes;
//     the first cell is the original text (backticks/quotes/<br> ok).
//   - a flagged phrase found inside a blockquote line (">" / <blockquote>)
//     is a WARNING, not a failure: quotes obey the fidelity contract,
//     which a style review does not override — but eyeball it.
//   - a deliberate keep is declared in the post with an HTML comment:
//     <!-- review-keep: <fragment of the original text> --> (+ reason).
//
//  Exit 1 only when a published (draft: false) post still carries
//  unwaived review items. Draft posts report as warnings.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'posts');
const REVIEWS_DIR = path.join(ROOT, 'reviews');

// -- normalization ------------------------------------------------

// Unify the characters that legitimately differ between a review file
// and the post (quote styles, dash styles, whitespace) so a match is
// about the words, not the typography.
function normalize(s) {
  return s
    .replace(/[«»„“”"]/g, '"')
    .replace(/[’׳']/g, "'")
    .replace(/[—–־]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Post text for matching: hidden comments hold the audit trail (old
// phrasings live there on purpose) so they must not trigger the gate;
// tags and emphasis markers would break substring matches.
function preparePost(raw) {
  const noComments = raw.replace(/<!--[\s\S]*?-->/g, '');
  const stripped = noComments.replace(/<[^>]+>/g, '').replace(/[*_]/g, '');
  return normalize(stripped);
}

// Same stripping, but keeping only quoted material — blockquotes AND
// inline "..." spans in prose (the fidelity contract governs every pair
// of quote marks in a post) — used to decide whether a surviving phrase
// lives inside a quote.
function quoteOnlyText(raw) {
  const noComments = raw.replace(/<!--[\s\S]*?-->/g, '');
  const lines = noComments.split('\n');
  const quoteLines = [];
  let inBlockquote = false;
  for (const line of lines) {
    if (/<blockquote/i.test(line)) inBlockquote = true;
    const isQuote = inBlockquote || /^\s*>/.test(line);
    if (isQuote) quoteLines.push(line.replace(/^\s*>\s?/, ''));
    if (/<\/blockquote>/i.test(line)) inBlockquote = false;
  }
  // Inline quoted spans anywhere in the document (tags stripped first so
  // attribute quotes like class="tldr" don't produce fake spans).
  const proseText = noComments.replace(/<[^>]+>/g, '');
  const inline = proseText.match(/[«„“"]([^«»„“”"\n]{4,240})[»“”"]/g) || [];
  const joined = [...quoteLines, ...inline].join(' ');
  return normalize(joined.replace(/<[^>]+>/g, '').replace(/[*_]/g, ''));
}

function extractKeeps(raw) {
  const keeps = [];
  const re = /<!--\s*review-keep:\s*([\s\S]*?)-->/g;
  let m;
  while ((m = re.exec(raw))) keeps.push(normalize(m[1]));
  return keeps;
}

// -- review parsing -----------------------------------------------

function cleanCell(cell) {
  return normalize(
    cell
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/`/g, '')
      .replace(/^["'\s]+|["'\s.]+$/g, ''),
  );
}

// The probe is the longest ellipsis-free fragment of the original text
// that does NOT survive verbatim in the proposed text — i.e. the part the
// review actually changed. Fragments the proposed text repeats are context
// ("...הכלל הגס שלו" rows quote a whole sentence but only fix two words)
// and would fire forever if used as probes.
function pickProbe(original, proposed = '') {
  const fragments = original
    .split(/\.\.\.|…/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 10);
  if (fragments.length === 0) return original.length >= 6 ? original : null;
  const changed = proposed ? fragments.filter((f) => !proposed.includes(f)) : fragments;
  const pool = changed.length > 0 ? changed : fragments;
  return pool.sort((a, b) => b.length - a.length)[0];
}

function parseReviewRows(raw) {
  const rows = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    if ((t.match(/\|/g) || []).length < 3) continue;
    const cells = t.split('|');
    const orig = cleanCell(cells[1] || '');
    if (!orig) continue;
    if (/הטקסט המקורי|הטקסט המוצע|סיבת התיקון/.test(orig)) continue;
    if (/^[-:\s]+$/.test(orig)) continue;
    rows.push({ orig, proposed: cleanCell(cells[2] || '') });
  }
  return rows;
}

// -- slug matching ------------------------------------------------

function reviewSlug(filename) {
  return filename
    .replace(/\.(md|txt)$/i, '')
    .replace(/[\s-]*סקירה\s*$/i, '')
    .replace(/\s*copy\s*$/i, '')
    .replace(/[\s-]+$/g, '')
    .trim();
}

function findPostFile(slug, postFiles) {
  const exact = postFiles.find((f) => f.replace(/\.md$/, '') === slug);
  if (exact) return exact;
  return postFiles.find(
    (f) => f.replace(/\.md$/, '').startsWith(slug) || slug.startsWith(f.replace(/\.md$/, '')),
  );
}

// -- main ---------------------------------------------------------

const postFiles = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
const reviewFiles = fs.existsSync(REVIEWS_DIR)
  ? fs.readdirSync(REVIEWS_DIR).filter((f) => /\.(md|txt)$/i.test(f))
  : [];

let publishedFailures = 0;
let totalWarnings = 0;

if (reviewFiles.length === 0) {
  console.log('אין קובצי סקירה ב-reviews/ — אין מה לבדוק.');
  process.exit(0);
}

for (const rf of reviewFiles) {
  const slug = reviewSlug(rf);
  const postFile = findPostFile(slug, postFiles);
  console.log(`\n📄 סקירה: ${rf}`);
  if (!postFile) {
    console.log(`   ⚠️  לא נמצא פוסט תואם ל-slug "${slug}" — בדוק שם קובץ.`);
    totalWarnings++;
    continue;
  }

  const rawPost = fs.readFileSync(path.join(POSTS_DIR, postFile), 'utf8');
  const rawReview = fs.readFileSync(path.join(REVIEWS_DIR, rf), 'utf8');
  const isDraft = /^draft:\s*true/m.test(rawPost);
  const postText = preparePost(rawPost);
  const quoteText = quoteOnlyText(rawPost);
  const keeps = extractKeeps(rawPost);

  const rows = parseReviewRows(rawReview);
  if (rows.length === 0) {
    console.log('   ⚠️  לא זוהו שורות טבלה בסקירה (פורמט לא מוכר?).');
    totalWarnings++;
    continue;
  }

  const unapplied = [];
  const inQuotes = [];
  const waived = [];
  for (const { orig, proposed } of rows) {
    const probe = pickProbe(orig, proposed);
    if (!probe) continue;
    if (!postText.includes(probe)) continue; // applied (or rephrased) — good
    if (keeps.some((k) => probe.includes(k) || k.includes(probe))) {
      waived.push(probe);
    } else if (quoteText.includes(probe)) {
      inQuotes.push(probe);
    } else {
      unapplied.push(probe);
    }
  }

  const applied = rows.length - unapplied.length - inQuotes.length - waived.length;
  console.log(`   פוסט: ${postFile}${isDraft ? ' (טיוטה)' : ' (מפורסם)'} · ${rows.length} פריטים · ${applied} יושמו/נוסחו מחדש`);

  for (const p of waived) console.log(`   ✓ נשמר במכוון (review-keep): "${p.slice(0, 60)}"`);
  for (const p of inQuotes) {
    console.log(`   ⚠️  שרד בתוך ציטוט (חוזה הנאמנות גובר על סקירת סגנון — ודא שזו הכרעה): "${p.slice(0, 60)}"`);
    totalWarnings++;
  }
  for (const p of unapplied) {
    const mark = isDraft ? '⚠️ ' : '❌';
    console.log(`   ${mark} לא יושם: "${p.slice(0, 70)}"`);
    if (isDraft) totalWarnings++;
    else publishedFailures++;
  }
}

console.log('\n──────────────────────────────');
if (publishedFailures > 0) {
  console.log(`❌ ${publishedFailures} פריטי סקירה לא-מיושמים בפוסטים מפורסמים. יישם אותם, נסח מחדש, או הצהר <!-- review-keep: ... --> מנומק.`);
  process.exit(1);
}
console.log(`✓ אין פריטי סקירה פתוחים בפוסטים מפורסמים${totalWarnings ? ` (${totalWarnings} אזהרות)` : ''}.`);
