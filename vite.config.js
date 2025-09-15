import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import process from 'node:process';

export default defineConfig({
  base: process.env.BASE_URL || '/oscar-export-analyzer/',
  plugins: [
    react(),
    visualizer({ filename: 'stats.html', template: 'treemap', open: false }),
  ],
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
