// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://knrcollective.com',

  // Use Cloudflare adapter for server-rendered endpoints
  output: 'static',
  adapter: cloudflare(),

  integrations: [
    react({ 
      // Optimize React production build
      experimentalReactChildren: true 
    }), 
    sitemap()
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Inline small assets to reduce requests
      assetsInlineLimit: 8192, // Increased to inline more small JS/CSS files
      // CSS code splitting
      cssCodeSplit: true,
      // Advanced code splitting and optimization
      rollupOptions: {
        output: {
          // More granular chunking to improve caching and loading
          manualChunks: (id) => {
            // React core bundle (critical, cached long-term)
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Router and core Astro functionality (critical)
            if (id.includes('ClientRouter') || id.includes('astro/transitions')) {
              return 'astro-core';
            }
            // Animation libraries (non-critical, can be lazy loaded)
            if (id.includes('framer-motion') || id.includes('motion')) {
              return 'animation-libs';
            }
            // Background and visual effects (non-critical, load last)
            if (id.includes('GridBackground') || id.includes('SideGrids') || id.includes('HalftoneBackground')) {
              return 'visual-effects';
            }
            // Stagger components (animation utilities)
            if (id.includes('Stagger') || id.includes('Reveal') || id.includes('motion.ts')) {
              return 'motion-utils';
            }
            // Utility libraries (small, can be inlined or grouped)
            if (id.includes('clsx') || id.includes('cn') || id.includes('utils')) {
              return 'utils';
            }
            // UI components (mid-priority)
            if (id.includes('/ui/') && !id.includes('Background') && !id.includes('SideGrids')) {
              return 'ui-components';
            }
            // Other vendor libraries (group by size/importance)
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
      // Minification settings
      minify: 'esbuild',
      // Target modern browsers for smaller bundles
      target: 'es2020',
    },
    // Performance optimizations
    optimizeDeps: {
      // Pre-bundle these dependencies
      include: ['react', 'react-dom'],
      // Exclude heavy dependencies from pre-bundling
      exclude: ['@astrojs/react'],
    },
    // CSS optimization
    css: {
      // Ensure CSS is processed for non-blocking loading
      postcss: {},
    },
  },
  
  // Enhanced compression and optimization
  compressHTML: true,
  
  // Prefetch strategy for better performance
  prefetch: {
    prefetchAll: false, // Don't prefetch everything
    defaultStrategy: 'viewport', // Only prefetch when in viewport
  },
});
