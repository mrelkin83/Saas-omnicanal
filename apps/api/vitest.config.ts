import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/modules/auth/**',
        'src/modules/ai/**',
        'src/lib/crypto.ts',
        'src/jobs/campaign-sender.job.ts',
      ],
      exclude: ['**/*.test.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
      },
    },
  },
});
