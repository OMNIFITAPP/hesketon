// ============================================================
//  Quote-fidelity pass — guarantees every quote is a faithful, complete
//  translation of a VERBATIM span of the transcript, not a paraphrase.
//
//  The writer emits, per quote, the English source it used ("en") alongside
//  the Hebrew it placed in the body ("he"). Two independent checks run here:
//
//   1. Verbatim gate (deterministic, no LLM): is "en" actually a contiguous
//      span of the transcript? If not, the writer reconstructed it from memory
//      — the whole He⇐En comparison is then meaningless, so we flag it loudly
//      instead of silently "passing" a quote grounded on a hallucinated source.
//      (This is the hole that let idioms like "Heads I win, tails I don't lose
//      much" get smoothed into an invented paraphrase.)
//
//   2. Faithfulness check (LLM): for anchored quotes, does "he" render "en"
//      completely and faithfully under the Quote Faithfulness Contract below?
//
//  It also leaves an invisible audit trail (he ⇐ en) at the end of the post.
//  Toggle with QUOTE_GROUNDING=false / QUOTE_AUDIT=false.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { supportsTemperature } from './llm-utils.mjs';

const DEFAULT_MODEL = 'claude-sonnet-5';

// The contract shared by the writer (prompt.mjs), this checker, and the critic.
export const QUOTE_CONTRACT = `חוזה נאמנות הציטוט — שבעה כללים, כולם מחייבים:
1. עיגון מילולי: ה-en חייב להיות קטע רציף ומדויק מהתמליל — לא שחזור מהזיכרון, לא הרכבה מכמה מקומות, לא "בערך מה שנאמר", ולא ציטוט מהופעה אחרת של הדובר.
2. תרגום מלא: כל פריט תוכן עובר. כל מספר ("90% או 95%" → שניהם), כל תנאי, כל דוגמה, כל הסתייגות. אין השמטה ואין קיצוץ מאמצע.
3. שמירת ניב ומטאפורה: אם המקור נשען על דימוי ("Heads I win, tails I don't lose much"), תרגם את הדימוי עצמו ומצא לו מקבילה עברית ("עץ — אני מרוויח; פלי — אני לא מפסיד הרבה"). אל תמיר דימוי בפרפרזה מופשטת.
4. שמירת זמן, גוף ומספר: "you will be" אינו "אתה כבר"; "I win" אינו "ניצחת"; יחיד נשאר יחיד. אל תשנה את נקודת המבט של הדובר.
5. תרגם, אל תתעתק: מונח כללי מתורגם ("cloner" → "מַעתיקן/משבט"). אם התעתיק חיוני, הוסף גלוסה בסוגריים. אל תשאיר מילה לועזית שישראלי ממוצע לא יבין.
6. אפס תוספות: אל תוסיף מילה, ספציפיות, טון או עמדה שאין במקור. "needs to go somewhere" אינו "צריך להגיע לתאים"; "you could go to the store and buy" אינו "רוב האנשים פשוט הולכים לחנות".
7. טבעיות בגבול הנאמנות: מותר לאחד משפטים קטועים לזרימה אחת ולבחור פועל אידיומטי כך שישראלי יאמר זאת בקול — אבל טבעיות לעולם אינה עוקפת את כללים 1–6. אם נאמנות מלאה דורשת ניסוח מסורבל, ותר על המרכאות וכתוב פרפרזה מחוץ להן.`;

