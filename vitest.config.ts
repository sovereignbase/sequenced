import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'test/{array,map,text}/**/test.ts',
      'test/{array,map,text}/compatibility/*.test.ts',
      'test/unit/**/test.ts',
    ],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    reporters: ['default', './scripts/vitest-reporter.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
})
