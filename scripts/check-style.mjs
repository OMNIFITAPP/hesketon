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
//
//  אזהרה בלבד (exit 0) — צפיפות מקפים ארוכים.
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
  ['תרגומית', null], // מונח פנימי — לא אמור להופיע בפוסט
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

const failures = []; // מפילים את השער
const warnings = []; // מדווחים בלבד

for (const file of readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))) {
  const { fm, body } = splitPost(readFileSync(join(POSTS_DIR, file), 'utf8'));
  if (/^draft:\s*true/m.test(fm)) continue; // טיוטות פטורות
  if (/<!--\s*style-keep:/.test(body)) continue;

  // בלי בלוק אימות הציטוטים ובלי HTML — רק פרוזה שהקורא רואה.
  const prose = body.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '');

  // ── 1: צפיפות מקפים
  const paragraphs = prose.split(/\n\s*\n/).filter((p) => p.trim().length > 80);
  const dashes = (prose.match(/—/g) || []).length;
  if (paragraphs.length >= 5) {
    const ratio = dashes / paragraphs.length;
    if (ratio > DASH_PER_PARAGRAPH) {
      warnings.push({ file, ratio, dashes, paragraphs: paragraphs.length });
    }
  }

  // ── 2: סחף מינוח
  for (const g of TERM_GROUPS) {
    const used = g.words.filter((w) => new RegExp(`(^|[^א-ת])${w}([^א-ת]|$)`).test(prose));
    if (used.length > 1) {
      failures.push(`${file} — סחף מינוח (${g.name}): ${used.join(' / ')}. בחר אחת.`);
    }
  }

  // ── 3: מונחים שנפסלו
  for (const [term, replacement] of REJECTED_TERMS) {
    if (new RegExp(`(^|[^א-ת])${term}([^א-ת]|$)`).test(prose)) {
      failures.push(
        `${file} — "${term}" נפסל במבחן המפגש` + (replacement ? ` → ${replacement}` : '') + '.',
      );
    }
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

if (failures.length === 0) {
  console.log('✅ שער הסגנון עבר: אחידות מינוח ומונחים שנפסלו במבחן המפגש.');
  console.log('   ⚠️  מכני בלבד. תרגומית נתפסת רק באוזן — קרא את הליד ואת האמ;לק בקול.');
  process.exit(0);
}

console.log(`⚠️  ${failures.length} כשלי סגנון:\n`);
for (const f of failures) console.log(`   • ${f}`);
console.log('\nחריג מוצהר: <!-- style-keep: <נימוק> -->');
process.exit(1);
