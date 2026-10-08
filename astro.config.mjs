// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://knrcollective.com',

  // 'static' (default in Astro 5) pre-renders all pages. API routes with
  // `export const prerender = false` are handled automatically on Vercel/Netlify.
  // Add @astrojs/vercel or @astrojs/netlify adapter when deploying.
  output: 'static',

  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
