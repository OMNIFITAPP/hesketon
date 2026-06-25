import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORIES } from './consts';

const categoryNames = CATEGORIES.map((c) => c.name) as [string, ...string[]];

// Each post is a Markdown file in src/content/posts/.
// The frontmatter is validated against this schema at build time, so a
// malformed post fails loudly instead of shipping broken.
const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.md' }),
  schema: z.object({
    /** H1 + <title>. Should contain the main keyword. */
    title: z.string(),
    /** SEO meta description, ~150 chars of natural Hebrew. */
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /** Exactly one of the categories defined in consts.ts. */
    category: z.enum(categoryNames),
    tags: z.array(z.string()).default([]),
    /** Drafts are hidden in production but visible in `npm run dev`. */
    draft: z.boolean().default(false),
    /** Already sent in a newsletter issue? Orthogonal flag, not a lifecycle state. */
    inNewsletter: z.boolean().default(false),
    /** Show in the homepage hero rotation? */
    featured: z.boolean().default(false),
    /** Marks companion/deep-dive pieces as premium (for future paid access). */
    premium: z.boolean().default(false),
    /** 2–4 pointers to the depth we left out — the premium "hook", not the hidden core. */
    premiumHooks: z.array(z.string()).optional(),
    /**
     * Manually-curated, verified studies/sources mentioned in the episode.
     * NEVER auto-generated — the AI must not fabricate citations. A human adds
     * only real, checked references so readers can dig deeper on their own.
     */
    references: z
      .array(
        z.object({
          /** "Ganz AB, Rolnik B, … Snyder MP" — as published. */
          authors: z.string().optional(),
          year: z.union([z.number(), z.string()]).optional(),
          title: z.string(),
          /** Journal / publisher, e.g. "Journal of Psychiatric Research". */
          source: z.string().optional(),
          url: z.string().url().optional(),
        }),
      )
      .optional(),
    heroImage: z.string().optional(),
    /** Estimated reading time in minutes (filled by the generator). */
    readingTime: z.number().optional(),
    /** Where this summary came from — drives the attribution box. */
    source: z
      .object({
        podcast: z.string(),
        /** Canonical podcast id from src/data/podcasts.json (prevents entity drift). */
        podcastId: z.string().optional(),
        episode: z.string().optional(),
        host: z.string().optional(),
        /** Canonical person id from src/data/people.json. */
        hostId: z.string().optional(),
        guest: z.string().optional(),
        /** Canonical person id from src/data/people.json. */
        guestId: z.string().optional(),
        youtubeUrl: z.string().url().optional(),
        /** When the source episode was published (shown on cards + post). */
        publishedAt: z.coerce.date().optional(),
        /** Episode length in minutes — drives the "audio → reading" signature. */
        durationMinutes: z.number().optional(),
      })
      .optional(),
  }),
});

export const collections = { posts };
