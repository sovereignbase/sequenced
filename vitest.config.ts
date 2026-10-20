import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'test/array/**/test.ts',
      'test/text/**/test.ts',
      'test/map/**/test.ts',
      'test/errors/**/test.ts',
      'test/reporting/**/test.ts',
    ],
    environment: 'node',
    fileParallelism: false,
    reporters: ['default', './scripts/vitest-reporter.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      include: [
        'src/SequencedArray/**/*.ts',
        'src/SequencedText/**/*.ts',
        'src/SequencedMap/**/*.ts',
        'src/errors/**/*.ts',
        'src/index.ts',
      ],
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
