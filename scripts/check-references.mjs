#!/usr/bin/env node
// ────────────────────────────────────────────────────────────────
//  check-references — שער ההפניות. שתי שכבות אכיפה:
//
//  שכבה 1 — מבנה (אופליין, רצה תמיד):
//    א. פוסט שמזכיר מחקר חייב לשאת בלוק `references:`.
//    ב. **לכל רשומת reference חייב להיות `url`.** אזכור מחקר מחייב לינק.
//    ג. ה-url חייב להיות https תקין.
//
//  שכבה 2 — זהות (רשת, רק עם --verify):
//    ד. ה-url חייב להצביע על העבודה שהרשומה מתארת — לא סתם על עמוד חי.
//       ל-DOI אנחנו מבקשים מ-doi.org מטא-דאטה (CSL-JSON) ומשווים את כתב
//       העת והשנה שרשמנו מול מה שרשם הרשם. זה מה שתופס לינק "עובד" שמצביע
//       על המאמר הלא נכון — הכשל שהתגלה ביולי 2026, כשהפניה למחקר קריאטין
//       באלצהיימר יוחסה לכתב העת שבו פורסם הפרוטוקול ולא מאמר התוצאות.
//       url שאינו DOI נבדק לזמינות בלבד: אי אפשר לאמת סמנטית עמוד שרירותי.
//
//  פטור מוצהר משכבה 1א (ורק ממנה): <!-- refs-keep: <נימוק> -->
//  נועד לתפיסות-שווא של הביטוי "מחקר של X" כשמדובר בעבודת תחקיר ולא במחקר.
//
//  הרצה:  npm run check:refs           (מבנה בלבד, חינם ומהיר)
//         npm run check:refs:verify    (מבנה + אימות זהות מול doi.org)
// ────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const POSTS_DIR = 'src/content/posts';
const VERIFY = process.argv.includes('--verify');

// ביטויים שמסמנים ציטוט של מחקר *ספציפי* (לא פרוזה כללית).
const STUDY_PATTERNS = [
  /מחקר\s+ש/, // תופס גם "מחקר של X" — לכן קיים refs-keep
  /לפי\s+מחקר/,
  /על\s+פי\s+מחקר/,
  /סקירה\s+שפורסמה/,
  /מטא[-\s]?אנליזה/,
  /ניסוי\s+קליני/,
  /ניסוי\s+מבוקר/,
  /פורסם\s+ב-?\s?\d{4}/,
  /מחקר\s+מ-?\s?\d{4}/,
  /ניתחה?\s+\d+\s+מחקרים/,
  /מחקר\s+ארוך\s+טווח/,
];

function splitPost(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : { fm: '', body: raw };
}

/**
 * משווים "Scientific Reports" מול "Scientific Reports 14:4937" — כרך/עמודים אינם חלק מהשם.
 * doi.org מחזיר לעיתים ישויות HTML ("&amp;"), ולכן מפענחים אותן *לפני* נרמול ה-&.
 */
