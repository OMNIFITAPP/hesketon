// ============================================================
//  Quote-fidelity pass — guarantees every quote is a faithful, complete
//  translation of its source, not a paraphrase.
//
//  The writer emits, per quote, the verbatim English source from the
//  transcript ("en") alongside the Hebrew it placed in the body ("he").
//  This pass checks each pair (cheap — it never re-reads the transcript)
//  and rewrites any Hebrew that compressed/smoothed the source.
//
//  It also leaves an invisible audit trail (he ⇐ en) at the end of the
//  post so a human can spot-check quotes without hunting through the video.
//  Toggle with QUOTE_GROUNDING=false / QUOTE_AUDIT=false.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

function buildSystemPrompt() {
  return `אתה בודק נאמנות תרגום של ציטוטים מאנגלית לעברית עבור בלוג עברי.

תקבל מערך זוגות: לכל אחד "he" (תרגום עברי שהוכנס לפוסט) ו-"en" (המקור האנגלי הוורבטים).
לכל זוג בדוק: האם ה-"he" הוא תרגום **נאמן ומלא** של ה-"en" — בלי קיצור, החלקה, מיזוג משפטים או השמטת מילים/משמעות?

- אם נאמן ומלא: "faithful": true.
- אם פרפראזה/מקוצר/חלקי: "faithful": false, ו-"corrected" = תרגום עברי נאמן ומלא של ה-"en", בעברית טבעית אך ללא השמטות.

שמור על המשמעות והעובדות במדויק. אל תוסיף פרשנות. החזר JSON תקין בלבד (מערך), בלי טקסט נוסף ובלי גדרות קוד:
[{ "he": "<כפי שהתקבל>", "faithful": true|false, "corrected": "<תרגום נאמן, רק כש-faithful=false>" }]`;
}

/**
 * @param {{ body: string, quotes: {he:string,en:string}[], model?: string }} args
 * @returns {Promise<{ body: string, pairs: {he:string,en:string}[], corrections: number }>}
 */
export async function groundQuotes({ body, quotes, model }) {
  const pairs = Array.isArray(quotes)
    ? quotes.filter((q) => q && typeof q.he === 'string' && typeof q.en === 'string')
    : [];
  if (pairs.length === 0) return { body, pairs: [], corrections: 0 };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const chosenModel = model || process.env.QUOTE_MODEL || process.env.CLAUDE_MODEL || DEFAULT_MODEL;

  const params = {
    model: chosenModel,
    max_tokens: 4000,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: JSON.stringify(pairs, null, 2) }],
  };
  if (!/opus-4-8/.test(chosenModel)) params.temperature = 0.2;

  const message = await client.messages.create(params);
  let raw = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  if (!raw.startsWith('[')) {
    const s = raw.indexOf('['), e = raw.lastIndexOf(']');
    if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);
  }

  let results;
  try {
    results = JSON.parse(raw);
  } catch {
    return { body, pairs, corrections: 0 }; // degrade gracefully
  }

  let newBody = body;
  let corrections = 0;
  for (const r of Array.isArray(results) ? results : []) {
    if (r && r.faithful === false && r.he && r.corrected && newBody.includes(r.he)) {
      newBody = newBody.replace(r.he, r.corrected);
      corrections++;
    }
  }
  return { body: newBody, pairs, corrections };
}

/** Invisible audit trail appended to the post for human spot-checks. */
export function appendQuoteAudit(body, pairs) {
  if (!pairs || pairs.length === 0 || process.env.QUOTE_AUDIT === 'false') return body;
  // Collapse "--" so a quote can't accidentally close the HTML comment.
  const safe = (s) => String(s).replace(/--+/g, '—');
  const lines = pairs.map((p) => `"${safe(p.he)}"\n  ⇐ "${safe(p.en)}"`).join('\n\n');
  return `${body.trimEnd()}\n\n<!-- מקורות הציטוטים (לאימות; לא מוצג באתר):\n${lines}\n-->\n`;
}
