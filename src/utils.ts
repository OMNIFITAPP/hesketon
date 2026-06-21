import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * All posts, newest first. Drafts are hidden in production builds but
 * visible while running `npm run dev` so you can preview them.
 */
export async function getPublishedPosts(): Promise<CollectionEntry<'posts'>[]> {
  const posts = await getCollection('posts', ({ data }) =>
    import.meta.env.PROD ? data.draft !== true : true,
  );
  return posts.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}
