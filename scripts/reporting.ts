import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { arch, platform } from 'node:os'
import { format, resolveConfig } from 'prettier'

export const models = ['array', 'map', 'text'] as const
export const suites = [
  'compability',
  'convergence',
  'equivelance',
  'events',
  'integration',
  'unit',
] as const
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
  integration?: Record<string, RuntimeRun>
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
  const path = file.replaceAll('\\', '/')
  return /(?:^|\/)(?:test|benchmark)\/(array|map|text)\//.exec(path)?.[1] as
    Model | undefined
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
    integration: { ...previous.integration, ...patch.integration },
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
  return 'Node ' + value.node + ' · ' + value.platform + ' ' + value.arch
}
export function renderBenchmarks(report?: BenchmarkReport): string {
  if (!report) return '—'
  const status = report.status ?? (report.complete ? 'passed' : 'incomplete')
  const lines = [
    report.generatedAt.slice(0, 10) +
      ' · ops/sec' +
      (status !== 'passed' || !report.complete
        ? ' · **' + (status === 'passed' ? 'incomplete' : status) + '**'
        : ''),
    '',
    host(report.environment) +
      (report.environment.cpu ? ' · ' + report.environment.cpu : '') +
      (report.environment.sequencer
        ? ' · Sequencer ' + report.environment.sequencer
        : ''),
  ]
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
  return lines.join('\n')
}
export function renderTests(report?: TestReport): string {
  const lines: string[] = []
  const unit = report?.vitest
  const groups = new Map<string, Counts>()
  const add = (suite: string, counts: Counts) => {
    const total = groups.get(suite) ?? { passed: 0, failed: 0, skipped: 0 }
    for (const key of ['passed', 'failed', 'skipped'] as const)
      total[key] += counts[key]
    groups.set(suite, total)
  }
  for (const file of unit?.files ?? []) {
    let suite = /(?:^|\/)test\/(?:array|map|text)\/([^/]+)\//.exec(
      file.file.replaceAll('\\', '/')
    )?.[1]
    if (
      suite === 'benchmark' ||
      suite === 'types' ||
      /\/equivelance\/types\//.test(file.file)
    )
      suite = 'unit'
    if (suite === 'compatibility') continue
    if (suite && suites.includes(suite as (typeof suites)[number]))
      add(suite, file)
  }
  for (const run of Object.values(report?.compatibility ?? {}))
    add('compability', run)
  for (const run of Object.values(report?.integration ?? {}))
    add('integration', run)
  if (unit) {
    lines.push(
      unit.generatedAt.slice(0, 10) + ' · **' + unit.status + '**',
      ...(unit.errors ? ['Errors: ' + unit.errors] : []),
      ''
    )
  }
  lines.push(
    '',
    table(
      ['Test suite', 'Passed', 'Failed', 'Skipped'],
      suites.map((suite) => {
        const counts = groups.get(suite)
        return [
          suite,
          counts?.passed ?? '—',
          counts?.failed ?? '—',
          counts?.skipped ?? '—',
        ]
      }),
      [1, 2, 3]
    ),
    ''
  )
  if (unit) {
    lines.push(
      table(
        metrics.map((metric) => metric[0].toUpperCase() + metric.slice(1)),
        [
          metrics.map((metric) =>
            unit.coverage
              ? unit.coverage[metric].pct.toFixed(2).replace(/\.00$/, '') + '%'
              : '—'
          ),
        ],
        [0, 1, 2, 3]
      )
    )
  }
  lines.push('', '#### Compatibility', '')
  const browsers = report?.compatibility ?? {}
  lines.push(
    table(
      ['Runtime', 'Version', 'Status'],
      [
        ...[
          'node.esm',
          'node.cjs',
          'bun',
          'deno',
          'edge',
          'workerd',
          'chromium',
          'firefox',
          'webkit',
        ].map((runtime) => {
          const result = browsers[runtime]
          return [
            {
              'node.esm': 'Node.js ESM',
              'node.cjs': 'Node.js CJS',
              bun: 'Bun',
              deno: 'Deno',
              edge: 'Edge Runtime',
              workerd: 'workerd',
              chromium: 'Chromium',
              firefox: 'Firefox',
              webkit: 'WebKit',
            }[runtime],
            result?.version ?? '—',
            result?.status ?? 'not run',
          ]
        }),
      ]
    )
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
