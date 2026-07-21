#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────
//  check-style — השער המכני לזרימה. תופס את מה שניתן לספור בלבד.
//
//  נולד מסקירת יולי 2026 על פרק יאמפולסקי: הפוסט עבר את כל חמשת השערים
//  בירוק והיה עדיין פגום, כי אף שער לא בדק *איך זה נקרא*. רוב כשלי
//  התרגומית דורשים אוזן ילידית ואינם ניתנים לאוטומציה — אבל שלושה דפוסים
//  כן ניתנים לספירה, וזה מה שהשער הזה עושה. הוא אינו מחליף קריאה אנושית.
//
//  כשל (exit 1) — מדויק ונדיר:
//  1. מונחים שנפלו במבחן המפגש — רשימה מפורשת של מילים שכבר נדחו בסקירה.
//     לא רשימה גורפת של לועזית: רק מה שכבר נבדק ונפסל.
//  2. סחף מינוח — אותו מושג בכמה מילים באותו פוסט ("הסכת"/"פודקאסט"),
//     או כתיב לא אחיד ("מיד"/"מייד").
//  3. צורות שאינן קיימות בעברית (חוק 21). דיוק 100%, אפס התרעות שווא.
//
//  אזהרה בלבד (exit 0) — אפוזיציית מספרים (חוק 3א), וצפיפות מקפים ארוכים.
//  נמדד ביולי 2026: **48 מתוך 48 הפוסטים המפורסמים חורגים מהסף**, חציון 1.67
//  לפסקה. כלומר זו הרגל-בית רוחבי ולא פגם נקודתי, ושער חוסם היה חוסם הכול.
//  לכן זה מדווח ולא מפיל, עד שתתקבל החלטה על סבב ניקוי לארכיון.
//  לשם השוואה: יאמפולסקי אחרי העריכה = 0.62, הנמוך בארכיון.
//
//  חריג מוצהר: <!-- style-keep: <נימוק> -->
//
//  הרצה:  npm run check:style
// ────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const POSTS_DIR = 'src/content/posts';
const DASH_PER_PARAGRAPH = 0.7;

/** מונחים שנפסלו במבחן המפגש (SYSTEM_PROMPT חוק 12א). ערך = ההחלפה. */
const REJECTED_TERMS = [
  ['מעריכית', 'מכפילה את עצמה / אקספוננציאלית'],
  ['חוד החנית', 'חזית הטכנולוגיה'],
  ['מסגור', 'הטיעון / הזווית'],
  ['ממסגר', 'מגדיר / מתאר'],   // נטייה שחמקה מהכלל שמבוסס שם-עצם
  ['תרגומית', null], // מונח פנימי — לא אמור להופיע בפוסט
];

/**
 * צורות שאינן קיימות בעברית — מנויות ב-SYSTEM_PROMPT (חוק 21 ומיפוי 8/11).
 * רק צורות ששגויות *תמיד*, בלי תלות בהקשר, כדי שלא ייווצרו התרעות שווא.
 * "לאכפת" עברה לאוויר בפוסט מיסטר ביסט למרות שהיא אסורה בשמה — ומכאן השער הזה.
 */
const FORBIDDEN_FORMS = [
  ['לאכפת', 'להיות אכפת / לדאוג ל־'],
  ['הצתו', 'הציתו'],
  ['ואאת', 'רעש תמליל'],
];

/**
 * אפוזיציית מספרים (חוק 3א): שתי כמויות משני צדי מקף באותו משפט, בלי מילה
 * שמצהירה על היחס ביניהן. המקף אינו מתחייב ליחס, והקורא קורא "זה שווה לזה".
 */
const RELATION_WORDS = [
  'כלומר', 'מתוכן', 'מתוכם', 'מהן', 'מהם', 'לעומת', 'בהשוואה', 'לעומתם',
  'שהם', 'שהן', 'כלומר', 'ומכאן', 'מכאן', 'בעוד', 'לעומת זאת', 'כי', 'מפני',
  'בממוצע', 'בסך הכול', 'כשליש', 'כמחצית', 'פי ',
];

/** קבוצות שבהן צריך לבחור מילה אחת ולדבוק בה לאורך הפוסט. */
const TERM_GROUPS = [
  { name: 'שם המדיום', words: ['הסכת', 'פודקאסט'] },
  { name: 'כתיב', words: ['מייד', 'מיד'] },
  { name: 'גוף ראשון רבים', words: ['איננו', 'אנחנו לא'] },
];

function splitPost(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : { fm: '', body: raw };
}

const failures = [];    // מפילים את השער
const appositions = []; // אזהרה: אפוזיציית מספרים (חוק 3א)
const warnings = []; // מדווחים בלבד

