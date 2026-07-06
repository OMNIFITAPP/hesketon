import { getCollection, type CollectionEntry } from 'astro:content';
import { PEOPLE, PODCASTS, type Person, type Podcast } from './consts';

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

/**
 * "הבא בשבילכם" — the most relevant other posts to read after this one.
 * Scored at build time from the frontmatter we already have (no server, no JS):
 *   same guest (5) > same podcast (4) > same category (3) > shared tags (+1 each).
 * Ties break by newest episode. Always returns something (falls back to newest),
 * so the end-of-post recommendation is never empty.
 */
export async function getRelatedPosts(
  current: CollectionEntry<'posts'>,
  limit = 3,
): Promise<CollectionEntry<'posts'>[]> {
  const posts = (await getPublishedPosts()).filter((p) => p.id !== current.id);
  const c = current.data;
  const cs = c.source;
  const cTags = new Set(c.tags ?? []);

  const sameGuest = (s?: typeof cs) =>
    !!cs &&
    !!s &&
    ((!!cs.guestId && cs.guestId === s.guestId) || (!!cs.guest && cs.guest === s.guest));
  const samePodcast = (s?: typeof cs) =>
    !!cs &&
    !!s &&
    ((!!cs.podcastId && cs.podcastId === s.podcastId) ||
      (!!cs.podcast && cs.podcast === s.podcast));

  return posts
    .map((p) => {
      const s = p.data;
      let score = 0;
      if (sameGuest(s.source)) score += 5;
      if (samePodcast(s.source)) score += 4;
      if (s.category === c.category) score += 3;
      for (const t of s.tags ?? []) if (cTags.has(t)) score += 1;
      return { post: p, score, date: postDate(p) };
    })
    .sort((a, b) => b.score - a.score || b.date - a.date)
    .slice(0, limit)
    .map((x) => x.post);
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

/** Posts from a given podcast (by canonical id or name). */
export function postsForPodcast(
  podcast: Podcast,
  posts: CollectionEntry<'posts'>[],
): CollectionEntry<'posts'>[] {
  return posts.filter((p) => {
    const s = p.data.source;
    if (!s) return false;
    return s.podcastId === podcast.id || s.podcast === podcast.name;
  });
}

/** Every podcast with at least one published post, with its posts. */
export async function getPodcastsWithPosts(): Promise<
  { podcast: Podcast; posts: CollectionEntry<'posts'>[] }[]
> {
  const posts = await getPublishedPosts();
  return PODCASTS.map((podcast) => ({ podcast, posts: postsForPodcast(podcast, posts) })).filter(
    (x) => x.posts.length > 0,
  );
}
