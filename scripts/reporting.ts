import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { arch, platform } from 'node:os'
import { format, resolveConfig } from 'prettier'

export const models = ['array', 'map', 'text'] as const
export type Model = (typeof models)[number]
export const repository = fileURLToPath(new URL('../', import.meta.url))
export const metrics = ['statements', 'branches', 'functions', 'lines'] as const
export type Coverage = Record<
  (typeof metrics)[number],
  { total: number; covered: number; pct: number }
>
export interface Counts {
  passed: number
  failed: number
  skipped: number
}
export interface TestFile extends Counts {
  file: string
  duration: number
  status: string
}
export interface UnitRun extends Counts {
  generatedAt: string
  status: string
  environment: { node: string; platform: string; arch: string }
  files: TestFile[]
  coverage?: Coverage
  filter?: string
  errors: number
}
export interface RuntimeRun extends Counts {
  generatedAt: string
  version?: string
  status: string
  duration: number
}
export interface TestReport {
  vitest?: UnitRun
  compatibility?: Record<string, RuntimeRun>
}
export interface BenchmarkRow {
  size: number
  operation: string
  implementation: string
  callsPerSecond: number
  meanNanosecondsPerCall: number
  relativeMarginOfErrorPercent: number
  samples: number
}
export interface BenchmarkReport {
  generatedAt: string
  status?: string
  environment: {
    node: string
    platform: string
    arch: string
    cpu?: string
    sequencer?: string
  }
  config: {
    sizes: number[]
    batch: number
    time: number
    implementations: string[]
    operations: string[]
  }
  complete: boolean
  results: BenchmarkRow[]
}
export function modelOf(file: string): Model | undefined {
  return /(?:^|\/)(?:test|benchmark)\/(array|map|text)(?:\/|$)/.exec(
    file.replaceAll('\\', '/')
  )?.[1] as Model | undefined
}
export function environment() {
  return { node: process.version, platform: platform(), arch: arch() }
}
export function readJson<T>(file: string): T | undefined {
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as T)
    : undefined
}
export function writeJson(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}
export function testPath(model: Model, root = repository) {
  return resolve(root, 'test/.results', model + '.json')
}
export function benchmarkPath(model: Model, root = repository) {
  return resolve(root, 'benchmark/.results', model + '.json')
}
export function saveTests(
  model: Model,
  patch: TestReport,
  root = repository
): void {
  const file = testPath(model, root)
  const previous = readJson<TestReport>(file) ?? {}
  writeJson(file, {
    ...previous,
    ...patch,
    compatibility: { ...previous.compatibility, ...patch.compatibility },
  })
}
function cell(value: unknown): string {
  return String(value).replaceAll('|', '&#124;').replaceAll('\n', ' ')
}
function table(
  headings: string[],
  rows: unknown[][],
  right: number[] = []
): string {
  return [
    '| ' + headings.map(cell).join(' | ') + ' |',
    '| ' +
      headings
        .map((_, index) => (right.includes(index) ? '---:' : '---'))
        .join(' | ') +
      ' |',
    ...rows.map((row) => '| ' + row.map(cell).join(' | ') + ' |'),
  ].join('\n')
}
const integer = (value: number) => Math.round(value).toLocaleString('en-US')
const code = (value: string) =>
  String.fromCharCode(96) + value + String.fromCharCode(96)