for (const file of readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))) {
  const { fm, body } = splitPost(readFileSync(join(POSTS_DIR, file), 'utf8'));
  // טיוטות **אינן** פטורות. השערים האחרים מדלגות עליהן, וזה בדיוק הפוך מהנדרש:
  // טיוטה היא הרגע היחיד שבו תיקון עוד זול. שלוש הטיוטות של יולי 2026 מעולם
  // לא נבדקו בשער עד שהורצו ידנית עם דגל זמני, ונמצאו בהן 17 ממצאים.
  const isDraft = /^draft:\s*true/m.test(fm);
  const tag = isDraft ? '[טיוטה] ' : '';
  if (/<!--\s*style-keep:/.test(body)) continue;

  // בלי בלוק אימות הציטוטים ובלי HTML — רק פרוזה שהקורא רואה.
  const prose = body.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '');

  // ── 1: צפיפות מקפים
  const paragraphs = prose.split(/\n\s*\n/).filter((p) => p.trim().length > 80);
  const dashes = (prose.match(/—/g) || []).length;
  if (paragraphs.length >= 5) {
    const ratio = dashes / paragraphs.length;
    if (ratio > DASH_PER_PARAGRAPH) {
      warnings.push({ file: tag + file, ratio, dashes, paragraphs: paragraphs.length });
    }
  }

  // ── 2: סחף מינוח
  for (const g of TERM_GROUPS) {
    const used = g.words.filter((w) => new RegExp(`(^|[^א-ת])${w}([^א-ת]|$)`).test(prose));
    if (used.length > 1) {
      failures.push(`${tag}${file} — סחף מינוח (${g.name}): ${used.join(' / ')}. בחר אחת.`);
    }
  }

  // ── 3: מונחים שנפסלו
  for (const [term, replacement] of REJECTED_TERMS) {
    if (new RegExp(`(^|[^א-ת])${term}([^א-ת]|$)`).test(prose)) {
      failures.push(
        `${tag}${file} — "${term}" נפסל במבחן המפגש` + (replacement ? ` → ${replacement}` : '') + '.',
      );
    }
  }

  // ── 4: צורות שאינן קיימות
  for (const [form, fix] of FORBIDDEN_FORMS) {
    if (new RegExp(`(^|[^א-ת])${form}([^א-ת]|$)`).test(prose)) {
      failures.push(`${tag}${file} — הצורה "${form}" אינה קיימת בעברית → ${fix}. (SYSTEM_PROMPT חוק 21)`);
    }
  }

  // ── 5: אפוזיציית מספרים (חוק 3א)
  //
  // מכוון *צר בכוונה*. הגרסה הרחבה (כל שני מספרים משני צדי מקף) נתנה 27
  // ממצאים שרובם תקינים — "ירד לכ-50 — ירידה של 90%" מצהיר על היחס, "בפחות
  // מ-20 שנה — אולי 10 עד 15" הוא חידוד. שער עם 90% התרעות שווא מאמן להתעלם.
  // לכן התנאי: הקטע *שאחרי* המקף **נפתח** בכמות — זו האפוזיציה האמיתית,
  // הדפוס של "850 מיליון בני אדם — 12 מיליארד צפיות".
  for (const sentence of prose.split(/(?<=[.!?])\s+|\n/)) {
    if (!sentence.includes('—')) continue;
    const [before, ...restParts] = sentence.split('—');
    const after = restParts.join('—').trim();
    if (!/\d/.test(before)) continue;
    if (!/^(כ-?|כמעט\s|יותר\s+מ-?|פחות\s+מ-?)?[\d]/.test(after)) continue;
    if (RELATION_WORDS.some((w) => after.includes(w))) continue;
    // אזהרה ולא כשל: כשהאפוזיציה *באמת* שקילות ("100 מיליון שנה — 5% מציר
    // הזמן") השימוש תקין, וזה כשליש עד מחצית מהממצאים. ההבחנה בין שקילות
    // אמיתית לשני מדדים שונים היא סמנטית ואינה ניתנת לזיהוי מכני אמין.
    appositions.push(`${tag}${file} — "…${sentence.trim().slice(0, 85)}…"`);
  }
}

// ── דיווח צפיפות מקפים (אינו מפיל)
if (warnings.length) {
  warnings.sort((a, b) => b.ratio - a.ratio);
  const median = warnings[Math.floor(warnings.length / 2)].ratio;
  console.log(
    `ℹ️  צפיפות מקפים ארוכים מעל ${DASH_PER_PARAGRAPH} ב-${warnings.length} פוסטים ` +
      `(חציון ${median.toFixed(2)}). הרגל-בית רוחבי — מדווח, לא מפיל.`,
  );
  console.log('   חמשת הגבוהים:');
  for (const w of warnings.slice(0, 5)) {
    console.log(`     ${w.ratio.toFixed(2)}  ${w.file}  (${w.dashes}/${w.paragraphs})`);
  }
  console.log('');
}

if (appositions.length) {
  console.log(
    `ℹ️  ${appositions.length} אפוזיציות מספרים לבדיקה בעין (חוק 3א) — ` +
      `הקטע שאחרי המקף נפתח בכמות. אם זו שקילות אמיתית, תקין:`,
  );
  for (const a of appositions) console.log(`     ${a}`);
  console.log('');
}

if (failures.length === 0) {
  console.log('✅ שער הסגנון עבר: מונחים שנפסלו, צורות שאינן קיימות, אחידות מינוח.');
  console.log('   ⚠️  מכני בלבד. תרגומית נתפסת רק באוזן — קרא את הליד ואת האמ;לק בקול.');
  process.exit(0);
}

console.log(`⚠️  ${failures.length} כשלי סגנון:\n`);
for (const f of failures) console.log(`   • ${f}`);
console.log('\nחריג מוצהר: <!-- style-keep: <נימוק> -->');
process.exit(1);
