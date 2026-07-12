import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildUserPrompt } from './prompt.mjs';
import { editHebrew, proofHebrew, validateEdit } from './editor.mjs';
import { groundQuotes, appendQuoteAudit } from './quotes.mjs';
import { analyzeTranscript, briefForWriter } from './analyst.mjs';
import { groundClaims } from './claims.mjs';
import { parseModelJson, supportsTemperature } from './llm-utils.mjs';

// A 3-4hr episode is ~250-350K chars; reading it in full costs well under a
// shekel per pass at current Sonnet pricing. The cap now trims only truly
// extreme tails — "half the episode was never read" is no longer a thing.
const MAX_TRANSCRIPT_CHARS = 400_000;
const DEFAULT_MODEL = 'claude-sonnet-5';

/**
 * Turn a transcript into a structured Hebrew post via the full pipeline:
 *
 *   ① analyst (deep read → episode brief)      ANALYST_PASS=false to skip
 *   ② writer (post built from the brief)
 *   ③ quote grounding (verbatim fidelity)      QUOTE_GROUNDING=false to skip
 *   ④ claims verification (factual fidelity)   CLAIM_GROUNDING=false to skip
 *   ⑤ line editor (Hebrew fluency)             EDITOR_PASS=false to skip
 *   ⑥ proofreader (final grammar pass)         PROOF_PASS=false to skip
 *
 * @returns {Promise<{ post: object, report: object }>}
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
    console.warn(`  ⚠️  התמלול נחתך ב-${MAX_TRANSCRIPT_CHARS.toLocaleString('en-US')} תווים`);
    text = text.slice(0, MAX_TRANSCRIPT_CHARS);
  }

  const report = { analyst: null, quotes: null, claims: null, editor: false, proof: false };

  // ── ① Analyst: deep read of the FULL transcript → structured episode brief.
  let brief = null;
  if (process.env.ANALYST_PASS !== 'false') {
    try {
      brief = await analyzeTranscript({ transcript: text, meta, model });
      report.analyst = { ideas: brief.keyIdeas.length };
      console.log(`  ↳ אנליסט: תיק פרק עם ${brief.keyIdeas.length} רעיונות מדורגים`);
    } catch (err) {
      console.warn(`  ⚠️  דילוג על שלב האנליסט: ${err.message}`);
    }
  }

  // ── ② Writer: builds the post from the brief (falls back to a cold read).
  const params = {
    // Generous ceiling: the JSON also carries quotes[] + claims[], so a low
    // cap could truncate a rich post mid-JSON → parse failure.
    model: chosenModel,
    max_tokens: 16000,
    system: buildSystemPrompt(categories),
    messages: [
      {
        role: 'user',
        content: buildUserPrompt({
          transcript: text,
          meta,
          brief: brief ? briefForWriter(brief) : null,
        }),
      },
    ],
  };
  if (supportsTemperature(chosenModel)) params.temperature = 0.7;

  const message = await client.messages.create(params);

  const out = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  // If the model hit the token ceiling the JSON is cut off mid-structure.
  // parseModelJson will try to repair it, but flag the cause so it's obvious.
  if (message.stop_reason === 'max_tokens') {
    console.warn(`  ⚠️  הפלט נחתך בתקרת ${params.max_tokens} טוקנים — מנסה לשקם JSON חלקי`);
  }

  const post = parseModelJson(out);

  // ── ③ Quote-fidelity pass: every quote is a faithful, complete translation.
  let quotePairs = [];
  if (process.env.QUOTE_GROUNDING !== 'false' && post.bodyMarkdown && Array.isArray(post.quotes)) {
    try {
      const grounded = await groundQuotes({ body: post.bodyMarkdown, quotes: post.quotes, model });
      post.bodyMarkdown = grounded.body;
      quotePairs = grounded.pairs;
      report.quotes = { checked: grounded.pairs.length, corrections: grounded.corrections };
      console.log(`  ↳ נאמנות ציטוטים: ${grounded.corrections} תוקנו מתוך ${grounded.pairs.length}`);
    } catch (err) {
      console.warn(`  ⚠️  דילוג על נאמנות ציטוטים: ${err.message}`);
    }
  }

  // ── ④ Claims verification: every factual statement vs. its brief evidence.
  if (
    process.env.CLAIM_GROUNDING !== 'false' &&
    brief &&
    post.bodyMarkdown &&
    Array.isArray(post.claims) &&
    post.claims.length
  ) {
    try {
      const res = await groundClaims({ body: post.bodyMarkdown, claims: post.claims, brief, model });
      post.bodyMarkdown = res.body;
      report.claims = { checked: res.checked, corrections: res.corrections, flagged: res.flagged };
      const flaggedNote = res.flagged.length ? `, ${res.flagged.length} לבדיקה ידנית` : '';
      console.log(`  ↳ אימות עובדתי: ${res.checked} טענות נבדקו, ${res.corrections} תוקנו${flaggedNote}`);
    } catch (err) {
      console.warn(`  ⚠️  דילוג על אימות עובדתי: ${err.message}`);
    }
  }

  // ── ⑤ Editor pass: polish the Hebrew of the body (cheap; skips the transcript).
  //    Falls back to the original draft if the edit fails its guardrails.
  if (process.env.EDITOR_PASS !== 'false' && post.bodyMarkdown) {
    try {
      const edited = await editHebrew({ body: post.bodyMarkdown, model });
      if (validateEdit(post.bodyMarkdown, edited)) {
        post.bodyMarkdown = edited;
        report.editor = true;
        console.log('  ↳ עריכת לשון: הוחלה ✓');
      } else {
        console.warn('  ⚠️  עריכת לשון נדחתה (לא עברה ולידציה) — נשמרת הטיוטה המקורית');
      }
    } catch (err) {
      console.warn(`  ⚠️  דילוג על עריכת לשון: ${err.message}`);
    }
  }

  // ── ⑥ Proofreader: minimal final grammar/typo pass, same guardrails.
  if (process.env.PROOF_PASS !== 'false' && post.bodyMarkdown) {
    try {
      const proofed = await proofHebrew({ body: post.bodyMarkdown, model });
      if (validateEdit(post.bodyMarkdown, proofed)) {
        post.bodyMarkdown = proofed;
        report.proof = true;
        console.log('  ↳ הגהה: הוחלה ✓');
      } else {
        console.warn('  ⚠️  ההגהה נדחתה (לא עברה ולידציה) — נשמר נוסח העורך');
      }
    } catch (err) {
      console.warn(`  ⚠️  דילוג על הגהה: ${err.message}`);
    }
  }

  // Append the (invisible) quote audit trail last, so no edit pass strips it.
  if (quotePairs.length && post.bodyMarkdown) {
    post.bodyMarkdown = appendQuoteAudit(post.bodyMarkdown, quotePairs);
  }

  return { post, report };
}
