import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
  },
});
