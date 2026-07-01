// ============================================================
//  select.mjs — weekly content plan + queue state.
//
//  The plan (3 feed posts + stories) is sourced 100% from already
//  published posts. We rotate through posts that haven't been used
//  for a given format yet, so material never repeats.
//
//  Queue file: social-queue.yml (mirrors content-queue.yml style).
// ============================================================

import fs from 'node:fs';
import yaml from 'js-yaml';

/**
 * The weekly slots. `offsetDays` is relative to the run's week start
 * (Sunday). Each slot names a format + a builder + the hour to post.
 */
export const WEEKLY_PLAN = [
  { slot: 'sun-carousel', format: 'carousel', kicker: 'תקציר השבוע', offsetDays: 0, hour: 19 },
  { slot: 'tue-quote', format: 'quote', kicker: 'ציטוט', offsetDays: 2, hour: 13 },
  { slot: 'thu-lessons', format: 'lessons', kicker: '3 דברים שלמדנו', offsetDays: 4, hour: 19 },
  // Phase B: { slot: 'sat-reel', format: 'reel', offsetDays: 6, hour: 11 },
];

export function loadQueue(file) {
  if (!fs.existsSync(file)) return { items: [] };
  const data = yaml.load(fs.readFileSync(file, 'utf8')) || {};
  return { items: Array.isArray(data.items) ? data.items : [] };
}

export function saveQueue(file, queue) {
  const header =
    '# social-queue.yml — תור הפרסום לרשתות.\n' +
    '# status: pending_review → (אישור/מיזוג) → approved → published.\n' +
    '# ערכו כיתוב/תאריך כאן, או מזגו את ה-PR כדי לאשר את כל הפריטים.\n\n';
  fs.writeFileSync(file, header + yaml.dump(queue, { lineWidth: 100, noRefs: true }), 'utf8');
}

/** Posts already used for a format (so we don't repeat). */
function usedSlugs(queue, format) {
  return new Set(queue.items.filter((it) => it.format === format).map((it) => it.slug));
}

/** Sunday of the week containing `d` (local), at 00:00. */
function weekStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // 0 = Sunday
  return x;
}

function scheduledFor(base, offsetDays, hour) {
  const x = new Date(base);
  x.setDate(x.getDate() + offsetDays);
  x.setHours(hour, 0, 0, 0);
  return x.toISOString();
}

/**
 * Pick posts for this week's slots.
 * @returns {object[]} new queue items (status pending_review), not yet saved.
 */
export function planWeek({ posts, queue, now = new Date(), platform = 'instagram', stories = true }) {
  const base = weekStart(now);
  // start filling from the slot whose schedule hasn't passed yet (when run mid-week)
  const items = [];
  const takenThisRun = new Set();

  for (const plan of WEEKLY_PLAN) {
    const used = usedSlugs(queue, plan.format);
    const pick = posts.find((p) => !used.has(p.slug) && !takenThisRun.has(p.slug) && hasMaterial(p, plan.format));
    if (!pick) continue;
    takenThisRun.add(pick.slug);

    items.push({
      id: `${base.toISOString().slice(0, 10)}_${plan.slot}`,
      slug: pick.slug,
      platform,
      format: plan.format,
      kicker: plan.kicker,
      scheduledFor: scheduledFor(base, plan.offsetDays, plan.hour),
      status: 'pending_review',
      caption: '',
      hashtags: [],
      assets: [],
      permalink: '',
    });

    if (stories) {
      items.push({
        id: `${base.toISOString().slice(0, 10)}_${plan.slot}-story`,
        slug: pick.slug,
        platform,
        format: 'story',
        kicker: '',
        scheduledFor: scheduledFor(base, plan.offsetDays, plan.hour + 1),
        status: 'pending_review',
        caption: '',
        hashtags: [],
        assets: [],
        permalink: '',
      });
    }
  }
  return items;
}

/** Does a post have the raw material a format needs? */
export function hasMaterial(post, format) {
  switch (format) {
    case 'quote':
    case 'story':
      return !!post.lead?.text;
    case 'lessons':
      return post.takeaways.length >= 3 || post.tldr.length >= 3;
    case 'carousel':
    default:
      return !!post.lead?.text && (post.tldr.length + post.takeaways.length) >= 3;
  }
}
