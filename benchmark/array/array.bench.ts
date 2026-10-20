import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { cpus, platform, arch } from 'node:os'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { loadArray, type ArrayConstructor } from '../../test/array/array.js'
import {
  createWorkload,
  operations,
  prepareFixture,
  type Implementation,
  type Operation,
} from './workloads.js'

function integers(name: string, fallback: number[]): number[] {
  const values = process.env[name]?.split(',').map(Number) ?? fallback
  if (!values.length || values.some((n) => !Number.isInteger(n) || n < 1))
    throw new RangeError(`${name} must contain positive integers`)
  return [...new Set(values)]
}

const sizes = integers('BENCH_SIZES', [100, 1_000, 10_000])
function integer(name: string, fallback: number): number {
  const values = integers(name, [fallback])
  if (values.length !== 1) throw new RangeError(`${name} must be one integer`)
  return values[0]
}
const batch = integer('BENCH_BATCH', 32)
const time = integer('BENCH_TIME', 100)
const sequencerVersion = createRequire(import.meta.url)(
  '@sovereignbase/sequencer/package.json'
).version as string
const implementations = (process.env.BENCH_IMPLEMENTATIONS?.split(',') ?? [
  'plain',
  'wrapper',
  'wrapper+listeners',
]) as Implementation[]
if (
  implementations.some(
    (name) => !['plain', 'wrapper', 'wrapper+listeners'].includes(name)
  )
)
  throw new TypeError(
    'BENCH_IMPLEMENTATIONS must be plain, wrapper, or wrapper+listeners'
  )
const selectedOperations = (process.env.BENCH_OPERATIONS?.split(',') ??
  operations) as Operation[]
if (selectedOperations.some((name) => !operations.includes(name)))
  throw new TypeError('Unknown BENCH_OPERATIONS entry')
if (sizes.some((size) => size < batch))
  throw new RangeError('BENCH_BATCH must not exceed BENCH_SIZES')

let Constructor: ArrayConstructor | undefined
const output = resolve('benchmark/.results')
beforeAll(async () => {
  // A failed wrapper import must not leave an older baseline looking current.
  rmSync(resolve(output, 'array.json'), { force: true })
  rmSync(resolve(output, 'array.md'), { force: true })
  if (implementations.some((name) => name !== 'plain'))
    Constructor = await loadArray()
})

const rows: Array<{
  size: number
  operation: Operation
  implementation: Implementation
  meanNanosecondsPerCall: number
  callsPerSecond: number
  relativeMarginOfErrorPercent: number
  samples: number
  wrapperToPlain?: number
}> = []

describe('SequencedArray vs plain sequencer', () => {
  for (const size of sizes) {
    for (const operation of selectedOperations) {
      it(`${operation} / size=${size} / batch=${batch}`, async ({ bench }) => {
        const fixture = prepareFixture(operation, size, batch)
        const readOnly = [
          'length',
          'at.middle',
          'get.middle',
          'values',
          'slice.all',
          'slice.middle',
          'snapshot',
        ].includes(operation)
        const registrations = implementations.map((implementation) => {
          let workload: ReturnType<typeof createWorkload>
          const setup = () => {
            workload = createWorkload(fixture, implementation, Constructor)
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
              // Reuse an unchanged fixture for reads. Mutations always start
              // fresh; otherwise apply/merge would only time duplicate delivery.
              ...(readOnly
                ? { beforeAll: setup, afterAll: teardown }
                : { beforeEach: setup, afterEach: teardown }),
            },
            () => workload.run()
          )
        })
        const options = {
          time,
          iterations: 8,
          warmupTime: Math.min(time, 50),
          warmupIterations: 3,
        }
        const results =
          registrations.length === 1
            ? [await registrations[0].run(options)]
            : await bench
                .compare(...registrations, options)
                .then((storage) =>
                  implementations.map((name) => storage.get(name))
                )
        const plain = results.find((result) => result.name === 'plain')
        for (const result of results) {
          rows.push({
            size,
            operation,
            implementation: result.name as Implementation,
            meanNanosecondsPerCall: (result.latency.mean * 1e6) / batch,
            callsPerSecond: (1_000 * batch) / result.latency.mean,
            relativeMarginOfErrorPercent: result.latency.rme,
            samples: result.latency.samplesCount,
            wrapperToPlain: plain
              ? result.latency.mean / plain.latency.mean
              : undefined,
          })
        }
      })
    }
  }
})

afterAll(() => {
  if (!rows.length) return
  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      sequencer: sequencerVersion,
    },
    config: {
      sizes,
      batch,
      time,
      implementations,
      operations: selectedOperations,
    },
    complete:
      rows.length ===
      sizes.length * selectedOperations.length * implementations.length,
    // Failed or filtered cases have no row. The Vitest process still exits nonzero on failure.
    results: rows,
  }
  mkdirSync(output, { recursive: true })
  writeFileSync(
    resolve(output, 'array.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  const lines = [
    '# SequencedArray benchmark',
    '',
    `Node ${process.version}; ${platform()} ${arch()}; ${cpus()[0]?.model}.`,
    `Sequencer ${sequencerVersion}.`,
    '',
    `Batch: ${batch} API calls. Times exclude fixture creation, validation and cleanup.`,
    `Complete: ${report.complete}.`,
    '',
    'Ratio = wrapper mean latency / plain mean latency; values above 1 mean slower.',
    '',
    '| Size | Operation | Implementation | ns/call | calls/s | RME % | Ratio to plain |',
    '| ---: | --- | --- | ---: | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| ${row.size} | ${row.operation} | ${row.implementation} | ${row.meanNanosecondsPerCall.toFixed(1)} | ${Math.round(row.callsPerSecond)} | ${row.relativeMarginOfErrorPercent.toFixed(2)} | ${row.wrapperToPlain?.toFixed(2) ?? '—'} |`
    ),
    '',
  ]
  writeFileSync(resolve(output, 'array.md'), lines.join('\n'))
  console.log(`Array benchmark reports: ${output}`)
})
