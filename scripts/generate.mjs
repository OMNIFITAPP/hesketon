#!/usr/bin/env node
// ============================================================
//  הסכתון — post generator
//
//  Reads work from two places:
//    • inbox/*.md          — manual briefs (paste a transcript)
//    • content-queue.yml   — cloud queue (just a YouTube URL; Phase 2)
//
//  For each item: get a transcript → ask Claude for a Hebrew post →
//  write a DRAFT into src/content/posts/. You review, flip draft:false,
//  and commit to publish.
//
//  Usage:
//    npm run new-post          # real generation (needs ANTHROPIC_API_KEY)
//    npm run new-post:dry      # plumbing test, no API calls
// ============================================================

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { generatePost } from './lib/anthropic.mjs';
import { resolveTranscript } from './lib/transcript.mjs';
import { runQA, qaSection } from './lib/qa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INBOX = path.join(ROOT, 'inbox');
const PROCESSED = path.join(INBOX, '_processed');
const POSTS = path.join(ROOT, 'src', 'content', 'posts');
const QUEUE = path.join(ROOT, 'content-queue.yml');

const DRY = process.argv.includes('--dry-run');
const KEEP = process.argv.includes('--keep'); // leave inbox/queue untouched

const categories = JSON.parse(fs.readFileSync(path.join(ROOT, 'categories.json'), 'utf8'));
const categoryNames = categories.map((c) => c.name);

const log = {
  info: (m) => console.log(m),
  warn: (m) => console.warn('⚠️  ' + m),
};

main().catch((err) => {
  console.error('\n❌ ' + err.message + '\n');
  process.exit(1);
});

async function main() {
  console.log(`\n🎙️  הסכתון — מחולל הפוסטים${DRY ? '  ·  dry-run' : ''}\n`);

  if (!DRY && !process.env.ANTHROPIC_API_KEY) {
    console.error(
      '❌ חסר ANTHROPIC_API_KEY.\n   העתיקו את .env.example אל .env והכניסו מפתח,\n   או הריצו `npm run new-post:dry` כדי לבדוק את הצינור בלי קריאות API.\n',
    );
    process.exit(1);
  }

  fs.mkdirSync(POSTS, { recursive: true });
  fs.mkdirSync(PROCESSED, { recursive: true });

  const items = [...collectInboxItems(), ...collectQueueItems()];
  if (items.length === 0) {
    console.log(
      'אין מה לעבד.\n  • הוסיפו brief אל inbox/ (ראו inbox/README.md), או\n  • הוסיפו פרק אל content-queue.yml (Phase 2).\n',
    );
    return;
  }

  console.log(`נמצאו ${items.length} פריטים לעיבוד.\n`);
  let created = 0;
  const reportSections = [];

  for (const item of items) {
    try {
      console.log(`— ${item.label}`);
      const { transcript, source } = await resolveTranscript({
        pasted: item.transcript,
        youtubeUrl: item.meta.youtubeUrl,
        log,
      });
      console.log(`  ↳ תמלול: ${source} (${transcript.length.toLocaleString('en-US')} תווים)`);

      // Capture the episode's own publish date (shown on cards + post) if not given.
      if (!DRY && !item.meta.publishedAt && item.meta.youtubeUrl) {
        item.meta.publishedAt = await fetchUploadDate(item.meta.youtubeUrl);
        if (item.meta.publishedAt) console.log(`  ↳ תאריך הפרק: ${item.meta.publishedAt}`);
      }

      const { post, report } = DRY
        ? { post: stubPost(item, transcript), report: null }
        : await generatePost({ transcript, meta: item.meta, categories });

      // QA gate — mechanical checks, no API cost. Failures hold the post
      // back as draft:true so a merge can't accidentally publish it.
      const qa = DRY ? { failures: [], warnings: [] } : runQA({ post, categories, transcript });
      const held = qa.failures.length > 0;
      if (held) log.warn(`שער האיכות מצא ${qa.failures.length} כשלים — הפוסט נשמר כטיוטה (draft: true)`);

      const file = writePost(post, item, held);
      console.log(`  ↳ טיוטה: ${path.relative(ROOT, file)}\n`);

      reportSections.push(
        postReportSection({ post, report, qa, held, file: path.relative(ROOT, file) }),
      );

      if (!KEEP && !DRY) item.markDone();
      created++;
    } catch (err) {
      log.warn(`דילוג על "${item.label}": ${err.message}\n`);
    }
  }

  console.log(`✅ נוצרו ${created} טיוטות ב-src/content/posts/.`);
  console.log('   הריצו `npm run dev` לתצוגה מקדימה, ערכו לפי הצורך, ואז שנו `draft: false` כדי לפרסם.\n');

  writeRunReport(reportSections);
}

