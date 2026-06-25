import { getCollection, type CollectionEntry } from 'astro:content';

/** The episode's own publish date when available, else when we posted it. */
function postDate(p: CollectionEntry<'posts'>): number {
  return (p.data.source?.publishedAt ?? p.data.pubDate).getTime();
}

/**
 * All posts, newest first — by the episode's publish date (what the cards show).
 * Drafts are hidden in production builds but visible while running `npm run dev`.
 */
export async function getPublishedPosts(): Promise<CollectionEntry<'posts'>[]> {
  const posts = await getCollection('posts', ({ data }) =>
    import.meta.env.PROD ? data.draft !== true : true,
  );
  return posts.sort((a, b) => postDate(b) - postDate(a));
}
