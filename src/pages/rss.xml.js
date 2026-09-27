import rss from '@astrojs/rss';
import { SITE } from '../consts';
import { getPublishedPosts } from '../utils';

export async function GET(context) {
  // Same gate as every page: a post held for a future slot has no page yet, so
  // listing it here hands readers (and Google) a link that 404s until its slot.
  const posts = await getPublishedPosts();

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/posts/${post.id}/`,
      categories: [post.data.category, ...(post.data.tags ?? [])],
    })),
    customData: `<language>he-il</language>`,
  });
}
