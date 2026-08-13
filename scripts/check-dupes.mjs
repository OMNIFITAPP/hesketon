#!/usr/bin/env node
/**
 * שער כפילויות — ורק כפילויות.
 *
 * הנחת היסוד: אורח שחוזר לפודקאסט, או נושא שחוזר אצל מנחה אחר, אינו בעיה.
 * כל שיחה מוציאה מהאורח צדדים אחרים. מה שכן בעיה הוא אם *הפוסט* חוזר על
 * עצמו — כלומר אם אותו ציטוט מקור בדיוק שימש בשני פוסטים.
 *
 * לכן השער בודק דבר אחד מכני: ציטוטי המקור באנגלית שבעקבות המקורות
 * (השורות שמתחילות ב-⇐) לא חוזרים בין פוסטים.
 *
 * הרצה בלי ארגומנט = בדיקת כל הקורפוס.
 * הרצה עם שם אדם = דוח "מה כבר כוסה עליו", לפני כתיבת פוסט חדש.
 *     node scripts/check-dupes.mjs "אנדרו הוברמן"
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/content/posts';
const norm = (s) =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const posts = readdirSync(DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => {
    const raw = readFileSync(join(DIR, f), 'utf8');
    const fm = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const pick = (k) => fm.match(new RegExp(`^  ${k}: "?([^"\\n]+)"?$`, 'm'))?.[1]?.trim();
    return {
      slug: f.replace(/\.md$/, ''),
      draft: /^draft: true/m.test(fm),
      title: (fm.match(/^title: ['"]?(.+?)['"]?$/m)?.[1] ?? f).replace(/\\"/g, '"'),
      guest: pick('guest'),
      host: pick('host'),
      guestId: pick('guestId'),
      hostId: pick('hostId'),
      heads: [...raw.matchAll(/^## (.+)$/gm)].map((m) => m[1]),
      // ציטוטי המקור, כפי שנרשמו בעקבות המקורות
      sources: [...raw.matchAll(/⇐\s*"?(.{30,})/g)].map((m) => norm(m[1]).slice(0, 70)),
    };
  })
  .filter((p) => !p.draft);

const who = process.argv[2];

/* ── מצב א׳: דוח על אדם, לפני כתיבה ────────────────────────── */
if (who) {
  // התאמה רופפת בכוונה: איות קרוב ("רביקנט" מול "רביקאנט"), שם פרטי בלבד,
  // או המזהה באנגלית — כולם צריכים למצוא. תשובת "שדה פתוח" שגויה היא בדיוק
  // התקלה שהשער הזה אמור למנוע.
  const loose = (s) =>
    (s ?? '').toLowerCase().replace(/["'\\]/g, '').replace(/[אהוי]/g, '').replace(/\s+/g, ' ').trim();
  const q = loose(who);
  // שם אמצע ("מייקל ג'יי. סיילור" מול "מייקל סיילור") שבר את ההתאמה פעם אחת
  // והחמיץ פוסט קיים. לכן גם התאמה לפי מילים: אם כל מילות השאילתה מופיעות
  // בשם, או שמילה ייחודית (שם משפחה) חופפת — זו התאמה.
  const words = (s) => loose(s).split(' ').filter((w) => w.length >= 3);
  const qw = words(who);
  const hit = (p) =>
    [p.guest, p.host, p.guestId, p.hostId].filter(Boolean).some((v) => {
      const l = loose(v);
      if (l === q || l.includes(q) || q.includes(l)) return true;
      const vw = words(v);
      if (!qw.length || !vw.length) return false;
      const shared = qw.filter((w) => vw.some((x) => x === w || x.startsWith(w) || w.startsWith(x)));
      return shared.length === qw.length || shared.length >= 2;
    });

  const mine = posts.filter(hit);
  if (!mine.length) {
    console.log(`\n  אין עדיין פוסטים עם "${who}" — שדה פתוח.`);
    const names = [...new Set(posts.flatMap((p) => [p.guest, p.host].filter(Boolean)))];
    // רק התאמה משמעותית: מילה שלמה שחולקת 3 תווים ראשונים
    const words = (s) => loose(s).split(' ').filter((w) => w.length >= 3);
    const qw = words(who);
    const near = names.filter((n) => words(n).some((w) => qw.some((x) => w.slice(0, 3) === x.slice(0, 3))));
    if (near.length) console.log(`  (אולי התכוונת: ${near.slice(0, 4).join(' · ')})`);
    console.log('');
    process.exit(0);
  }
  console.log(`\n  ${who} — ${mine.length} פוסטים כבר באתר:\n`);
  for (const p of mine) {
    console.log(`  • ${p.title}`);
    console.log(`    ${p.heads.map((h) => h.replace(/^"|"$/g, '')).join(' · ')}\n`);
  }
  console.log('  ↑ אלה הזוויות שכבר נלקחו. כוון למשהו אחר, או לאותו נושא מזווית חדשה.\n');
  process.exit(0);
}

/* ── מצב ב׳: שער — ציטוט מקור שחוזר בשני פוסטים ─────────────── */
const seen = new Map();
const dupes = [];
for (const p of posts) {
  for (const s of new Set(p.sources)) {
    if (seen.has(s)) dupes.push({ s, a: seen.get(s), b: p.slug });
    else seen.set(s, p.slug);
  }
}

console.log('');
if (dupes.length) {
  for (const d of dupes) {
    console.log(`  ⚠️  ציטוט מקור חוזר:\n      ${d.a}\n      ${d.b}\n      "${d.s}…"\n`);
  }
  console.log('─'.repeat(30));
  console.log(`  ❌ ${dupes.length} ציטוטי מקור משמשים ביותר מפוסט אחד.`);
  process.exit(1);
}

const repeats = new Map();
for (const p of posts) for (const n of [p.guest, p.host].filter(Boolean))
  repeats.set(n, (repeats.get(n) ?? 0) + 1);
const many = [...repeats.entries()].filter(([, n]) => n > 1).length;

console.log('─'.repeat(30));
console.log(`  ✓ ${posts.length} פוסטים, ${seen.size} ציטוטי מקור — אף אחד לא חוזר.`);
console.log(`    (${many} אנשים מופיעים ביותר מפוסט אחד. זה תקין.)`);
