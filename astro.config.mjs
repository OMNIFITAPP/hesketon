// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Your live domain. Drives canonical URLs, the sitemap, and the RSS feed.
  site: 'https://hesketon.co.il',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
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
