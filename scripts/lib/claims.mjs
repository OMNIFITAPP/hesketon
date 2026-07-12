// ============================================================
//  Claims-fidelity pass — the quote-grounding idea, generalized to
//  every factual statement in the post (not just verbatim quotes).
//
//  The writer emits, per factual claim it placed in the body, the exact
//  Hebrew sentence ("he") and the id of the brief idea it relies on
//  ("ideaId"). This pass checks each claim against that idea's verbatim
//  evidence snippets: is it supported? attributed to the right speaker?
//  are the numbers exactly as said? Unsupported claims are corrected
//  in-place; unverifiable ones are flagged for the human reviewer.
//
//  Cheap — it never re-reads the transcript, only the evidence snippets.
//  Toggle with CLAIM_GROUNDING=false; pick a model with CLAIM_MODEL.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { parseModelJson, supportsTemperature } from './llm-utils.mjs';
import { ideaIndex } from './analyst.mjs';

const DEFAULT_MODEL = 'claude-sonnet-5';

function buildSystemPrompt() {
  return `אתה בודק עובדות של בלוג עברי שמסכם פודקאסטים. תקבל רשימת "טענות": לכל אחת המשפט העברי כפי שנכתב בפוסט ("he"), הראיות הוורבטים מהתמלול באנגלית ("evidence"), סוג האמירה ("type": עובדה/טענה/דעה/סיפור/דוגמה/עצה) ומי אמר אותה במקור ("speaker").

לכל טענה בדוק שלושה דברים:
1. תמיכה — האם המשפט העברי נתמך במלואו בראיות? אסור שהמשפט יגיד יותר ממה שנאמר (הגזמה, הכללה, הוספת ודאות).
2. ייחוס — אם המשפט מייחס את הדברים למישהו, האם זה הדובר הנכון?
3. מספרים — כל מספר במשפט חייב להיות זהה למספר בראיות, באותה משמעות (יחס ≠ אחוז; הנחה ≠ תשואה).

וגם: אם type הוא "דעה" או "טענה" אבל המשפט העברי מנוסח כעובדה מוחלטת (בלי "לדעתו"/"לטענתו"/"הוא מאמין") — תקן את הניסוח כך שישקף שמדובר בעמדה של הדובר.

החזר לכל טענה:
- נתמכת ומנוסחת נכון: "ok": true
- ניתנת לתיקון (ייחוס שגוי, מספר שגוי, הגזמה, עובדה-במקום-דעה): "ok": false, "corrected": "<המשפט המתוקן בעברית — שינוי מינימלי, שומר על הסגנון>"
- לא ניתן לאמת מהראיות בכלל: "ok": false, "flag": "<הסבר קצר בעברית מה הבעיה>"

שמור על סגנון הכתיבה של המשפט המקורי; תקן רק מה שחייבים. החזר JSON תקין בלבד (מערך), בלי טקסט נוסף:
[{ "he": "<כפי שהתקבל>", "ok": true|false, "corrected": "<רק אם יש תיקון>", "flag": "<רק אם לא ניתן לאמת>" }]`;
}

/**
 * @param {{ body: string, claims: {he:string, ideaId:string}[], brief: object, model?: string }} args
 * @returns {Promise<{ body: string, checked: number, corrections: number, flagged: {he:string, flag:string}[] }>}
 */
export async function groundClaims({ body, claims, brief, model }) {
  const ideas = ideaIndex(brief);
  const items = (Array.isArray(claims) ? claims : [])
    .filter((c) => c && typeof c.he === 'string' && c.he.trim())
    .map((c) => {
      const idea = ideas.get(c.ideaId);
      return {
        he: c.he,
        evidence: idea?.evidence || [],
        type: idea?.type || 'לא ידוע',
        speaker: idea?.speaker || '',
      };
    })
    // A claim pointing at a missing idea has nothing to be checked against —
    // flag it rather than silently passing it.
    .map((c) => ({ ...c, _noEvidence: c.evidence.length === 0 }));

  const checkable = items.filter((c) => !c._noEvidence);
  const flagged = items
    .filter((c) => c._noEvidence)
    .map((c) => ({ he: c.he, flag: 'אין ראיה מקושרת בתיק הפרק — לאמת ידנית' }));

  if (checkable.length === 0) return { body, checked: 0, corrections: 0, flagged };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const chosenModel = model || process.env.CLAIM_MODEL || process.env.CLAUDE_MODEL || DEFAULT_MODEL;

  const params = {
    model: chosenModel,
    max_tokens: 6000,
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: JSON.stringify(
          checkable.map(({ he, evidence, type, speaker }) => ({ he, evidence, type, speaker })),
          null,
          1,
        ),
      },
    ],
  };
  if (supportsTemperature(chosenModel)) params.temperature = 0.2;

  const message = await client.messages.create(params);
  const out = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();

  let results;
  try {
    results = parseModelJson(out);
  } catch {
    return { body, checked: checkable.length, corrections: 0, flagged }; // degrade gracefully
  }

  let newBody = body;
  let corrections = 0;
  for (const r of Array.isArray(results) ? results : []) {
    if (!r || r.ok === true || !r.he) continue;
    if (r.corrected && newBody.includes(r.he)) {
      newBody = newBody.replace(r.he, r.corrected);
      corrections++;
    } else if (r.flag) {
      flagged.push({ he: r.he, flag: r.flag });
    }
  }
  return { body: newBody, checked: checkable.length, corrections, flagged };
}
