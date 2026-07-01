#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────
//  check-references — flags posts that MENTION a study but carry no
//  `references:` block. We never auto-generate citations (they must be
//  human-verified), so this just surfaces where a human needs to add them.
//
//  Run:  npm run check:refs        (lists offenders, exit 1 if any)
//  Used as a warning step in the generate workflow.
// ────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const POSTS_DIR = 'src/content/posts';

// Phrases that signal a *specific* study is being cited (not generic prose).
const STUDY_PATTERNS = [
  /מחקר\s+ש/, // "מחקר ש..." (a study that…)
  /לפי\s+מחקר/,
  /על\s+פי\s+מחקר/,
  /סקירה\s+שפורסמה/,
  /מטא[-\s]?אנליזה/,
  /ניסוי\s+קליני/,
  /ניסוי\s+מבוקר/,
  /פורסם\s+ב-?\s?\d{4}/,
  /מחקר\s+מ-?\s?\d{4}/,
  /ניתחה?\s+\d+\s+מחקרים/,
  /מחקר\s+ארוך\s+טווח/,
];

function frontmatterAndBody(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { fm: '', body: raw };
  return { fm: m[1], body: m[2] };
}

const offenders = [];
for (const file of readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))) {
  const raw = readFileSync(join(POSTS_DIR, file), 'utf8');
  const { fm, body } = frontmatterAndBody(raw);

  // Skip drafts.
  if (/^draft:\s*true/m.test(fm)) continue;

  // Strip HTML comments (the invisible quote-audit trail) before scanning.
  const prose = body.replace(/<!--[\s\S]*?-->/g, '');

  const mentioned = STUDY_PATTERNS.find((re) => re.test(prose));
  const hasRefs = /^references:/m.test(fm);

  if (mentioned && !hasRefs) {
    offenders.push({ file, hint: (prose.match(mentioned) || [''])[0].trim() });
  }
}

if (offenders.length === 0) {
  console.log('✅ כל הפוסטים שמזכירים מחקר כוללים גם references.');
  process.exit(0);
}

console.log(`⚠️  ${offenders.length} פוסטים מזכירים מחקר אך חסרים בהם references:\n`);
for (const o of offenders) {
  console.log(`   • ${o.file}   (למשל: "${o.hint}")`);
}
console.log(
  '\nהוסף בלוק `references:` מאומת (מקורות אמיתיים בלבד) + ציטוט inline <sup><a class="cite" href="#ref-N">N</a></sup>.',
);
process.exit(1);
