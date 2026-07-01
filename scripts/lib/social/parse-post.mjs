// ============================================================
//  parse-post.mjs — pull the social-ready raw material out of a
//  published הסכתון post (.md). Reuses gray-matter (already a dep).
//
//  Returns the frontmatter plus three extracted pieces:
//    • lead   — the opening pull-quote { text, cite }
//    • tldr    — the אמ;לק bullet list (string[])
//    • takeaways — the "מה לוקחים מזה" bullets, headline + body (object[])
//  These map 1:1 onto the carousel/quote/story templates.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/** Strip inline markdown/HTML to clean display text. */
function clean(s) {
  return (s || '')
    .replace(/<[^>]+>/g, '')        // any stray tags
    .replace(/\*\*(.+?)\*\*/g, '$1') // **bold**
    .replace(/\*(.+?)\*/g, '$1')     // *italic*
    .replace(/`(.+?)`/g, '$1')       // `code`
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the opening pull-quote: <blockquote class="pull--lead">…<cite>…</cite></blockquote>. */
function extractLead(body) {
  const block = body.match(/<blockquote[^>]*class="[^"]*pull--lead[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (!block) return null;
  const inner = block[1];
  const citeMatch = inner.match(/<cite>([\s\S]*?)<\/cite>/i);
  const cite = citeMatch ? clean(citeMatch[1]).replace(/^[—–-]\s*/, '') : '';
  const text = clean(inner.replace(/<cite>[\s\S]*?<\/cite>/i, ''))
    .replace(/^["“”']|["“”']$/g, '') // trim wrapping quote marks
    .trim();
  return text ? { text, cite } : null;
}

/** Extract the אמ;לק bullets from <aside class="tldr">…<ul><li>…</li></ul>. */
function extractTldr(body) {
  const aside = body.match(/<aside[^>]*class="[^"]*tldr[^"]*"[^>]*>([\s\S]*?)<\/aside>/i);
  const scope = aside ? aside[1] : '';
  if (!scope) return [];
  return [...scope.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((m) => clean(m[1]))
    .filter(Boolean);
}

/** Extract "מה לוקחים מזה" markdown bullets → [{ head, body }]. */
function extractTakeaways(body) {
  const sec = body.match(/##\s*מה לוקחים מזה\s*([\s\S]*?)(?:\n##\s|\n<!--|$)/);
  if (!sec) return [];
  const lines = sec[1].split('\n').filter((l) => /^\s*[-*]\s+/.test(l));
  return lines
    .map((l) => l.replace(/^\s*[-*]\s+/, ''))
    .map((l) => {
      const bold = l.match(/^\*\*(.+?)\*\*\s*(.*)$/);
      if (bold) return { head: clean(bold[1]).replace(/[.:]\s*$/, ''), body: clean(bold[2]) };
      return { head: '', body: clean(l) };
    })
    .filter((t) => t.head || t.body);
}

/**
 * Parse a published post file into social-ready material.
 * @param {string} file absolute path to a src/content/posts/*.md
 */
export function parsePost(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const { data: fm, content } = matter(raw);
  const slug = path.basename(file, '.md');

  return {
    slug,
    draft: !!fm.draft,
    title: fm.title || '',
    description: fm.description || '',
    category: fm.category || '',
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    pubDate: fm.pubDate || '',
    guest: fm.source?.guest || '',
    podcast: fm.source?.podcast || '',
    host: fm.source?.host || '',
    youtubeUrl: fm.source?.youtubeUrl || '',
    url: `/posts/${slug}/`,
    lead: extractLead(content),
    tldr: extractTldr(content),
    takeaways: extractTakeaways(content),
  };
}

/** Load every published (draft:false) post, newest first. */
export function loadPublishedPosts(postsDir) {
  return fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parsePost(path.join(postsDir, f)))
    .filter((p) => !p.draft)
    .sort((a, b) => String(b.pubDate).localeCompare(String(a.pubDate)));
}
