// ============================================================
//  Chief-editor pass — the adversarial read the 2026-07 review found
//  missing: "אין שלב שבו עורך אחר מתנגד לכותב".
//
//  The writer, having produced a sentence, tends to keep its choices.
//  This pass reads the draft AGAINST the writer: ignore its intent,
//  hunt for semantic repetition across the opening layers, empty
//  profundity, anecdotes inflated into science, padding written to hit
//  a word count — and actually rewrite/delete, not just comment.
//
//  It is a CONTENT edit (may delete/merge paragraphs), unlike the
//  language editor that follows it — so it has its own, looser
//  validator: structure anchors must survive, it may shorten down to
//  55% of the draft, and it may DELETE numbers but never add new ones.
//
//  Toggle with CRITIC_PASS=false; pick a model with CRITIC_MODEL.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { supportsTemperature } from './llm-utils.mjs';

// Judgment-heavy, reads only the ~1,500-word draft — Opus is cheap here.
const DEFAULT_CRITIC_MODEL = 'claude-opus-4-8';

export function buildCriticSystemPrompt() {
  return `אתה העורך הראשי של "הסכתון". תקבל טיוטה של פוסט (ולעיתים גם את התזה ותקציר תיק הפרק). התעלם מכוונת הכותב וקרא את הטקסט כעורך ספקן: החזק ממנו עובר, החלש נמחק. אחרי הקריאה — שכתב בפועל.

מה אתה מחפש ומתקן:

1. מהלך אחד, לא שתי כתבות. זו הבדיקה החשובה ביותר. שאל: מה הזווית המובילה של הפוסט — הטענה האחת שהכול משרת? אם שני נושאים מתחרים על ההובלה (למשל "כל מה שחשבתם הוא מיתוס" מול "אין מינון אחד שמתאים לכל רקמה"), אחד חייב להוביל והשני להצטמצם לתפקיד משנה שמזין אותו. סימני אזהרה: פרק ארוך שהוא כתבה בפני עצמה בתוך הכתבה; הפתיחה מבטיחה זווית אחת אבל הגוף מתפתח לזווית אחרת; שני "שיאים" מתחרים. הפתרון: קצר או מזג את הזווית המשנית כך שתשמש הקדמה/דוגמה/סיוג לזווית המובילה — לא ראש שני.

2. חזרה סמנטית בין שכבות הפתיחה. אם אותו רעיון מופיע בציטוט הפותח, באמ;לק, בפתיחה ובפרק הראשון — הוא נשאר במקום אחד, והשאר משוכתבים כך שכל שכבה תעשה תפקיד אחר (הציטוט מסקרן; האמ;לק ממפה; הפתיחה מציבה מתח; הפרק הראשון מתחיל להסביר). המבחן: הקורא מתקדם, לא מקבל את אותו מסר בניסוחים משתנים. כולל: כותרת ## שהיא חזרה כמעט-מילולית של הציטוט באותה פסקה — שנה אחת מהן.

3. חזרה רעיונית בגוף. לכל פסקה שאל: מה המידע החדש כאן? אין — מזג או מחק. חזרה היא חזרה גם כשהמילים שונות לגמרי.

4. עומק מדומה. משפטים שנשמעים משמעותיים אך ריקים ("זהו רצף הרגשות שהופך קבוצה לקבוצה", "מתנה שכל אדם מחזיק בה", "עיקרון אוניברסלי") — מחק או תרגם לפעולה קונקרטית. סיום פילוסופי-השראתי מוחלף בחזרה לתזה בתמונה מוחשית.

5. הגבהת מעמד. התנסות אישית שכונתה "ניסוי", תגובה של אדם אחד שהוצגה כ"ממצא", "הוכיח" בלי מחקר, מתאם שהפך סיבתיות — הורד לקרקע, כולל בכותרות הביניים ("הניסוי שערך X" → "הרגע שבו X ניסה את זה בעצמו").

6. מספר שנזרק בשיחה אינו ממצא. אם דובר זרק אחוז או נתון בעל-פה כתגובה מהירה (למשל "כן, 90 אחוזים"), בלי מחקר, דו"ח או מדגם שהוצג — אל תנסח אותו כ"בדיקה מצאה" או "מחקר הראה". רכך ל"לדבריו", או השמט אם הוא לא חיוני לתזה. הבחן בין נתון שגובה במחקר לבין רושם שהדובר נקב בו.

7. כותרות ביניים שקובעות יותר מהגוף. כותרת שמציגה את עמדת המרואיין כקביעה של הבלוג, או מבטיחה יותר ממה שהפרק מקיים — רכך לדיוק.

8. ניפוח לאורך. פסקה שקיימת רק כדי להאריך (חזרה על התזה, מתיחת מטאפורה, הסבר של מה שכבר הובן, פרק צדדי שלא משרת את התזה) — מחק. טקסט קצר וצפוף גובר על ארוך ומדולל.

9. מקצב מכני. פסקאות באורך אחיד, שורת מחץ בסוף כל פרק, רצף קבוע של טענה→הסבר→פאנץ' — שבור את הסימטריה: גוון אורכים, מזג פסקאות קצרות, מחק שורות מחץ מיותרות. סיום פרק לא אמור להישמע כמו ציטוט לאינסטגרם.

10. תחביר שבור או מתורגם שמסתיר תמונה לא ברורה — נסח מחדש לתמונה אחת חדה.

11. גשר לוגי שנשען על אנגלית. חפש משפט שבו טענה מוצגת כנובעת מקודמתה ("קרוב יותר ל...", "לכן", "במובן העמוק") אך הקורא הישראלי אינו רואה למה — לרוב כי הקשר קיים באנגלית בלבד (משחק-מילים, שורש משותף, ניב). התחביר תקין, אך ההיגיון קרס בתרגום. שכתב כך שהרעיון ייאמר ישירות, בלי להישען על קשר שאינו קיים בעברית. דוגמה: "המושג קרוב יותר להישרדות המתאים ביותר" (fitness↔fittest) — נון-סקוויטר בעברית; תקן ל"עד כמה הגוף מותאם לסביבה". חל גם על דימוי שהקונוטציה שלו מתהפכת (anchor מושך מטה; "עוגן" בעברית דווקא מייצב).

12. פסקאות מנותקות. פסקה שנפתחת בלי זיקה נראית לקודמתה — הקורא לא יודע למה היא מגיעה עכשיו — מחייבת הכרעה: בנה גשר לוגי קצר, הזז אותה למקום שממנו היא נובעת, או מחק. אבל אל תתקן מכנית — פתיחת כל פסקה במילת קישור היא סימן AI בפני עצמו; עדיף הד תוכני או ניגוד.

מה אסור לך לשנות:
- עובדות, מספרים, אחוזים, שמות וייחוסים — מותר למחוק משפט שלם, אסור לשנות בו נתון. אסור להוסיף אף עובדה, מספר או רעיון חדש.
- טקסט בתוך מרכאות ובתוך <blockquote> — ציטוטים נשארים ורבטים. את הציטוט הפותח (pull--lead) אסור למחוק; ציטוט גוף שחוזר על טקסט סמוך מותר למחוק בשלמותו.
- תגי ה-HTML והמחלקות (<blockquote class="pull--lead">, <aside class="tldr">, <ul>/<li>, <mark>) וסדר האנטומיה: ציטוט → אמ;לק → פתיחה → גוף → "מה לוקחים מזה".
- הערות HTML (<!-- -->) נשארות כמו שהן.

פלט: ה-Markdown המלא המשוכתב בלבד — בלי הערות, בלי הסברים, בלי גדרות קוד.`;
}

