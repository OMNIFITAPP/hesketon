// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Your live domain. Drives canonical URLs, the sitemap, and the RSS feed.
  site: 'https://hesketon.co.il',
  // 'always' matches how GitHub Pages actually serves `format: 'directory'`
  // (it 301s /page → /page/). Declaring it keeps dev honest and stops us
  // re-introducing slash-less internal links, which Search Console reports
  // as "Page with redirect".
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // Submit only pages worth indexing. Tag archives (200+, mostly a single
      // post each) and utility pages would otherwise make ~60% of the sitemap
      // thin — on a new domain that buries the actual articles.
      filter: (page) => {
        const p = new URL(page).pathname;
        return !p.startsWith('/tags/') && p !== '/search/' && p !== '/thanks/';
      },
    }),
  ],
  build: {
    // Pretty URLs: /posts/my-slug/ instead of /posts/my-slug.html
    format: 'directory',
  },
  markdown: {
    // Keep Hebrew punctuation exactly as written (straight quotes/geresh)
    // instead of converting to English-style curly quotes & dashes.
    smartypants: false,
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