function host(value: UnitRun['environment']): string {
  return 'Node ' + value.node + '; ' + value.platform + ' ' + value.arch
}
export function renderBenchmarks(report?: BenchmarkReport): string {
  if (!report) return 'No benchmark run has been recorded.'
  const lines = [
    'Latest run: ' +
      report.generatedAt +
      '. Status: **' +
      (report.status ?? (report.complete ? 'passed' : 'incomplete')) +
      '**.',
    '',
    host(report.environment) +
      (report.environment.cpu ? '; ' + report.environment.cpu : '') +
      '.',
    'Sequencer ' + (report.environment.sequencer ?? 'not recorded') + '.',
    '',
    'Throughput is measured in **ops/sec per API call**. Iterators are consumed completely. Fixture setup, validation and cleanup are outside timing.',
    'Batch: ' +
      report.config.batch +
      '; measurement budget: ' +
      report.config.time +
      ' ms per variant/case. Measured selection: ' +
      (report.complete ? 'complete' : 'incomplete') +
      '.',
  ]
  if (!report.results.length) lines.push('', 'No measurements were produced.')
  if (report.results.length) {
    lines.push(
      '',
      table(
        ['Operation', ...report.config.sizes.map(integer)],
        report.config.operations.map((operation) => [
          code(operation),
          ...report.config.sizes.map((size) => {
            const row = report.results.find(
              (row) =>
                row.size === size &&
                row.operation === operation &&
                row.implementation === 'wrapper+listeners'
            )
            return row &&
              Number.isFinite(row.callsPerSecond) &&
              row.callsPerSecond > 0
              ? integer(row.callsPerSecond)
              : '—'
          }),
        ]),
        report.config.sizes.map((_, index) => index + 1)
      )
    )
  }
  lines.push(
    '',
    '— means unmeasured or no equivalent API. RME, sample counts and full metadata are saved locally in ' +
      code('benchmark/.results/') +
      '.'
  )
  return lines.join('\n')
}
export function renderTests(report?: TestReport): string {
  const lines: string[] = []
  const unit = report?.vitest
  if (unit) {
    lines.push(
      'Latest Vitest run: ' +
        unit.generatedAt +
        '. Status: **' +
        unit.status +
        '**.',
      host(unit.environment) +
        '. ' +
        unit.files.length +
        ' test files; ' +
        unit.passed +
        ' passed, ' +
        unit.failed +
        ' failed, ' +
        unit.skipped +
        ' skipped.',
      ...(unit.filter ? ['Test-name filter: ' + code(unit.filter) + '.'] : []),
      ...(unit.errors ? ['Runner/module errors: ' + unit.errors + '.'] : []),
      '',
      table(
        ['Test suite', 'Passed', 'Failed', 'Skipped', 'Status', 'Duration (s)'],
        unit.files.map((file) => [
          '[' +
            file.file.replace(/^test\/[^/]+\//, '').replace(/\/test\.ts$/, '') +
            '](' +
            file.file +
            ')',
          file.passed,
          file.failed,
          file.skipped,
          file.status,
          (file.duration / 1000).toFixed(2),
        ]),
        [1, 2, 3, 5]
      ),
      ''
    )
    if (unit.coverage)
      lines.push(
        table(
          metrics.map((metric) => metric[0].toUpperCase() + metric.slice(1)),
          [
            metrics.map(
              (metric) =>
                unit.coverage![metric].pct.toFixed(2).replace(/\.00$/, '') + '%'
            ),
          ],
          [0, 1, 2, 3]
        )
      )
    else lines.push('Coverage was not collected in this run.')
  } else lines.push('No Vitest run has been recorded.')
  lines.push('', '#### Compatibility', '')
  const browsers = report?.compatibility ?? {}
  lines.push(
    table(
      [
        'Runtime',
        'Version',
        'Status',
        'Passed',
        'Failed',
        'Skipped',
        'Checked (UTC)',
      ],
      [
        [
          'Node.js (Vitest source tests)',
          unit?.environment.node ?? '—',
          unit?.status ?? 'not run',
          unit?.passed ?? '—',
          unit?.failed ?? '—',
          unit?.skipped ?? '—',
          unit?.generatedAt ?? '—',
        ],
        ...['chromium', 'firefox', 'webkit'].map((runtime) => {
          const result = browsers[runtime]
          return [
            {
              chromium: 'Chromium browser window',
              firefox: 'Firefox browser window',
              webkit: 'WebKit browser window',
            }[runtime],
            result?.version ?? '—',
            result?.status ?? 'not run',
            result?.passed ?? '—',
            result?.failed ?? '—',
            result?.skipped ?? '—',
            result?.generatedAt ?? '—',
          ]
        }),
      ],
      [3, 4, 5]
    )
  )
  lines.push(
    '',
    'Only executed runtimes are marked as verified. Browser checks import the built ESM package and test editing, events and replication. Counts describe the latest selection; other model sections retain their own latest run.'
  )
  return lines.join('\n')
}
export function replaceBlock(source: string, id: string, body: string): string {
  const begin = '<!-- BEGIN GENERATED:' + id + ' -->'
  const end = '<!-- END GENERATED:' + id + ' -->'
  const start = source.indexOf(begin)
  const stop = source.indexOf(end, start + begin.length)
  if (start < 0 || stop < 0)
    throw new Error('Missing README report block: ' + id)
  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  return (
    source.slice(0, start + begin.length) +
    newline +
    newline +
    body.replaceAll('\n', newline) +
    newline +
    newline +
    source.slice(stop)
  )
}
export async function updateReadme(root = repository): Promise<void> {
  const file = resolve(root, 'README.md')
  const options = { ...(await resolveConfig(file)), filepath: file }
  const blocks: Array<[string, string]> = []
  for (const model of models) {
    blocks.push([
      model + ':benchmarks',
      (
        await format(
          renderBenchmarks(readJson(benchmarkPath(model, root))),
          options
        )
      ).trimEnd(),
    ])
    blocks.push([
      model + ':tests',
      (
        await format(renderTests(readJson(testPath(model, root))), options)
      ).trimEnd(),
    ])
  }
  const original = readFileSync(file, 'utf8')
  let source = original
  for (const [id, body] of blocks) source = replaceBlock(source, id, body)
  if (source !== original) writeFileSync(file, source)
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await updateReadme()
}
