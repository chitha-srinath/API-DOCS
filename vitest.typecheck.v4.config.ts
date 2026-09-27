import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [],
    typecheck: {
      enabled: true,
      only: true,
      tsconfig: './tsconfig.v4.json',
      include: ['test/**/*.test-d.ts'],
      exclude: ['**/*.v5.test-d.ts'],
    },
  },
});
