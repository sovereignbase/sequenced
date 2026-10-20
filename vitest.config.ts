import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/array/**/test.ts', 'test/text/**/test.ts'],
    environment: 'node',
    fileParallelism: false,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: [
        'src/SequencedArray/**/*.ts',
        'src/SequencedText/**/*.ts',
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