// ---------- run report (becomes the PR body via generate.yml) ----------

const REPORT_FILE = path.join(ROOT, '.generation-report.md');

function postReportSection({ post, report, qa, held, file }) {
  const lines = [`### ${post.title || file}`, ''];
  lines.push(`- קובץ: \`${file}\` · קטגוריה: ${post.category || '—'}`);
  if (report?.analyst) lines.push(`- 🧠 אנליסט: תיק פרק עם ${report.analyst.ideas} רעיונות מדורגים`);
  if (report?.quotes)
    lines.push(`- 💬 ציטוטים: ${report.quotes.checked} נבדקו, ${report.quotes.corrections} תוקנו`);
  if (report?.claims) {
    lines.push(`- 🔍 אימות עובדתי: ${report.claims.checked} טענות נבדקו, ${report.claims.corrections} תוקנו`);
    for (const f of report.claims.flagged || []) {
      lines.push(`  - 🚩 לבדיקה ידנית: "${f.he}" — ${f.flag}`);
    }
  }
  const passes = [report?.editor && 'עריכת לשון', report?.proof && 'הגהה'].filter(Boolean);
  if (passes.length) lines.push(`- ✍️ ${passes.join(' + ')} הוחלו`);
  lines.push('', '**שער איכות:**', qaSection(qa));
  if (held) lines.push('', '> ⚠️ נשמר עם `draft: true` בגלל כשלי איכות — תקנו ושנו ל-false לפני מיזוג.');
  lines.push('');
  return lines.join('\n');
}

function writeRunReport(sections) {
  const header = [
    'נוצרו טיוטות חדשות אוטומטית. סיכום הבקרה לכל פוסט למטה.',
    '',
    'לפרסום: עברו על כל טיוטה (ועל דגלי ה-🚩 אם יש), ערכו אם צריך, ומזגו. המיזוג ל-main מפעיל את ה-deploy.',
    '',
    '---',
    '',
  ].join('\n');
  const body = sections.length ? sections.join('\n---\n\n') : '_לא נוצרו טיוטות בריצה הזו._';
  fs.writeFileSync(REPORT_FILE, header + body + '\n', 'utf8');
  console.log(`📋 דו"ח ריצה: ${path.relative(ROOT, REPORT_FILE)}`);
}

// ---------- sources ----------

function collectInboxItems() {
  if (!fs.existsSync(INBOX)) return [];
  return fs
    .readdirSync(INBOX)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md')
    .map((f) => {
      const full = path.join(INBOX, f);
      const { data, content } = matter(fs.readFileSync(full, 'utf8'));
      return {
        label: data.episode || data.title || f,
        meta: pickMeta(data),
        transcript: content,
        markDone() {
          const stamp = new Date().toISOString().slice(0, 10);
          fs.renameSync(full, path.join(PROCESSED, `${stamp}-${f}`));
        },
      };
    });
}

function collectQueueItems() {
  if (!fs.existsSync(QUEUE)) return [];
  let doc;
  try {
    doc = yaml.load(fs.readFileSync(QUEUE, 'utf8')) || {};
  } catch (err) {
    log.warn(`could not parse content-queue.yml: ${err.message}`);
    return [];
  }
  const episodes = Array.isArray(doc.episodes) ? doc.episodes : [];
  return episodes
    .filter((ep) => ep && ep.youtubeUrl && ep.done !== true)
    .map((ep) => ({
      label: ep.episode || ep.youtubeUrl,
      meta: pickMeta(ep),
      transcript: '',
      markDone() {
        ep.done = true;
        fs.writeFileSync(QUEUE, yaml.dump(doc, { lineWidth: -1 }), 'utf8');
      },
    }));
}

