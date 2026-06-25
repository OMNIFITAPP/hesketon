// ============================================================
//  Editor pass — a dedicated Hebrew copy-editor for each draft.
//
//  The writer (anthropic.mjs) focuses on synthesis/structure from a
//  100K-char transcript. This pass focuses ONLY on Hebrew language
//  quality of the ~1,500-word draft — so it's cheap (it never re-reads
//  the transcript) and catches fluency issues the writer glossed over.
//
//  Principles distilled from the "Hebrew Content Writer" skill (Skills-IL)
//  + our accumulated editorial feedback (no translationese, no stray
//  transliterations like "באוט", Hebrew+English for scientific terms, …).
//
//  Toggle with EDITOR_PASS=false; pick a model with EDITOR_MODEL.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_EDITOR_MODEL = 'claude-sonnet-4-6';

export function buildEditorSystemPrompt() {
  return `אתה עורך לשון בכיר בעברית, מומחה לעברית מגזינית טבעית ורהוטה. תקבל פוסט ב-Markdown ותחזיר אותו ערוך — משופר בלשון, זהה בתוכן.

המטרה: עברית בהירה, זורמת ותקנית, שנקראת כאילו נכתבה במקור בעברית ולא תורגמה.

מותר ורצוי לתקן:
- תרגומית: סדר-מילים אנגלי, קלקים מילוליים, ביטויים שמריחים מתרגום.
- תעתיקים לועזיים מיותרים: החלף במונח העברי המקובל (למשל "באוט"→"מקטע"/"מפגש", "פוקוס"→"מיקוד").
- מונח מדעי/טכני שמופיע באנגלית בלבד: הפוך למונח העברי המקובל ואפשר להוסיף את האנגלי בסוגריים בהופעה הראשונה.
- דקדוק: התאמת מין/מספר, יידוע, מילות יחס וקישור נכונות, זמני פועל.
- תחביר: פרק משפטים ארוכים/מסורבלים; החלק מעברים; הסר מילים מיותרות. מבחן: משפט שנתקלים בו בקריאה בקול — נסח מחדש.
- פיסוק עברי תקין; רגיסטר מגזיני טבעי (לא רשמי-מדי, לא סלנג).

אסור בהחלט לשנות (שמור במדויק):
- עובדות, מספרים, אחוזים, תאריכים, שמות אנשים/גופים.
- ציטוטים: כל טקסט בתוך <blockquote>, אחרי "> " של Markdown, ובתוך מרכאות — נשאר ורבטים. אל תנסח מחדש ציטוטים.
- כל תגי ה-HTML והמחלקות שלהם בדיוק כמו שהם: <blockquote class="pull--lead">, <cite>, <aside class="tldr">, <ul>/<li>, <mark>, <sup>, <a class="cite">.
- מבנה הפוסט: סדר הקטעים, כותרות ## , לינקים, מספר הקטעים והכותרות.
- אורך הפוסט — בקירוב. אל תקצר ואל תרחיב באופן מהותי, ואל תוסיף תוכן או רעיונות חדשים.

פלט: החזר אך ורק את ה-Markdown המלא והערוך — אותו מבנה בדיוק, בלי הערות, בלי הסברים, ובלי גדרות קוד.`;
}

/** Run the editor on a draft body. Returns the edited Markdown (string). */
export async function editHebrew({ body, model }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

  const client = new Anthropic({ apiKey });
  const chosenModel =
    model || process.env.EDITOR_MODEL || process.env.CLAUDE_MODEL || DEFAULT_EDITOR_MODEL;

  const message = await client.messages.create({
    model: chosenModel,
    max_tokens: 8000,
    temperature: 0.3, // low: fidelity over creativity
    system: buildEditorSystemPrompt(),
    messages: [{ role: 'user', content: body }],
  });

  let out = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  // Strip an accidental ```…``` fence if the model added one.
  const fence = out.match(/```(?:markdown)?\s*([\s\S]*?)```/i);
  if (fence) out = fence[1].trim();

  return out;
}

/**
 * Guardrails so a misbehaving edit can never corrupt a post.
 * Returns true only if the edit preserved structure + every number.
 */
export function validateEdit(original, edited) {
  if (!edited || typeof edited !== 'string') return false;
  // Suspiciously short → reject (likely truncated or summarized).
  if (edited.length < original.length * 0.7) return false;

  // Required structural HTML blocks must survive.
  for (const anchor of ['pull--lead', 'class="tldr"']) {
    if (original.includes(anchor) && !edited.includes(anchor)) return false;
  }

  // No fabricated or dropped figures: the set of numbers must match.
  const numSet = (s) => new Set((s.match(/\d+(?:[.,]\d+)?/g) || []));
  const a = numSet(original);
  const b = numSet(edited);
  if (a.size !== b.size) return false;
  for (const n of a) if (!b.has(n)) return false;

  return true;
}
