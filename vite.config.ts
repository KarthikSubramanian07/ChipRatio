import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Multi-page static site: calculator home plus trust pages and a real 404.
export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about/index.html'),
        contact: resolve(__dirname, 'contact/index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        notFound: resolve(__dirname, '404.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The exhaustive acceptance matrix runs slower under coverage instrumentation.
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/agent/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/engine/types.ts'],
      reporter: ['text', 'html'],
    },
  },
});
