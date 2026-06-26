// ──────────────────────────────────────────────────────────────
//  Site-wide configuration. Edit this file to rebrand the blog.
// ──────────────────────────────────────────────────────────────

export const SITE = {
  /** Brand name, shown in the header and <title>. */
  title: 'הסכתון',
  /** Latin name, used for some metadata. */
  titleEn: 'Hesketon',
  /** Tagline / default meta description. */
  description: 'תקצירים חכמים ומקוריים מהפודקאסטים הכי טובים — בעברית.',
  /** Production URL (no trailing slash). Keep in sync with astro.config.mjs. */
  url: 'https://hesketon.co.il',
  lang: 'he',
  dir: 'rtl',
  /** Open Graph locale. */
  locale: 'he_IL',
  author: 'הסכתון',
  /** Optional social links shown in the footer. Leave a value empty to hide it. */
  social: {
    twitter: '', // e.g. 'https://x.com/hesketon'
    youtube: '',
    email: '',
  },
} as const;

// ──────────────────────────────────────────────────────────────
//  Newsletter (Buttondown). To turn the signup form on:
//   1. Create a free list at buttondown.com.
//   2. Put your username below (Settings → your handle in the URL).
//   3. The form appears automatically in the footer + under each post.
//  While `buttondownUsername` is empty, the form stays hidden.
// ──────────────────────────────────────────────────────────────
export const NEWSLETTER = {
  /** Your Buttondown handle, e.g. 'hesketon'. Empty → form hidden. */
  buttondownUsername: '',
  heading: 'הפודקאסטים הכי טובים, מזוקקים לתיבה שלך',
  subtext: 'גיליון שבועי. בלי ספאם, אפשר לבטל בכל רגע.',
  cta: 'הרשמה',
} as const;

/** Buttondown embed-subscribe endpoint, or '' when no username is set. */
export function newsletterAction(): string {
  return NEWSLETTER.buttondownUsername
    ? `https://buttondown.com/api/emails/embed-subscribe/${NEWSLETTER.buttondownUsername}`
    : '';
}

export type Category = {
  /** Hebrew display name — this is what posts reference in frontmatter. */
  name: string;
  /** URL slug (ASCII, for clean links like /categories/health). */
  slug: string;
  /** Short Hebrew description shown on the category page. */
  description: string;
};

// Single source of truth, shared with the Node generator script
// (scripts/generate.mjs reads the same file). Edit categories there.
import categoriesData from '../categories.json';

/**
 * The blog's topic taxonomy. The AI writer is constrained to choose exactly
 * one of these per post, which keeps the site organized. Add/rename freely
 * in categories.json — just keep `name` unique (posts match on it) and
 * `slug` ASCII + unique.
 */
export const CATEGORIES: Category[] = categoriesData as Category[];

/** Look up a category by its Hebrew name. */
export function categoryByName(name: string): Category | undefined {
  return CATEGORIES.find((c) => c.name === name);
}

/** Look up a category by its slug. */
export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** Turn a free-form tag into a URL-safe slug (keeps Hebrew letters). */
export function tagToSlug(tag: string): string {
  return tag.trim().replace(/\s+/g, '-');
}

// ── Canonical entities (prevents "אנדי גלפין"/"ד״ר אנדי גלפין" fragmenting) ──
import peopleData from './data/people.json';
import podcastsData from './data/podcasts.json';

export type Person = { id: string; nameHe: string; nameEn: string; title?: string };
export type Podcast = { id: string; name: string; hostId?: string; description?: string };

export const PEOPLE: Person[] = peopleData as Person[];
export const PODCASTS: Podcast[] = podcastsData as Podcast[];

/** Look up a person (host or guest) by canonical id. */
export function personById(id?: string): Person | undefined {
  return id ? PEOPLE.find((p) => p.id === id) : undefined;
}

/** Look up a person by their Hebrew display name (fallback when no id is set). */
export function personByName(name?: string): Person | undefined {
  return name ? PEOPLE.find((p) => p.nameHe === name) : undefined;
}

/** Look up a podcast by canonical id. */
export function podcastById(id?: string): Podcast | undefined {
  return id ? PODCASTS.find((p) => p.id === id) : undefined;
}

/** Look up a podcast by its display name (fallback when no id is set). */
export function podcastByName(name?: string): Podcast | undefined {
  return name ? PODCASTS.find((p) => p.name === name) : undefined;
}

/** Extract the 11-char video id from any common YouTube URL form. */
export function youtubeId(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m?.[1];
}

/** Thumbnail URL for a YouTube video. `maxres` is sharp but not always present;
 *  pair it with an onerror fallback to `hq` (which always exists). */
export function youtubeThumb(
  url?: string,
  quality: 'maxres' | 'hq' = 'maxres',
): string | undefined {
  const id = youtubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/${quality}default.jpg` : undefined;
}