function normalizeJournal(s) {
  return String(s ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&(?:quot|apos|#39|lt|gt|nbsp);/gi, ' ')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function fetchDoiMetadata(doi) {
  const res = await fetch(`https://doi.org/${doi}`, {
    headers: { Accept: 'application/vnd.citationstyles.csl+json' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`doi.org החזיר ${res.status}`);
  return res.json();
}

async function checkReachable(url) {
  let res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  // לא כל שרת עונה ל-HEAD; ננסה GET לפני שנכריז על כישלון.
  if (res.status === 405 || res.status === 501 || res.status === 403) {
    res = await fetch(url, { method: 'GET', redirect: 'follow' });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

const errors = [];
const links = [];

for (const file of readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))) {
  const { fm, body } = splitPost(readFileSync(join(POSTS_DIR, file), 'utf8'));
  if (/^draft:\s*true/m.test(fm)) continue; // טיוטות פטורות

  let data = {};
  try {
    data = yaml.load(fm) ?? {};
  } catch (e) {
    errors.push({ file, msg: `${file} — frontmatter לא תקין: ${e.message}` });
    continue;
  }

  const prose = body.replace(/<!--[\s\S]*?-->/g, ''); // בלי בלוק אימות הציטוטים
  const refs = Array.isArray(data.references) ? data.references : [];
  const exempt = /<!--\s*refs-keep:/.test(body);

  // ── 1א: מזכיר מחקר ⇒ חייב references
  const mention = STUDY_PATTERNS.find((re) => re.test(prose));
  if (mention && refs.length === 0 && !exempt) {
    const hint = (prose.match(mention) || [''])[0].trim();
    errors.push({
      file,
      msg: `${file} — מזכיר מחקר ("${hint}") אך אין בלוק references. הוסף מקור מאומת, או הצהר פטור: <!-- refs-keep: <נימוק> -->`,
    });
  }

  // ── 1ב+1ג: לכל רשומה url תקין
  refs.forEach((r, i) => {
    const at = `${file} [ref-${i + 1}] "${String(r.title ?? '').slice(0, 45)}"`;
    if (!r.url) {
      errors.push({ file, msg: `${at} — חסר url. אזכור מחקר מחייב לינק.` });
      return;
    }
    let u;
    try {
      u = new URL(r.url);
    } catch {
      errors.push({ file, msg: `${at} — url לא תקין: ${r.url}` });
      return;
    }
    if (u.protocol !== 'https:') {
      errors.push({ file, msg: `${at} — url חייב להיות https: ${r.url}` });
      return;
    }
    links.push({ file, i: i + 1, ref: r, url: u });
  });
}

// ── שכבה 2: אימות זהות (רשת)
if (VERIFY && links.length) {
  console.log(`🔎 מאמת ${links.length} לינקים מול המקור...`);
  for (const { file, i, ref, url } of links) {
    const at = `${file} [ref-${i}]`;
    const doiMatch = url.href.match(/^https:\/\/doi\.org\/(10\..+)$/i);
    try {
      if (doiMatch) {
        const meta = await fetchDoiMetadata(decodeURIComponent(doiMatch[1]));

        const gotYear = meta.issued?.['date-parts']?.[0]?.[0];
        if (ref.year && gotYear && Math.abs(Number(ref.year) - Number(gotYear)) > 1) {
          errors.push({
            file,
            msg: `${at} — שנה לא תואמת: ברשומה ${ref.year}, ב-DOI ${gotYear}`,
          });
        }

        const container = [].concat(meta['container-title'] ?? []).filter(Boolean)[0];
        if (container && ref.source) {
          const a = normalizeJournal(container);
          const b = normalizeJournal(ref.source);
          if (a && !b.includes(a) && !a.includes(b)) {
            errors.push({
              file,
              msg: `${at} — כתב העת לא תואם: ברשומה "${ref.source}", ב-DOI "${container}"`,
            });
          }
        }
      } else {
        await checkReachable(url.href);
      }
      process.stdout.write('.');
    } catch (e) {
      errors.push({ file, msg: `${at} — הלינק נכשל באימות (${e.message}): ${url.href}` });
      process.stdout.write('x');
    }
  }
  console.log('\n');
}

if (errors.length === 0) {
  console.log(
    `✅ שער ההפניות עבר (${VERIFY ? 'מבנה + זהות' : 'מבנה'}): ${links.length} רשומות, לכולן url.`,
  );
  if (!VERIFY) {
    console.log('   לאימות שהלינקים מצביעים על המאמר הנכון: npm run check:refs:verify');
  }
  process.exit(0);
}

console.log(`⚠️  ${errors.length} כשלים בשער ההפניות:\n`);
for (const e of errors) console.log(`   • ${e.msg}`);
console.log('\nלעולם אל תמציא מקור. אם אין לינק מאומת — אין הפניה.');
process.exit(1);
