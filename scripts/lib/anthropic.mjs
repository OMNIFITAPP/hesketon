import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildUserPrompt } from './prompt.mjs';
import { editHebrew, validateEdit } from './editor.mjs';
import { groundQuotes, appendQuoteAudit } from './quotes.mjs';

// Very long transcripts cost a lot of tokens. Favorite-podcast volume is low,
// so we allow a generous cap and trim only the extreme tail.
const MAX_TRANSCRIPT_CHARS = 100_000;
const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Turn a transcript into a structured Hebrew post via Claude.
 * @returns {Promise<{title:string, description:string, slug:string, category:string, tags:string[], readingTimeMin?:number, bodyMarkdown:string}>}
 */
export async function generatePost({ transcript, meta, categories, model }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
  }

  const client = new Anthropic({ apiKey });
  const chosenModel = model || process.env.CLAUDE_MODEL || DEFAULT_MODEL;

  let text = (transcript || '').trim();
  if (text.length > MAX_TRANSCRIPT_CHARS) {
    text = text.slice(0, MAX_TRANSCRIPT_CHARS);
  }

  const params = {
    // Generous ceiling: the JSON now also carries the quotes[] array (he+en
    // pairs), so 8000 could truncate a rich post mid-JSON → parse failure.
    model: chosenModel,
    max_tokens: 16000,
    system: buildSystemPrompt(categories),
    messages: [{ role: 'user', content: buildUserPrompt({ transcript: text, meta }) }],
  };
  // Some models (e.g. opus-4-8) reject `temperature`; only send it where supported.
  if (!/opus-4-8/.test(chosenModel)) params.temperature = 0.7;

  const message = await client.messages.create(params);

  const out = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const post = parsePostJson(out);

  // ── Quote-fidelity pass: ensure each quote is a faithful, complete
  //    translation of its source (the writer supplies the verbatim English).
  let quotePairs = [];
  if (process.env.QUOTE_GROUNDING !== 'false' && post.bodyMarkdown && Array.isArray(post.quotes)) {
    try {
      const grounded = await groundQuotes({ body: post.bodyMarkdown, quotes: post.quotes, model });
      post.bodyMarkdown = grounded.body;
      quotePairs = grounded.pairs;
      console.log(`  ↳ נאמנות ציטוטים: ${grounded.corrections} תוקנו מתוך ${grounded.pairs.length}`);
    } catch (err) {
      console.warn(`  ⚠️  דילוג על נאמנות ציטוטים: ${err.message}`);
    }
  }

  // ── Editor pass: polish the Hebrew of the body (cheap; skips the transcript).
  //    Falls back to the original draft if the edit fails its guardrails.
  if (process.env.EDITOR_PASS !== 'false' && post.bodyMarkdown) {
    try {
      const edited = await editHebrew({ body: post.bodyMarkdown, model });
      if (validateEdit(post.bodyMarkdown, edited)) {
        post.bodyMarkdown = edited;
        console.log('  ↳ עריכת לשון: הוחלה ✓');
      } else {
        console.warn('  ⚠️  עריכת לשון נדחתה (לא עברה ולידציה) — נשמרת הטיוטה המקורית');
      }
    } catch (err) {
      console.warn(`  ⚠️  דילוג על עריכת לשון: ${err.message}`);
    }
  }

  // Append the (invisible) quote audit trail last, so the editor can't strip it.
  if (quotePairs.length && post.bodyMarkdown) {
    post.bodyMarkdown = appendQuoteAudit(post.bodyMarkdown, quotePairs);
  }

  return post;
}

/** Best-effort JSON extraction from the model's reply. */
export function parsePostJson(text) {
  let raw = (text || '').trim();

  // Strip ```json … ``` fences if present.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();

  // Otherwise grab the outermost { … }.
  if (!raw.startsWith('{')) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Could not parse the model output as JSON.\n--- first 800 chars ---\n' + text.slice(0, 800));
  }
}
