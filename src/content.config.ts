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
    /** Marks companion/deep-dive pieces as premium (for future paid access). */
    premium: z.boolean().default(false),
    heroImage: z.string().optional(),
    /** Estimated reading time in minutes (filled by the generator). */
    readingTime: z.number().optional(),
    /** Where this summary came from — drives the attribution box. */
    source: z
      .object({
        podcast: z.string(),
        episode: z.string().optional(),
        host: z.string().optional(),
        guest: z.string().optional(),
        youtubeUrl: z.string().url().optional(),
        publishedAt: z.string().optional(),
        /** Episode length in minutes — drives the "audio → reading" signature. */
        durationMinutes: z.number().optional(),
      })
      .optional(),
  }),
});

export const collections = { posts };
