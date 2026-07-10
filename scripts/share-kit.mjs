#!/usr/bin/env node
// ============================================================
//  הסכתון — share-kit: ערכת שיתוף לסטורי, לכל פוסט.
//
//  קוראים ביקשו לשתף תקציר בסטורי? הפקודה מפיקה עבור פוסט:
//    share-kit/<slug>/
//      ├─ <slug>-01-story-share.png   סטורי 1080×1920 ממותג:
//      │                              ציטוט־פותח + QR לפוסט + URL
//      └─ caption.txt                 הודעה מוכנה לוואטסאפ + טיפ סטיקר קישור
//
//  שולחים לחבר את ה-PNG (וואטסאפ/AirDrop) — הוא מעלה לסטורי,
//  ומוסיף סטיקר קישור עם הכתובת מה-caption. זהו.
//
//  Usage:
//    npm run share <slug>        # התאמה חלקית על ה-slug מספיקה
//    npm run share cesar nischa  # כמה פוסטים בבת אחת
//    npm run share -- --all      # לכל הפוסטים המפורסמים
//    npm run share               # מציג את רשימת ה-slugs
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

import { loadPublishedPosts } from './lib/social/parse-post.mjs';
import { buildShareStory } from './lib/social/templates.mjs';
import { renderSlides } from './lib/social/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'src/content/posts');
const OUT_ROOT = path.join(ROOT, 'share-kit');
const BASE = (process.env.SOCIAL_PUBLIC_BASE || 'https://hesketon.co.il').replace(/\/$/, '');
const HOST = BASE.replace(/^https?:\/\//, '');

const log = (...a) => console.log(...a);

function caption(post, postUrl) {
  return `${post.title}

📖 התקציר המלא:
${postUrl}

—
טיפ לסטורי: אחרי העלאת התמונה, הוסיפו סטיקר קישור 🔗 עם הכתובת שלמעלה — כך צופים מגיעים לתקציר בהקלקה אחת (ה-QR שעל התמונה עובד גם בלי זה).
`;
}

async function makeKit(post) {
  const postUrl = `${BASE}/posts/${post.slug}/`;
  if (!post.lead) {
    log(`  ⚠️ דילוג: לפוסט ${post.slug} אין ציטוט־פותח (pull--lead).`);
    return null;
  }

  // QR straight to the specific post; quiet-zone handled by the white tile.
  const qrSvg = await QRCode.toString(postUrl, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#15131c', light: '#ffffff' },
  });

  const slides = buildShareStory(post, { qrSvg, url: HOST });
  const outDir = path.join(OUT_ROOT, post.slug);
  const files = await renderSlides(slides, outDir, post.slug);
  fs.writeFileSync(path.join(outDir, 'caption.txt'), caption(post, postUrl), 'utf8');
  return { outDir, files };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const all = args.includes('--all');
  const queries = args.filter((a) => !a.startsWith('--'));

  const posts = loadPublishedPosts(POSTS_DIR);

  if (!all && !queries.length) {
    log('\n📤 הסכתון — ערכת שיתוף לסטורי\n');
    log('שימוש: npm run share <slug>  (התאמה חלקית מספיקה)\n');
    log('פוסטים זמינים:');
    for (const p of posts) log(`  · ${p.slug}`);
    return;
  }

  const picked = all
    ? posts
    : queries.flatMap((q) => {
        const hits = posts.filter((p) => p.slug.includes(q));
        if (!hits.length) log(`⚠️ לא נמצא פוסט התואם ל-"${q}"`);
        return hits;
      });

  if (!picked.length) process.exit(1);

  log(`\n📤 מפיק ערכות שיתוף עבור ${picked.length} פוסט(ים)…\n`);
  for (const post of picked) {
    log(`• ${post.slug}`);
    const kit = await makeKit(post);
    if (kit) log(`  ↳ ${path.relative(ROOT, kit.outDir)}/ (${kit.files.length} תמונה + caption.txt)`);
  }
  log('\n✅ מוכן. שלחו את ה-PNG בוואטסאפ/AirDrop; ה-caption כולל את הקישור והטיפ.\n');
}

main().catch((err) => {
  console.error('\n❌ שגיאה:', err.message);
  process.exit(1);
});
