import { defineConfig } from 'vitest/config';

// ChipRatio is a single static page. Keep the build boring and reproducible:
// no code-splitting theatrics, inline the tiny CSS, ship a small bundle.
export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The exhaustive acceptance matrix runs slower under coverage instrumentation.
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/engine/types.ts'],
      reporter: ['text', 'html'],
    },
  },
});