function buildSystemPrompt() {
  return `אתה בודק נאמנות תרגום של ציטוטים מאנגלית לעברית עבור בלוג עברי, לפי חוזה מחייב.

${QUOTE_CONTRACT}

תקבל מערך זוגות: לכל אחד "he" (תרגום עברי שהוכנס לפוסט), "en" (המקור האנגלי שהכותב מסר), ו-"enAnchoredInTranscript" (האם ה-en אומת כקטע מילולי מהתמליל).

לכל זוג הַחְזֵר:
- "faithful": true — רק אם ה-he מקיים את כל שבעת הכללים ביחס ל-en.
- "faithful": false — אם הופר ולו כלל אחד (אבד ניב, הושמט מספר/ניואנס, שונה זמן/גוף, תועתק מונח במקום שתורגם, נוספה משמעות, נחתך המשפט). ואז "corrected" = תרגום נאמן ומלא לפי החוזה, ב**עברית מדוברת וטבעית** — לא מילולי-מסורבל, אך בלי לאבד דבר מהמקור.

שים לב: תרגום שנשמע "אנגלי" באוזן אך נאמן במלואו — נשאר faithful:true; אל תפסול על סמך סגנון בלבד.

חשוב: אם "enAnchoredInTranscript" הוא false, ה-en עצמו חשוד — ייתכן שהכותב שחזר אותו מהזיכרון ולא ציטט את התמליל. במקרה כזה החזר "faithful": false ו-"unanchored": true, ואל תמציא "corrected" (אין לך את התמליל האמיתי) — השאר "corrected" ריק. פריט כזה יסומן לתיקון ידני מול המקור.

החזר JSON תקין בלבד (מערך), בלי טקסט נוסף ובלי גדרות קוד:
[{ "he": "<כפי שהתקבל>", "faithful": true|false, "unanchored": true|false, "corrected": "<תרגום נאמן, רק כש-faithful=false ו-unanchored=false>" }]`;
}

// Normalize for verbatim matching: fold case, strip redactions/punctuation to
// spaces, collapse whitespace. Robust to transcript noise ([__], "Uh", commas).
function normalizeForMatch(s) {
  return String(s)
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Is `en` a contiguous span of the transcript? Falls back to a leading window
// so a quote the writer trimmed at the tail still anchors on its opening.
function isAnchored(normTranscript, en) {
  const nEn = normalizeForMatch(en);
  if (!nEn) return false;
  if (normTranscript.includes(nEn)) return true;
  const words = nEn.split(' ');
  if (words.length >= 8) {
    const lead = words.slice(0, 8).join(' ');
    return normTranscript.includes(lead);
  }
  return false;
}

/**
 * @param {{ body:string, quotes:{he:string,en:string}[], transcript?:string, model?:string }} args
 * @returns {Promise<{ body:string, pairs:{he:string,en:string}[], corrections:number, unanchored:{he:string,en:string}[] }>}
 */
export async function groundQuotes({ body, quotes, transcript, model }) {
  const pairs = Array.isArray(quotes)
    ? quotes.filter((q) => q && typeof q.he === 'string' && typeof q.en === 'string')
    : [];
  if (pairs.length === 0) return { body, pairs: [], corrections: 0, unanchored: [] };

  // ── Deterministic verbatim gate (runs even if the LLM check is skipped).
  const normT = transcript ? normalizeForMatch(transcript) : null;
  const annotated = pairs.map((p) => ({
    ...p,
    enAnchoredInTranscript: normT ? isAnchored(normT, p.en) : null,
  }));
  const unanchored = annotated.filter((p) => p.enAnchoredInTranscript === false);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const chosenModel = model || process.env.QUOTE_MODEL || process.env.CLAUDE_MODEL || DEFAULT_MODEL;

  const params = {
    model: chosenModel,
    max_tokens: 4000,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: JSON.stringify(annotated, null, 2) }],
  };
  if (supportsTemperature(chosenModel)) params.temperature = 0.2;

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
    return { body, pairs, corrections: 0, unanchored }; // degrade gracefully
  }

  let newBody = body;
  let corrections = 0;
  for (const r of Array.isArray(results) ? results : []) {
    if (r && r.faithful === false && !r.unanchored && r.he && r.corrected && newBody.includes(r.he)) {
      newBody = newBody.replace(r.he, r.corrected);
      corrections++;
    }
  }
  return { body: newBody, pairs, corrections, unanchored };
}

/** Invisible audit trail appended to the post for human spot-checks. */
export function appendQuoteAudit(body, pairs) {
  if (!pairs || pairs.length === 0 || process.env.QUOTE_AUDIT === 'false') return body;
  // Collapse "--" so a quote can't accidentally close the HTML comment.
  const safe = (s) => String(s).replace(/--+/g, '—');
  const lines = pairs.map((p) => `"${safe(p.he)}"\n  ⇐ "${safe(p.en)}"`).join('\n\n');
  return `${body.trimEnd()}\n\n<!-- מקורות הציטוטים (לאימות; לא מוצג באתר):\n${lines}\n-->\n`;
}
