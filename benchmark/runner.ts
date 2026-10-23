import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cpus, platform, arch } from 'node:os'
import { createRequire } from 'node:module'
import { defaultMaxListeners, setMaxListeners } from 'node:events'
import { afterAll, beforeAll, describe, it } from 'vitest'

export type Implementation = 'plain' | 'wrapper' | 'wrapper+listeners'
interface Workload {
  run(): void
  verify(): void
  dispose(): void
  resetListeners?(): void
}

export function runBenchmarks<Operation extends string, Fixture, Constructor>(
  model: string,
  Constructor: Constructor,
  workloads: {
    operations: readonly Operation[]
    prepareFixture(
      operation: Operation,
      size: number,
      batch: number,
      seed: number
    ): Fixture
    createWorkload(
      fixture: Fixture,
      implementation: Implementation,
      Constructor?: Constructor
    ): Workload
    isReadOnly(operation: Operation): boolean
    isTraversal(operation: Operation): boolean
    callsPerSample?(operation: Operation, batch: number): number
    supports?(operation: Operation, implementation: Implementation): boolean
  }
) {
  function integers(name: string, fallback: number[]) {
    const values = process.env[name]?.split(',').map(Number) ?? fallback
    if (!values.length || values.some((n) => !Number.isInteger(n) || n < 1))
      throw new RangeError(`${name} requires positive integers`)
    return [...new Set(values)]
  }
  const sizes = integers('BENCH_SIZES', [100, 1000, 10000])
  const batch = integers('BENCH_BATCH', [32])[0]
  const time = integers('BENCH_TIME', [20])[0]
  const seed = Number(process.env.BENCH_SEED ?? 0xc0ffee)
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new RangeError('BENCH_SEED requires a uint32')
  if (sizes.some((size) => size < batch))
    throw new RangeError('Batch must not exceed size')
  const selected = (process.env.BENCH_OPERATIONS?.split(',') ??
    workloads.operations) as Operation[]
  if (selected.some((operation) => !workloads.operations.includes(operation)))
    throw new TypeError('Unknown benchmark operation')
  const implementations = (process.env.BENCH_IMPLEMENTATIONS?.split(',') ?? [
    'plain',
    'wrapper',
    'wrapper+listeners',
  ]) as Implementation[]
  if (
    !implementations.length ||
    implementations.some(
      (name) => !['plain', 'wrapper', 'wrapper+listeners'].includes(name)
    )
  )
    throw new TypeError('Unknown benchmark implementation')
  const supports = (operation: Operation, implementation: Implementation) =>
    workloads.supports?.(operation, implementation) ?? true
  const rows: Array<{
    size: number
    operation: Operation
    implementation: string
    callsPerSample: number
    meanNanosecondsPerCall: number
    callsPerSecond: number
    entriesPerSecond?: number
    relativeMarginOfErrorPercent: number
    samples: number
    wrapperToPlain?: number
  }> = []
  const output = resolve('benchmark/.results')
  const file = resolve(output, model.toLowerCase() + '.json')
  const listenerLimit = defaultMaxListeners
  beforeAll(() => {
    rmSync(file, { force: true })
    setMaxListeners(0)
  })

  describe(`Sequenced${model} vs plain Projection`, () => {
    for (const size of sizes)
      for (const operation of selected) {
        const available = implementations.filter((implementation) =>
          supports(operation, implementation)
        )
        it.skipIf(!available.length)(
          `${operation} / size=${size}`,
          async ({ bench }) => {
            const calls = workloads.callsPerSample?.(operation, batch) ?? batch
            const fixture = workloads.prepareFixture(
              operation,
              size,
              calls,
              seed
            )
            const listenerMutation =
              operation === 'addEventListener' ||
              operation === 'removeEventListener'
            const registrations = available.map((implementation) => {
              let workload: Workload
              const setup = () => {
                workload = workloads.createWorkload(
                  fixture,
                  implementation,
                  Constructor
                )
              }
              const teardown = () => {
                try {
                  workload.verify()
                } finally {
                  workload.dispose()
                }
              }
              return bench(
                implementation,
                {
                  async: false,
                  ...(listenerMutation
                    ? {
                        beforeAll: setup,
                        beforeEach: () => workload.resetListeners!(),
                        afterAll: teardown,
                      }
                    : workloads.isReadOnly(operation)
                      ? { beforeAll: setup, afterAll: teardown }
                      : { beforeEach: setup, afterEach: teardown }),
                },
                () => workload.run()
              )
            })
            const options = {
              time,
              iterations: 8,
              warmupTime: Math.min(time, 10),
              warmupIterations: 3,
            }
            const results =
              registrations.length === 1
                ? [await registrations[0].run(options)]
                : await bench
                    .compare(...registrations, options)
                    .then((storage) =>
                      available.map((name) => storage.get(name))
                    )
            const plain = results.find((result) => result.name === 'plain')
            for (const result of results)
              rows.push({
                size,
                operation,
                implementation: result.name,
                callsPerSample: calls,
                meanNanosecondsPerCall: (result.latency.mean * 1e6) / calls,
                callsPerSecond: (calls * 1e3) / result.latency.mean,
                entriesPerSecond: workloads.isTraversal(operation)
                  ? (calls * size * 1e3) / result.latency.mean
                  : undefined,
                relativeMarginOfErrorPercent: result.latency.rme,
                samples: result.latency.samplesCount,
                wrapperToPlain: plain
                  ? result.latency.mean / plain.latency.mean
                  : undefined,
              })
          }
        )
      }
  })

  afterAll(() => {
    setMaxListeners(listenerLimit)
    const report = {
      generatedAt: new Date().toISOString(),
      environment: {
        node: process.version,
        sequencer: createRequire(import.meta.url)(
          '@sovereignbase/sequencer/package.json'
        ).version,
        platform: platform(),
        arch: arch(),
        cpu: cpus()[0]?.model,
      },
      config: {
        sizes,
        batch,
        time,
        seed,
        implementations,
        operations: selected,
      },
      units: {
        callsPerSecond:
          'complete method calls per second; iteration calls consume the entire collection',
        entriesPerSecond: 'entries visited per second by traversal methods',
      },
      unavailable: selected.flatMap((operation) =>
        implementations
          .filter((implementation) => !supports(operation, implementation))
          .map((implementation) => ({
            operation,
            implementation,
            reason: 'Projection has no equivalent API',
          }))
      ),
      complete:
        rows.length ===
        sizes.length *
          selected.reduce(
            (count, operation) =>
              count +
              implementations.filter((implementation) =>
                supports(operation, implementation)
              ).length,
            0
          ),
      results: rows,
    }
    mkdirSync(output, { recursive: true })
    writeFileSync(file, JSON.stringify(report, null, 2) + '\n')
    for (const size of sizes) {
      console.log(`${model} throughput, size=${size} (ops/s)`)
      console.table(
        selected.map((operation) =>
          Object.fromEntries([
            ['operation', operation],
            ...implementations.map((implementation) => [
              implementation,
              rows
                .find(
                  (row) =>
                    row.size === size &&
                    row.operation === operation &&
                    row.implementation === implementation
                )
                ?.callsPerSecond.toLocaleString('en-US', {
                  maximumFractionDigits: 0,
                }) ?? '—',
            ]),
          ])
        )
      )
    }
  })
}
