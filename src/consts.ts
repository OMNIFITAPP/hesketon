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
  /**
   * Google Search Console verification token. Paste ONLY the content value
   * from the "HTML tag" verification method (Search Console → Settings →
   * Ownership verification → HTML tag → the `content="..."` string). While
   * empty, no verification meta tag is emitted.
   */
  googleSiteVerification: '',
  /** Optional social links shown in the header + footer. Leave empty to hide. */
  social: {
    instagram: 'https://www.instagram.com/hesketon/',
    twitter: '', // e.g. 'https://x.com/hesketon'
    youtube: '',
    email: '',
  },
} as const;

// ──────────────────────────────────────────────────────────────
//  Newsletter — interim collector until the list justifies a real engine.
//
//  Addresses land as rows in a Google Sheet, via a silent POST to a
//  Google Form (form: "רשימת דיוור (ניוזלטר) הסכתון"). Google Forms has no
//  bot-challenge on formResponse, so a background submit works — unlike
//  Buttondown, whose embed endpoint answers with a Cloudflare Turnstile
//  page and silently drops non-browser posts (verified 2026-07-07).
//
//  `buttondownUsername` is kept dormant for the eventual engine switch.
//  Empty `formAction` → the signup form stays hidden.
// ──────────────────────────────────────────────────────────────
export const NEWSLETTER = {
  /** Google Form submit endpoint (…/formResponse). Empty → form hidden. */
  formAction:
    'https://docs.google.com/forms/d/e/1FAIpQLSfMJMCXFStaUXaxj4f2AcD3XYPe9d0p9Htp1Ze08bU2jhorlA/formResponse',
  /** The form's email question field id (entry.N). */
  emailField: 'entry.645048832',
  /** Dormant Buttondown handle — the "real engine" candidate for later. */
  buttondownUsername: 'hesketon',
  heading: 'הפודקאסטים הכי טובים, מזוקקים לתיבה שלך',
  subtext: 'גיליון שבועי. בלי ספאם, אפשר לבטל בכל רגע.',
  cta: 'הרשמה',
} as const;

/** The signup form's POST target, or '' when the newsletter is off. */
export function newsletterAction(): string {
  return NEWSLETTER.formAction;
}

// ──────────────────────────────────────────────────────────────
//  Analytics — privacy-friendly, cookieless (no consent banner needed).
//  Leave scriptSrc empty to disable. To enable, pick ONE provider:
//   • Plausible: scriptSrc 'https://plausible.io/js/script.js' + domain 'hesketon.co.il'
//   • Umami:     scriptSrc 'https://cloud.umami.is/script.js' + websiteId '<uuid>'
// ──────────────────────────────────────────────────────────────
export const ANALYTICS = {
  scriptSrc: 'https://cloud.umami.is/script.js',
  domain: '', // Plausible → data-domain
  websiteId: '43adec1a-d8bf-4522-adc7-aaf6602c3973', // Umami → data-website-id
} as const;

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
