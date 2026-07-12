// ============================================================
//  Analyst pass — deep reading BEFORE any writing happens.
//
//  Reads the FULL transcript and produces a structured "episode brief":
//  who the speakers are, the conversation's arc, the key ideas RANKED by
//  importance, an epistemic tag per idea (fact/claim/opinion/story/example/
//  advice), verbatim evidence snippets, a registry of every number said,
//  and candidate pull-quotes.
//
//  The writer then builds the post FROM this brief (not from a cold read),
//  and the claims verifier checks the draft AGAINST its evidence.
//
//  Toggle with ANALYST_PASS=false; pick a model with ANALYST_MODEL.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { parseModelJson, supportsTemperature } from './llm-utils.mjs';

const DEFAULT_ANALYST_MODEL = 'claude-sonnet-5';

/** The epistemic types the analyst must choose from (also used by QA). */
export const IDEA_TYPES = ['עובדה', 'טענה', 'מחקר מוזכר', 'דעה', 'סיפור', 'דוגמה', 'השערה', 'תחזית', 'עצה'];

function buildAnalystSystemPrompt() {
  return `אתה אנליסט תוכן של הבלוג "הסכתון". תפקידך לקרוא תמלול מלא של פרק פודקאסט ולהחזיר "תיק פרק" מובנה — ניתוח עומק שממנו ייכתב אחר כך הפוסט. אתה לא כותב את הפוסט; אתה מבין את השיחה לעומק ומארגן אותה.

עקרונות:
1. קרא את השיחה כולה לפני שאתה מסכם. זהה את הקשת של השיחה — לאן היא מתפתחת, מה הרעיון המארגן.
2. תזה: אחרי הקריאה נסח בשדה "thesis" משפט אחד — מה הכתבה שתיכתב מהפרק הזה צריכה להוכיח או להסביר. לא נושא ("הפרק עוסק באילוף כלבים") אלא טענה עריכתית ("הכלב מגיב למצב הפנימי של האדם לפני שהוא מגיב לפקודות — ולכן האילוף מתחיל בבעלים"). זו ההחלטה החשובה ביותר בתיק.
3. דרג רעיונות לפי חשיבות אמיתית ביחס לתזה (מה נושא את השיחה, מה חדשני, מה שימושי לקורא) — לא לפי סדר הופעה ולא לפי כמה זמן דיברו על זה. רעיון שאינו משרת את התזה מקבל importance נמוך גם אם הוא מעניין.
4. הפרד בקפדנות בין מעמדי אמירות — זה ציר נפרד מהשאלה מי אמר. לכל רעיון קבע type אחד:
   - "עובדה" — עובדה בסיסית שאינה שנויה במחלוקת וניתנת לאימות ישיר (תפקידו של האורח, אירוע מתועד). שמור את הסיווג הזה למקרים מובהקים בלבד.
   - "טענה" — עמדה או מודל שהדובר טוען ומנמק. רוב מה שנשמע "עובדתי" בפודקאסט שייך לכאן.
   - "מחקר מוזכר" — מחקר או נתון שהדובר מצטט ולא אומת על ידינו: איננו יודעים אם תיאר אותו נכון או אם הוא תומך במסקנתו.
   - "דעה" — העדפה/תחושה אישית מוצהרת.
   - "סיפור" — אנקדוטה או חוויה אישית שסופרה. התנסות אישית אינה "ניסוי" ואינה "ממצא".
   - "דוגמה" — המחשה קונקרטית לרעיון אחר.
   - "השערה" — הסבר אפשרי שהדובר מעלה בזהירות ("ייתכן ש...").
   - "תחזית" — הערכה לגבי העתיד.
   - "עצה" — המלצת פעולה שהדובר נתן במפורש.
5. ייחוס מדויק: לכל רעיון ציין מי אמר (המנחה או האורח, בשמם). אל תערבב.
6. ראיות ורבטים: לכל רעיון צרף 1-2 ציטוטים קצרים ומדויקים מהתמלול באנגלית (העתקה מילולית, בלי לתקן), שמבססים את הרעיון. אלה ישמשו לאימות אוטומטי — דיוק קריטי. כשרעיון מגדיר יחסים או מונחים (מי נקרא איך, מי גדול ממי, מה קודם למה) — בחר ראיה שמכילה את היחס במפורש.
7. רשום כל מספר משמעותי שנאמר (אחוזים, מחקרים, שנים, כמויות) בשדה numbers של הרעיון הרלוונטי, בדיוק כפי שנאמר ובמשמעות שנאמרה.
8. התמלול עלול להיות אוטומטי ומרושל — שמות ומונחים משובשים. בשדות שלך כתוב את הצורה הנכונה, אבל בשדות evidence העתק ורבטים כפי שמופיע.

פלט: JSON תקין בלבד, בלי טקסט לפניו או אחריו, במבנה:
{
  "speakers": { "host": "שם", "guest": "שם", "notes": "הערות ייחוס אם יש בלבול אפשרי" },
  "thesis": "משפט אחד: מה הכתבה מהפרק הזה מוכיחה או מסבירה",
  "overview": "2-3 משפטים בעברית: על מה השיחה באמת ומה הקשת שלה",
  "keyIdeas": [
    {
      "id": "I1",
      "idea": "ניסוח הרעיון בעברית, משפט או שניים",
      "type": "עובדה|טענה|מחקר מוזכר|דעה|סיפור|דוגמה|השערה|תחזית|עצה",
      "speaker": "מי אמר",
      "importance": 5,
      "evidence": ["verbatim English snippet from the transcript"],
      "numbers": ["3.4x", "20-30%"]
    }
  ],
  "candidateQuotes": [
    { "en": "verbatim English quote", "speaker": "מי אמר", "why": "למה הוא חזק כציטוט פותח/גוף" }
  ],
  "context": "רקע שהכותב צריך לתת לקורא הישראלי (מי האורח, מה הפודקאסט, מונחים)"
}

- keyIdeas: בין 10 ל-18 רעיונות, ממוינים מהחשוב לפחות חשוב (importance מ-5 ל-1).
- candidateQuotes: 4-6 מובאות.
- id ייחודי לכל רעיון (I1, I2, ...).`;
}

