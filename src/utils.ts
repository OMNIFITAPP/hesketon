import { getCollection, type CollectionEntry } from 'astro:content';
import { PEOPLE, type Person } from './consts';

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

/** Posts where a given person appears as guest or host (by canonical id or name). */
export function postsForPerson(
  person: Person,
  posts: CollectionEntry<'posts'>[],
): CollectionEntry<'posts'>[] {
  return posts.filter((p) => {
    const s = p.data.source;
    if (!s) return false;
    return (
      s.guestId === person.id ||
      s.hostId === person.id ||
      s.guest === person.nameHe ||
      s.host === person.nameHe
    );
  });
}

/** Every person who appears in at least one published post, with their posts. */
export async function getPeopleWithPosts(): Promise<
  { person: Person; posts: CollectionEntry<'posts'>[] }[]
> {
  const posts = await getPublishedPosts();
  return PEOPLE.map((person) => ({ person, posts: postsForPerson(person, posts) })).filter(
    (x) => x.posts.length > 0,
  );
}
