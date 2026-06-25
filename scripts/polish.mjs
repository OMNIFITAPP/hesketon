#!/usr/bin/env node
// ============================================================
//  Run the Hebrew editor pass over EXISTING posts (not just new drafts).
//
//  Usage:
//    node scripts/polish.mjs <slug-or-path> [...]
//    node scripts/polish.mjs            # defaults to the latest batch
//
//  Preserves frontmatter exactly; only the body is polished. Falls back to
//  the original body if an edit fails the guardrails (validateEdit).
//  Needs ANTHROPIC_API_KEY. Pick the editor model with EDITOR_MODEL.
// ============================================================

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { editHebrew, validateEdit } from './lib/editor.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS = path.join(ROOT, 'src', 'content', 'posts');

const DEFAULT_SLUGS = [
  'andrew-huberman-cortisol-habits-focus',
  'tony-robbins-ai-future-of-work-meaning',
  'tony-robbins-depression-motivation-jordan-peterson',
];

const FM_RE = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/;

main().catch((err) => {
  console.error('\n❌ ' + err.message + '\n');
  process.exit(1);
});

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targets = (args.length ? args : DEFAULT_SLUGS).map(toPath);

  console.log(`\n✍️  עריכת לשון ל-${targets.length} פוסטים${
    process.env.EDITOR_MODEL ? `  ·  ${process.env.EDITOR_MODEL}` : ''
  }\n`);

  let changed = 0;
  for (const file of targets) {
    const name = path.relative(ROOT, file);
    if (!fs.existsSync(file)) {
      console.warn(`  ⚠️  לא נמצא: ${name}`);
      continue;
    }
    const raw = fs.readFileSync(file, 'utf8');
    const m = raw.match(FM_RE);
    if (!m) {
      console.warn(`  ⚠️  אין frontmatter תקין: ${name}`);
      continue;
    }
    const [, frontmatter, body] = m;

    try {
      const edited = await editHebrew({ body: body.trim() });
      if (!validateEdit(body, edited)) {
        console.warn(`  ⚠️  ${name}: עריכה נדחתה (ולידציה) — ללא שינוי`);
        continue;
      }
      if (edited.trim() === body.trim()) {
        console.log(`  • ${name}: ללא שינויים`);
        continue;
      }
      fs.writeFileSync(file, `${frontmatter}\n${edited.trim()}\n`, 'utf8');
      console.log(`  ✓ ${name}: לוטש`);
      changed++;
    } catch (err) {
      console.warn(`  ⚠️  ${name}: ${err.message}`);
    }
  }

  console.log(`\n✅ לוטשו ${changed} פוסטים.\n`);
}

function toPath(s) {
  if (s.endsWith('.md')) return path.isAbsolute(s) ? s : path.join(ROOT, s);
  return path.join(POSTS, `${s}.md`);
}
