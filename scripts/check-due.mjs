#!/usr/bin/env node
/**
 * לוח הפרסום — מה עלה, מה ממתין, ומה עומד לצאת.
 *
 * פוסט מתוזמן ע"י pubDate עתידי עם היסט מפורש, למשל:
 *     pubDate: '2026-09-06T18:00:00+03:00'
 * ההיסט שבמחרוזת הוא שקובע, ולכן שעון קיץ ישראלי נפתר ע"י התאריך עצמו
 * ולא ע"י ביטוי cron. תאריך "יבש" (YYYY-MM-DD) נקרא כחצות UTC — כלומר
 * כבר בשל — וכך כל הפוסטים הקיימים ממשיכים להתנהג בדיוק כמו קודם.
 *
 *   node scripts/check-due.mjs            דוח קריא
 *   node scripts/check-due.mjs --slots    השיבוצים הפנויים הבאים, מוכנים להדבקה
 *   node scripts/check-due.mjs --ci       יוצא 0 אם צריך לפרסם, 1 אם אין מה
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/content/posts';
const SITEMAP = 'https://hesketon.co.il/sitemap-0.xml';
const ci = process.argv.includes('--ci');
const wantSlots = process.argv.includes('--slots');

/** ראשון 18:00 · שלישי 14:00 · שישי 16:00, שעון ישראל. [יום בשבוע, שעה] */
const SLOTS = [[0, 18], [2, 14], [5, 16]];

/** ההיסט של ישראל (‎+02:00/‎+03:00) בתאריך נתון — כך שעון קיץ נגזר ולא מנוחש. */
function israelOffset(d) {
  const name = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Jerusalem', timeZoneName: 'longOffset',
  }).formatToParts(d).find((p) => p.type === 'timeZoneName').value;
  return name.replace('GMT', '') || '+00:00';
}

/** מחרוזת pubDate מוכנה להדבקה עבור השיבוץ ה-n-י מעכשיו. */
function slotStrings(count) {
  const out = [];
  const cur = new Date();
  for (let i = 0; i < 60 && out.length < count; i++) {
    const day = new Date(cur.getTime() + i * 864e5);
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(day);
    const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
    for (const [d, h] of SLOTS) {
      if (d !== dow) continue;
      const off = israelOffset(new Date(`${ymd}T12:00:00Z`));
      const iso = `${ymd}T${String(h).padStart(2, '0')}:00:00${off}`;
      if (new Date(iso).getTime() > Date.now()) out.push(iso);
    }
  }
  return out;
}
const now = Date.now();

const fmt = (d) =>
  new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short',
  }).format(d);

const posts = readdirSync(DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const raw = readFileSync(join(DIR, f), 'utf8');
    const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const rawDate = fm.match(/^pubDate:\s*['"]?([^'"\n]+)['"]?\s*$/m)?.[1]?.trim();
    return {
      slug: f.replace(/\.md$/, ''),
      title: (fm.match(/^title:\s*['"]?(.+?)['"]?\s*$/m)?.[1] ?? f).replace(/\\"/g, '"'),
      draft: /^draft:\s*true/m.test(fm),
      date: rawDate ? new Date(rawDate) : null,
      // תאריך יבש = חצות UTC, כלומר לא באמת מתוזמן לשעה
      timed: !!rawDate && /T/.test(rawDate),
    };
  })
  .filter((p) => !p.draft && p.date && !Number.isNaN(p.date.getTime()));

const scheduled = posts.filter((p) => p.date.getTime() > now).sort((a, b) => a.date - b.date);
const due = posts.filter((p) => p.date.getTime() <= now);

/* מי שכבר בשל אך עדיין לא באוויר — זה מה שמצדיק דיפלוי. */
let missing = [];
try {
  const res = await fetch(SITEMAP, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`sitemap ${res.status}`);
  const xml = await res.text();
  missing = due.filter((p) => !xml.includes(`/posts/${p.slug}/`));
} catch (err) {
  // אם ה-sitemap לא נגיש אין דרך לדעת מה חסר. בלי ידיעה לא מפרסמים —
  // הטיק הבא ינסה שוב, ופוסט מאחר עדיף על דיפלוי על סמך ניחוש.
  if (ci) {
    console.error(`⚠️  לא ניתן לקרוא את ה-sitemap (${err.message}) — מדלג על הטיק הזה.`);
    process.exit(1);
  }
  console.error(`⚠️  לא ניתן לקרוא את ה-sitemap: ${err.message}`);
}

if (wantSlots) {
  const taken = new Set(posts.map((p) => p.date.toISOString()));
  const free = slotStrings(12).filter((s) => !taken.has(new Date(s).toISOString()));
  console.log('\n  השיבוצים הפנויים הבאים (ראשון 18:00 · שלישי 14:00 · שישי 16:00):\n');
  for (const s of free.slice(0, 8)) console.log(`  pubDate: '${s}'   ${fmt(new Date(s))}`);
  console.log('');
  process.exit(0);
}

if (ci) {
  if (!missing.length) { console.log('אין מה לפרסם.'); process.exit(1); }
  console.log(`${missing.length} פוסטים בשלים שאינם באוויר:`);
  for (const p of missing) console.log(`  • ${p.slug}`);
  process.exit(0);
}

console.log('');
if (missing.length) {
  console.log(`  ⏳ בשלים אך לא באוויר (${missing.length}):`);
  for (const p of missing) console.log(`     • ${p.title}\n       ${p.slug} · ${fmt(p.date)}`);
  console.log('');
}
if (scheduled.length) {
  console.log(`  📅 מתוזמנים (${scheduled.length}):`);
  for (const p of scheduled) {
    const hrs = (p.date.getTime() - now) / 36e5;
    const when = hrs < 48 ? `בעוד ${hrs.toFixed(1)} שעות` : `בעוד ${(hrs / 24).toFixed(1)} ימים`;
    console.log(`     • ${fmt(p.date)}  (${when})${p.timed ? '' : '  ⚠️ בלי שעה'}`);
    console.log(`       ${p.title}`);
  }
} else {
  console.log('  📅 אין פוסטים מתוזמנים — התור ריק.');
}
console.log('');
console.log('─'.repeat(30));
console.log(`  ${due.length} באוויר · ${scheduled.length} בהמתנה`);
