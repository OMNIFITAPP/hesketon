// ============================================================
//  QA gate — mechanical checks, zero API cost.
//
//  Runs after all AI passes and verifies the post matches the house
//  anatomy + style rules. Failures flip the draft flag back to true
//  (so a merge can't accidentally publish a broken post); warnings go
//  to the run report that lands in the PR body.
// ============================================================

// Openers/filler/drama the style guide bans (see prompt.mjs "אסור בהחלט").
const BANNED_PHRASES = [
  'במאמר זה',
  'בפוסט זה',
  'בעולם של היום',
  'בעידן המודרני',
  'בעידן הדיגיטלי',
  'חשוב לציין',
  'ראוי לציין',
  'חשוב להבין',
  'אין ספק ש',
  'ללא ספק',
  'כפי שכולנו יודעים',
  'בואו נצלול',
  'מסע מרתק',
  'צוללים לעומק',
];

/**
 * @param {{ post: object, categories: {name:string}[], transcript?: string }} args
 * @returns {{ failures: string[], warnings: string[] }}
 */
export function runQA({ post, categories, transcript = '' }) {
  const failures = [];
  const warnings = [];
  const body = post.bodyMarkdown || '';
  // The invisible quote-audit comment quotes the source freely — exclude it.
  const visible = body.replace(/<!--[\s\S]*?-->/g, '');

  // ── Anatomy ──
  if (!visible.includes('pull--lead')) failures.push('חסר הציטוט הפותח (pull--lead)');
  if (!visible.includes('class="tldr"')) failures.push('חסרה קופסת האמ;לק');
  const pullIdx = visible.indexOf('pull--lead');
  const tldrIdx = visible.indexOf('class="tldr"');
  if (pullIdx !== -1 && tldrIdx !== -1 && tldrIdx < pullIdx)
    failures.push('האמ;לק מופיע לפני הציטוט הפותח — סדר האנטומיה הפוך');

  const h2s = (visible.match(/^## /gm) || []).length;
  if (h2s < 3) failures.push(`רק ${h2s} כותרות משנה (## ) — הדיג'סט דורש 4-6`);
  else if (h2s > 7) warnings.push(`${h2s} כותרות משנה — יותר מהמבנה המקובל (4-6)`);
  if (!/מה לוקחים מזה/.test(visible)) failures.push('חסר קטע "מה לוקחים מזה"');
  if (/^# /m.test(visible)) failures.push('יש H1 בגוף הפוסט (הכותרת הראשית נשמרת בנפרד)');

  // ── SEO fields ──
  const title = post.title || '';
  const desc = post.description || '';
  if (!title) failures.push('חסרה כותרת');
  else if (title.length > 70) warnings.push(`הכותרת ארוכה (${title.length} תווים, היעד ~65)`);
  if (!desc) failures.push('חסר תיאור מטא');
  else if (desc.length < 120 || desc.length > 170)
    warnings.push(`תיאור המטא באורך ${desc.length} תווים (היעד 140-160)`);
  if (post.slug && !/^[a-z0-9-]+$/.test(post.slug))
    failures.push(`ה-slug אינו kebab-case באנגלית: "${post.slug}"`);

  // ── Category ──
  const names = (categories || []).map((c) => c.name);
  if (names.length && !names.includes(post.category))
    failures.push(`קטגוריה לא מוכרת: "${post.category}"`);

  // ── Style: AI tells ──
  for (const phrase of BANNED_PHRASES) {
    if (visible.includes(phrase)) warnings.push(`ביטוי אסור מסגנון הבית: "${phrase}"`);
  }

  // ── <mark> discipline: sparse, and never inside the tldr box ──
  const marks = (visible.match(/<mark>/g) || []).length;
  if (marks > 3) warnings.push(`${marks} הדגשות <mark> — המקסימום המקובל הוא 2`);
  const tldrBlock = visible.match(/<aside class="tldr">[\s\S]*?<\/aside>/);
  if (tldrBlock && tldrBlock[0].includes('<mark>'))
    failures.push('יש <mark> בתוך קופסת האמ;לק — ההדגשה שם אסורה');

  // ── Percent ranges: repeat the sign on both sides (20%–30%) ──
  const badRanges = visible.match(/(?<![%\d])\d+[–-]\d+%/g);
  if (badRanges) warnings.push(`טווח אחוזים בלי % בצד הראשון: ${badRanges.join(', ')}`);

  // ── English leftovers: 4+ consecutive latin words outside parens/quotes ──
  const stripped = visible
    .replace(/\([^)]*\)/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/<[^>]+>/g, '');
  const latinRuns = stripped.match(/(?:[A-Za-z][A-Za-z'’-]*\s+){3,}[A-Za-z][A-Za-z'’-]*/g);
  if (latinRuns)
    warnings.push(
      `רצפי אנגלית בגוף (ייתכן מונח שלא תורגם): ${latinRuns.slice(0, 3).map((s) => `"${s.trim().slice(0, 50)}"`).join(' · ')}`,
    );

  // ── Number fabrication guard (warning only — transcripts spell numbers
  //    inconsistently, so absence is a signal, not proof) ──
  if (transcript) {
    const flat = transcript.replace(/,/g, '');
    const nums = [...new Set(visible.replace(/<!--[\s\S]*?-->/g, '').match(/\d{2,}(?:\.\d+)?/g) || [])]
      // Skip years that match the episode's own metadata era + common time formats.
      .filter((n) => !flat.includes(n) && !/^(19|20)\d{2}$/.test(n));
    if (nums.length)
      warnings.push(`מספרים בפוסט שלא נמצאו בתמלול (לאמת ידנית): ${nums.slice(0, 8).join(', ')}`);
  }

  return { failures, warnings };
}

/** Markdown block for the run report (lands in the PR body). */
export function qaSection({ failures, warnings }) {
  const lines = [];
  if (failures.length === 0 && warnings.length === 0) {
    lines.push('✅ שער האיכות עבר נקי.');
  } else {
    for (const f of failures) lines.push(`- ❌ ${f}`);
    for (const w of warnings) lines.push(`- ⚠️ ${w}`);
  }
  return lines.join('\n');
}
