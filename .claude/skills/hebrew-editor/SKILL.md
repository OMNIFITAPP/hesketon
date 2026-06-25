---
name: hebrew-editor
description: >-
  Polish Hebrew text to read as natural, fluent, native magazine Hebrew — never
  translated. Use when writing or editing any Hebrew post/content for hesketon,
  or when the user asks to improve Hebrew phrasing, fix translationese, or proof
  Hebrew copy. Principles mirror the pipeline's editor pass (scripts/lib/editor.mjs).
---

# Hebrew editor

Make Hebrew read as if written natively, not translated. Apply when authoring or
editing Hebrew copy for hesketon (manual posts, fixes, the AI editor prompt).

## Fix
- **Translationese** — English word order, literal calques, phrases that "smell"
  translated. Recast into natural Hebrew.
- **Stray transliterations** — replace borrowed English with the accepted Hebrew
  term: "באוט"→"מקטע"/"מפגש", "פוקוס"→"מיקוד", "טיימינג"→"תזמון".
- **Scientific/technical terms in English only** — use the accepted Hebrew term,
  optionally with the English in parentheses on first mention:
  "תגובת הקורטיזול ליקיצה (cortisol awakening response)". Never leave English alone.
- **Grammar** — gender/number agreement, definiteness (יידוע), correct
  prepositions and connectors, verb tense.
- **Syntax** — break long/clumsy sentences; smooth transitions; cut filler.
  Read-aloud test: if you stumble reading it aloud, rewrite it.
- **Punctuation** — proper Hebrew punctuation; natural magazine register
  (not over-formal, not slang).

## Never change
- Facts, numbers, percentages, dates, names.
- Quotes — text inside `<blockquote>`, after Markdown `>`, or within "…" stays
  verbatim. Do not reword quotes.
- HTML tags/classes exactly: `<blockquote class="pull--lead">`, `<cite>`,
  `<aside class="tldr">`, `<ul>/<li>`, `<mark>`, `<sup>`, `<a class="cite">`.
- Post structure: section order, `##` headings, links, length (roughly).
- Don't add new content/ideas or summarize away detail.

## Project conventions
See `scripts/lib/prompt.mjs` (house style), `scripts/lib/editor.mjs` (the
automated editor pass), and the term-accuracy rules: never force literal
translations (the "חוצצי עייפות" lesson), watch false friends, gloss foreign
terms sparingly (≤2 per post, first mention only).
