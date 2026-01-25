import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import process from 'node:process';
import path from 'node:path';

const ghPagesRuntimePattern =
  /^https:\/\/[a-z0-9-]+\.github\.io\/oscar-export-analyzer\/.*$/i;

export const GH_PAGES_RUNTIME_PATTERN = ghPagesRuntimePattern;

export default defineConfig({
  base: process.env.BASE_URL || '/oscar-export-analyzer/',
  plugins: [
    react(),
    visualizer({ filename: 'stats.html', template: 'treemap', open: false }),
    VitePWA({
      registerType: 'prompt', // No auto-reload; user controls updates
      includeAssets: ['**/*.{png,svg,ico,woff,woff2}'],
      manifest: {
        name: 'OSCAR Export Analyzer',
        short_name: 'OSCAR Analyzer',
        description:
          'Analyze OSCAR sleep therapy data with local-first privacy',
        theme_color: '#3498db',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/oscar-export-analyzer/',
        start_url: '/oscar-export-analyzer/',
        icons: [
          {
            src: '/oscar-export-analyzer/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/oscar-export-analyzer/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/oscar-export-analyzer/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['health', 'medical', 'utilities'],
        orientation: 'any',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        globIgnores: ['**/*.map'],
        maximumFileSizeToCacheInBytes: 7 * 1024 * 1024, // 7MB - large bundle due to Plotly
        runtimeCaching: [
          {
            urlPattern: ghPagesRuntimePattern,
            handler: 'CacheFirst',
            options: {
              cacheName: 'oscar-app-shell',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
            },
          },
          {
            urlPattern: /\/oscar-export-analyzer\/$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'oscar-html',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable in dev for testing
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@ui': path.resolve(__dirname, 'src/components/ui'),
      '@context': path.resolve(__dirname, 'src/context'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.test.{js,jsx,ts,tsx}', 'styles.*.test.js'],
    testTimeout: 20000,
    teardownTimeout: 30000, // Allow 30s for worker cleanup to prevent termination timeouts
    pool: 'forks',
    poolOptions: {
      forks: {
        // Note: execArgv doesn't propagate NODE_OPTIONS; use package.json scripts instead
        // See: docs/work/debugging/RCA_vitest_worker_heap_exhaustion.md
        maxForks: 4, // Reduce parallelism to lower memory pressure
        minForks: 1,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/setupTests.js',
        'src/test-utils/**',
        'src/main.jsx',
      ],
      all: true,
      // Thresholds disabled for baseline measurement
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
  // Treat any Vite/Rollup warnings as errors to enforce clean builds
  build: {
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      onwarn(warning) {
        throw new Error(warning.message || warning);
      },
    },
  },
});
