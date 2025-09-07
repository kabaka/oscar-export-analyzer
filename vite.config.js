import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.test.{js,jsx,ts,tsx}']
  },
  // Treat any Vite/Rollup warnings as errors to enforce clean builds
  build: {
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      onwarn(warning, defaultWarn) {
        throw new Error(warning.message || warning);
      }
    }
  }
});