/**
 * @param {{ transcript: string, meta: Record<string, any>, model?: string }} args
 * @returns {Promise<object|null>} the episode brief, or null when the pass is disabled.
 */
export async function analyzeTranscript({ transcript, meta, model }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const chosenModel =
    model || process.env.ANALYST_MODEL || process.env.CLAUDE_MODEL || DEFAULT_ANALYST_MODEL;

  const lines = ['פרטי הפרק:'];
  if (meta.podcast) lines.push(`- פודקאסט: ${meta.podcast}`);
  if (meta.episode) lines.push(`- כותרת הפרק: ${meta.episode}`);
  if (meta.host) lines.push(`- מנחה: ${meta.host}`);
  if (meta.guest) lines.push(`- אורח/ת: ${meta.guest}`);
  if (meta.curatorNotes) lines.push(`- הערות העורך (למה נבחר הפרק): ${meta.curatorNotes}`);
  lines.push('', 'להלן התמלול המלא. נתח אותו והחזר תיק פרק (JSON בלבד):', '', '=== תמלול ===', transcript);

  const params = {
    model: chosenModel,
    max_tokens: 12000,
    system: buildAnalystSystemPrompt(),
    messages: [{ role: 'user', content: lines.join('\n') }],
  };
  if (supportsTemperature(chosenModel)) params.temperature = 0.3;

  const message = await client.messages.create(params);
  const out = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const brief = parseModelJson(out);

  if (!Array.isArray(brief.keyIdeas) || brief.keyIdeas.length === 0) {
    throw new Error('the analyst returned a brief without keyIdeas');
  }
  // Normalize: make sure every idea has an id (the claims pass keys on it).
  brief.keyIdeas.forEach((k, i) => {
    if (!k.id) k.id = `I${i + 1}`;
  });
  return brief;
}

/** Compact, writer-facing rendering of the brief (keeps the prompt lean). */
export function briefForWriter(brief) {
  return JSON.stringify(
    {
      speakers: brief.speakers,
      thesis: brief.thesis,
      overview: brief.overview,
      keyIdeas: brief.keyIdeas,
      candidateQuotes: brief.candidateQuotes,
      context: brief.context,
    },
    null,
    1,
  );
}

/** Map ideaId → idea, for the claims verifier. */
export function ideaIndex(brief) {
  const map = new Map();
  for (const k of brief?.keyIdeas || []) map.set(k.id, k);
  return map;
}
