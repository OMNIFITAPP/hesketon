import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildUserPrompt } from './prompt.mjs';

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

  const message = await client.messages.create({
    model: chosenModel,
    max_tokens: 8000,
    temperature: 0.7,
    system: buildSystemPrompt(categories),
    messages: [{ role: 'user', content: buildUserPrompt({ transcript: text, meta }) }],
  });

  const out = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  return parsePostJson(out);
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
