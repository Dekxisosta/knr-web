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
            // React core bundle
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Animation libraries (non-critical)
            if (id.includes('framer-motion') || id.includes('motion')) {
              return 'animation-libs';
            }
            // Background components (non-critical)
            if (id.includes('GridBackground') || id.includes('SideGrids') || id.includes('HalftoneBackground')) {
              return 'visual-effects';
            }
            // Utility libraries
            if (id.includes('clsx') || id.includes('cn') || id.includes('utils')) {
              return 'utils';
            }
            // Other vendor libraries
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
  },
  
  // Compression
  compressHTML: true,
  
  // Prefetch strategy for better performance
  prefetch: {
    prefetchAll: false, // Don't prefetch everything
    defaultStrategy: 'viewport', // Only prefetch when in viewport
  },
});
