import { defineConfig } from 'vitest/config'

/** Benchmarks have their own project: no coverage instrumentation or parallel load. */
export default defineConfig({
  test: {
    include: [],
    benchmark: {
      enabled: true,
      include: ['benchmark/{array,text,map}/**/*.bench.ts'],
    },
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    reporters: ['default'],
    testTimeout: 120_000,
    coverage: { enabled: false },
  },
})
