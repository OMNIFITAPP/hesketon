import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORIES, PEOPLE } from './consts';

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
    /**
     * Canon marker — "חובת האזנה". Orthogonal to category (a classic Musk
     * episode is still tech). Drives the gold treatment, /classics and the
     * random-picker chip. Curated by hand; never auto-set.
     */
    classic: z.boolean().default(false),
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
  })
    // A returning guest must land on the same person page every time. Person
    // pages come from people.json, and a guest name spelled a little differently
    // silently drops the post from that page. So a published (or scheduled) post
    // with a guest must carry a known id. Drafts are exempt.
    .superRefine((data, ctx) => {
      const s = data.source;
      if (data.draft || !s?.guest) return;
      if (!s.guestId) {
        ctx.addIssue({
          code: 'custom',
          path: ['source', 'guestId'],
          message: `guest "${s.guest}" has no guestId — add the person's id from src/data/people.json (add the person there first if they're new)`,
        });
      } else if (!PEOPLE.some((p) => p.id === s.guestId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['source', 'guestId'],
          message: `guestId "${s.guestId}" is not in src/data/people.json`,
        });
      }
    }),
});

// Person profiles — the verified facts behind a person page (v2). One YAML
// file per person, named by the id in src/data/people.json. Everything here is
// checked by hand against a source; the person page refuses to build if a
// profile names an unknown person or quotes a line its post doesn't contain.
const profiles = defineCollection({
  loader: glob({ base: './src/content/profiles', pattern: '**/*.yaml' }),
  schema: z.object({
    /** 1–3 sentences of Hebrew. Every fact in it must appear in `sources`. */
    bio: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string().url() })).min(1),
    /** Other forms people search, e.g. "אנתוני רובינס" for טוני רובינס. */
    altNames: z.array(z.string()).default([]),
    books: z
      .array(
        z.object({
          /** The title as published. */
          title: z.string(),
          year: z.number(),
          /** Co-authors, as published. */
          with: z.string().optional(),
          /** Title of a Hebrew edition — only when one exists and was checked. */
          titleHe: z.string().optional(),
          /** No Hebrew edition: a free translation, always labelled as such. */
          gloss: z.string().optional(),
          about: z.string(),
          url: z.string().url(),
        }),
      )
      .default([]),
    /** Official channels only. Also emitted as Person.sameAs. */
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    /** Verbatim from a post whose quotes passed grounding; `post` is its slug. */
    quotes: z.array(z.object({ he: z.string(), post: z.string() })).default([]),
  }),
});

export const collections = { posts, profiles };