/**
 * Run the adversarial chief-editor pass on a draft body.
 * @param {{ body: string, thesis?: string, briefSummary?: string, model?: string }} args
 * @returns {Promise<string>} the rewritten Markdown.
 */
export async function chiefEdit({ body, thesis, briefSummary, model }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

  const client = new Anthropic({ apiKey });
  const chosenModel =
    model || process.env.CRITIC_MODEL || process.env.CLAUDE_MODEL || DEFAULT_CRITIC_MODEL;

  const parts = [];
  if (thesis) parts.push(`התזה המוצהרת של הפוסט: ${thesis}`);
  if (briefSummary) parts.push(`תקציר תיק הפרק (לבדוק שהפוסט משרת אותו):\n${briefSummary}`);
  parts.push('הטיוטה:');
  parts.push(body);

  const params = {
    model: chosenModel,
    max_tokens: 9000,
    system: buildCriticSystemPrompt(),
    messages: [{ role: 'user', content: parts.join('\n\n') }],
  };
  if (supportsTemperature(chosenModel)) params.temperature = 0.3;

  const message = await client.messages.create(params);
  let out = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const fence = out.match(/```(?:markdown)?\s*([\s\S]*?)```/i);
  if (fence) out = fence[1].trim();
  return out;
}

/**
 * Guardrails for a CONTENT edit: deletion is legitimate (that's the job),
 * fabrication is not. Returns true only if the edit kept the anatomy,
 * didn't collapse the post, and introduced no number that wasn't there.
 */
export function validateChiefEdit(original, edited) {
  if (!edited || typeof edited !== 'string') return false;
  // May cut padding hard — but a draft shrunk below ~55% (or grown wildly)
  // means the model went off-script.
  if (edited.length < original.length * 0.55) return false;
  if (edited.length > original.length * 1.15) return false;

  for (const anchor of ['pull--lead', 'class="tldr"', 'מה לוקחים מזה']) {
    if (original.includes(anchor) && !edited.includes(anchor)) return false;
  }

  // No new figures: numbers(edited) ⊆ numbers(original). Deleting is fine.
  const numSet = (s) => new Set(s.replace(/<!--[\s\S]*?-->/g, '').match(/\d+(?:[.,]\d+)?/g) || []);
  const before = numSet(original);
  for (const n of numSet(edited)) if (!before.has(n)) return false;

  return true;
}
