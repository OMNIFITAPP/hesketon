import { getCollection, type CollectionEntry } from 'astro:content';
import { PEOPLE, PODCASTS, type Person, type Podcast } from './consts';

/**
 * Two different dates, deliberately kept apart:
 *
 *   siteDate    — when *we* published the summary. This is what orders the site.
 *   episodeDate — when the episode itself aired. This is what the cards show,
 *                 labelled "פרק מ־". Unlabelled, readers took it for the sort
 *                 key, and the grid looked scrambled once older episodes went up.
 *
 * They used to be the same value, which buried new work: an older episode we
 * summarised today would sort by its original air date and land on page three.
 * "הכי חדש" is a promise to the returning reader — "what's new *here* since my
 * last visit" — so ordering follows us, while the visible date stays a fact
 * about the episode.
 */
function siteDate(p: CollectionEntry<'posts'>): number {
  return p.data.pubDate.getTime();
}

function episodeDate(p: CollectionEntry<'posts'>): number {
  return (p.data.source?.publishedAt ?? p.data.pubDate).getTime();
}

/**
 * All posts, newest on the site first (see siteDate above — not the air date).
 * Drafts are hidden in production builds but visible while running `npm run dev`.
 */
export async function getPublishedPosts(): Promise<CollectionEntry<'posts'>[]> {
  // Scheduling: a post whose pubDate is still in the future is held back in
  // production, so a finished post can sit on main until its slot. Write the
  // slot straight into the frontmatter with an explicit offset —
  //   pubDate: '2026-09-06T18:00:00+03:00'
  // — and the offset in the string is what decides, so Israeli DST is handled
  // by the date itself and never by a cron expression. A bare 'YYYY-MM-DD'
  // parses as UTC midnight, i.e. already due, which keeps every existing post
  // behaving exactly as before. Held posts stay visible in `npm run dev`.
  const now = Date.now();
  const posts = await getCollection('posts', ({ data }) =>
    import.meta.env.PROD ? data.draft !== true && data.pubDate.getTime() <= now : true,
  );
  // We usually publish several summaries the same day, so the primary key ties
  // constantly. Break those by the air date, newest first — otherwise cards land
  // in arbitrary order and a reader sees an older episode above a newer one.
  return posts.sort((a, b) => siteDate(b) - siteDate(a) || episodeDate(b) - episodeDate(a));
}

/**
 * "הבא בשבילכם" — the most relevant other posts to read after this one.
 * Scored at build time from the frontmatter we already have (no server, no JS):
 *   same guest (5) > same podcast (4) > same category (3) > shared tags (+1 each).
 * Ties break by newest on the site. Always returns something (falls back to newest),
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
      return { post: p, score, date: siteDate(p) };
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

/**
 * A name reduced to what a reader would type: no ד"ר/פרופ' prefix, no geresh,
 * quotes or dots, hyphens as spaces. So the tag "ניל דה גראס טייסון" and the
 * person "ניל דה-גראס טייסון" are recognised as the same name.
 */
export function normalizeName(s: string): string {
  return s
    .replace(/^(ד["״]ר|פרופ['׳])\s+/, '')
    .replace(/["״'׳.]/g, '')
    .replace(/[-־]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Tags that are only a person's name, mapped to that person. Such a tag used to
 * get its own archive page, which competed in search with the person's page
 * (Search Console had /tags/דן-מרטל/ at position 4 and /people/dan-martell/ at
 * 9). Now the chip links straight to the person, and the old tag URL redirects.
 */
export async function getPersonTagMap(): Promise<Map<string, Person>> {
  const people = (await getPeopleWithPosts()).map((x) => x.person);
  const byName = new Map<string, Person>();
  for (const p of people) {
    byName.set(normalizeName(p.nameHe), p);
    byName.set(normalizeName(p.nameEn), p);
  }
  const map = new Map<string, Person>();
  for (const post of await getPublishedPosts()) {
    for (const t of post.data.tags ?? []) {
      const person = byName.get(normalizeName(t));
      if (person) map.set(t, person);
    }
  }
  return map;
}

/** Markdown/HTML fragment → plain text (tags, **bold**, entities of our own making). */
function plainText(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The bullets of a post's אמ;לק box — already reviewed text, safe to reuse. */
export function tldrOf(post: CollectionEntry<'posts'>): string[] {
  const box = post.body?.match(/<aside class="tldr[^"]*">([\s\S]*?)<\/aside>/);
  if (!box) return [];
  return [...box[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => plainText(m[1]));
}

/**
 * True when `quote` appears word for word in the post. Ignores whitespace and
 * the final punctuation mark, since a quote that ends a sentence on the person
 * page may sit mid-sentence in the post ("…בשפה האנגלית," הוא אומר).
 */
export function postContainsQuote(post: CollectionEntry<'posts'>, quote: string): boolean {
  const norm = (s: string) => plainText(s).replace(/[.,!?]$/, '');
  return plainText(post.body ?? '').includes(norm(quote));
}

/** The post's opening quote and the name it's credited to (every post has one). */
export function leadQuoteOf(post: CollectionEntry<'posts'>): { text: string; by: string } | undefined {
  const m = post.body?.match(
    /<blockquote class="pull--lead">([\s\S]*?)<cite>\s*[—–-]\s*([^<]+?)\s*<\/cite>/,
  );
  if (!m) return undefined;
  return { text: plainText(m[1]).replace(/^["״]|["״]$/g, ''), by: m[2] };
}

/**
 * True when `quote` is listed in the post's quote record — the hidden
 * "מקורות הציטוטים" comment the pipeline writes after grounding each quote
 * against the transcript. Posts written before grounding existed have no record,
 * so nothing from them counts as checked.
 */
export function isGroundedQuote(post: CollectionEntry<'posts'>, quote: string): boolean {
  const record = post.body?.match(/<!--\s*מקורות הציטוטים[\s\S]*?-->/)?.[0];
  if (!record) return false;
  const letters = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '');
  return letters(record).includes(letters(quote));
}

/**
 * The conversations a person came as a guest to, oldest first by air date —
 * the order readers should meet them in, whatever order we summarised them.
 */
export async function appearancesOf(person: Person): Promise<CollectionEntry<'posts'>[]> {
  return (await getPublishedPosts())
    .filter((p) => p.data.source?.guestId === person.id || p.data.source?.guest === person.nameHe)
    .sort((a, b) => episodeDate(a) - episodeDate(b));
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
