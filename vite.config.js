import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import process from 'node:process';
import path from 'node:path';

export default defineConfig({
  base: process.env.BASE_URL || '/oscar-export-analyzer/',
  plugins: [
    react(),
    visualizer({ filename: 'stats.html', template: 'treemap', open: false }),
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