function pickMeta(d = {}) {
  return {
    podcast: d.podcast,
    episode: d.episode,
    host: d.host,
    guest: d.guest,
    youtubeUrl: d.youtubeUrl,
    categoryHint: d.categoryHint,
    // Optional human curation: why this episode, what matters to the audience.
    // Steers the analyst's ranking and the writer's emphasis.
    curatorNotes: d.curatorNotes,
    publishedAt: d.publishedAt,
    durationMinutes: d.durationMinutes,
  };
}

// ---------- youtube metadata ----------

/** Best-effort: pull the episode's upload date (YYYY-MM-DD) from the watch page. */
async function fetchUploadDate(url) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const m = html.match(/"uploadDate":"(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

// ---------- writing ----------

function writePost(post, item, hold = false) {
  const slug = sanitizeSlug(post.slug, `post-${Date.now()}`);
  const file = uniquePath(POSTS, slug);

  const category = normalizeCategory(post.category, item.meta.categoryHint);
  const body = (post.bodyMarkdown || '').trim();
  const readingTime =
    Number(post.readingTimeMin) || Math.max(1, Math.round(body.split(/\s+/).length / 180));

  const source = clean({
    podcast: item.meta.podcast,
    episode: item.meta.episode,
    host: item.meta.host,
    guest: item.meta.guest,
    youtubeUrl: item.meta.youtubeUrl,
    publishedAt: item.meta.publishedAt,
    durationMinutes: item.meta.durationMinutes,
  });

  const frontmatter = clean({
    title: post.title,
    description: post.description,
    pubDate: new Date().toISOString().slice(0, 10),
    category,
    tags: Array.isArray(post.tags) ? post.tags : [],
    // Publish-ready: the Pull Request is the review gate (merge = publish) —
    // unless the QA gate found failures, in which case the post is held back
    // as a draft until a human fixes it and flips this to false.
    draft: hold,
    readingTime,
    source: Object.keys(source).length ? source : undefined,
  });

  const md = `---\n${yaml.dump(frontmatter, { lineWidth: -1 }).trim()}\n---\n\n${body}\n`;
  fs.writeFileSync(file, md, 'utf8');
  return file;
}

function normalizeCategory(value, hint) {
  if (value && categoryNames.includes(value)) return value;
  if (hint && categoryNames.includes(hint)) return hint;
  // Loose contains-match before giving up.
  const loose = categoryNames.find((n) => value && (n.includes(value) || value.includes(n)));
  if (loose) return loose;
  log.warn(`category "${value}" is not in the list — defaulting to "${categoryNames[0]}"`);
  return categoryNames[0];
}

function sanitizeSlug(input, fallback) {
  const slug = (input || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9֐-׿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
  return slug || fallback;
}

function uniquePath(dir, slug) {
  let name = slug;
  let i = 2;
  while (fs.existsSync(path.join(dir, `${name}.md`))) name = `${slug}-${i++}`;
  return path.join(dir, `${name}.md`);
}

/** Drop undefined / empty values so they don't litter the frontmatter. */
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = v;
  }
  return out;
}

// ---------- dry-run stub ----------

function stubPost(item, transcript) {
  const hint = item.meta.categoryHint;
  const category = hint && categoryNames.includes(hint) ? hint : categoryNames[0];
  return {
    title: item.meta.episode || 'טיוטת בדיקה (dry-run)',
    description:
      'זוהי טיוטה שנוצרה בריצת dry-run כדי לבדוק את הצינור, ללא קריאת API. החליפו אותה בתוכן אמיתי.',
    slug: '',
    category,
    tags: ['בדיקה', 'dry-run'],
    readingTimeMin: 2,
    bodyMarkdown: `## טיוטת בדיקה\n\nהצינור עובד: נקרא brief, חולץ תמלול (${transcript.length.toLocaleString(
      'en-US',
    )} תווים), ונכתבה טיוטה.\n\nכשתגדירו \`ANTHROPIC_API_KEY\` ותריצו \`npm run new-post\`, כאן יופיע פוסט אמיתי בעברית.\n\n## מה לוקחים מזה\n\n- ה-dry-run לא קורא ל-API ולא עולה כסף.\n- המקור והקרדיט נשמרים מתוך ה-brief.`,
  };
}
