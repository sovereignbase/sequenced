import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import type { TestModule } from 'vitest/node'
import Reporter from '../../scripts/vitest-reporter.ts'
import BrowserReporter from '../../scripts/playwright-reporter.ts'
import {
  benchmarkPath,
  metrics,
  models,
  readJson,
  renderBenchmarks,
  renderTests,
  replaceBlock,
  saveTests,
  testPath,
  updateReadme,
  writeJson,
} from '../../scripts/reporting.ts'
import type {
  BenchmarkReport,
  Coverage,
  TestReport,
  UnitRun,
} from '../../scripts/reporting.ts'

const temporary: string[] = []
afterEach(() => {
  for (const path of temporary.splice(0)) {
    if (
      dirname(path) !== resolve(tmpdir()) ||
      !path.startsWith(join(tmpdir(), 'sequenced-reports-'))
    )
      throw new Error('Refusing to remove an unexpected temporary directory')
    rmSync(path, { recursive: true, force: true })
  }
})
function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'sequenced-reports-'))
  temporary.push(root)
  writeFileSync(
    join(root, 'README.md'),
    [
      '# Manual title',
      '',
      'Keep this manual introduction.',
      '  Preserve   this spacing and wrapping.',
      '',
      ...models.flatMap((model) => [
        '## ' + model,
        '',
        'Manual usage for ' + model + '.',
        '',
        ...['benchmarks', 'tests'].flatMap((kind) => [
          '<!-- BEGIN GENERATED:' + model + ':' + kind + ' -->',
          '',
          'Old generated text.',
          '',
          '<!-- END GENERATED:' + model + ':' + kind + ' -->',
          '',
        ]),
      ]),
      '## License',
      '',
      'Keep this manual ending.',
      '',
    ].join('\n')
  )
  return root
}
const coverage = Object.fromEntries(
  metrics.map((metric) => [metric, { total: 10, covered: 10, pct: 100 }])
) as Coverage
function unit(overrides: Partial<UnitRun> = {}): UnitRun {
  return {
    generatedAt: '2026-10-20T10:00:00.000Z',
    status: 'passed',
    passed: 2,
    failed: 0,
    skipped: 0,
    errors: 0,
    environment: { node: 'v24.0.0', platform: 'win32', arch: 'x64' },
    files: [
      {
        file: 'test/array/events/test.ts',
        passed: 2,
        failed: 0,
        skipped: 0,
        duration: 12,
        status: 'passed',
      },
    ],
    ...overrides,
  }
}
function benchmark(): BenchmarkReport {
  return {
    generatedAt: '2000-01-01T00:00:00.000Z',
    status: 'passed',
    complete: true,
    environment: {
      node: 'v24.0.0',
      platform: 'win32',
      arch: 'x64',
      cpu: 'test CPU',
      sequencer: '1.0.2',
    },
    config: {
      sizes: [100, 1000],
      batch: 32,
      time: 20,
      operations: ['get.random'],
      implementations: ['plain', 'wrapper', 'wrapper+listeners'],
    },
    results: [
      {
        size: 100,
        operation: 'get.random',
        implementation: 'plain',
        callsPerSecond: 32000,
        meanNanosecondsPerCall: 31250,
        relativeMarginOfErrorPercent: 1,
        samples: 100,
      },
      {
        size: 100,
        operation: 'get.random',
        implementation: 'wrapper',
        callsPerSecond: 16000,
        meanNanosecondsPerCall: 62500,
        relativeMarginOfErrorPercent: 2,
        samples: 100,
      },
      {
        size: 100,
        operation: 'get.random',
        implementation: 'wrapper+listeners',
        callsPerSecond: 8000,
        meanNanosecondsPerCall: 125000,
        relativeMarginOfErrorPercent: 3,
        samples: 100,
      },
    ],
  }
}
it('renders one listeners throughput table with a column per size and missing measurements left blank', () => {
  const text = renderBenchmarks(benchmark())
  expect(text).toContain('| Operation | 100 | 1,000 |')
  expect(text).toContain('| `get.random` | 8,000 | — |')
  expect(text.match(/\| Operation \|/g)).toHaveLength(1)
  expect(text).not.toContain('32,000')
  expect(text).not.toContain('16,000')
  expect(text).not.toMatch(/wrapper|listeners/i)
  expect(text).toContain('ops/sec per API call')
})
it('updates generated blocks and preserves other models, browser records and manual usage', async () => {
  const root = workspace()
  saveTests('array', { vitest: unit({ coverage }) }, root)
  saveTests('map', { vitest: unit({ passed: 9 }) }, root)
  await updateReadme(root)
  const mapBefore = readFileSync(join(root, 'README.md'), 'utf8')
    .split('## map')[1]
    .split('## text')[0]
  saveTests(
    'array',
    {
      compatibility: {
        chromium: {
          generatedAt: '2026-10-20T11:00:00.000Z',
          status: 'passed',
          version: '100',
          passed: 1,
          failed: 0,
          skipped: 0,
          duration: 10,
        },
      },
    },
    root
  )
  saveTests(
    'array',
    { vitest: unit({ status: 'failed', failed: 1, coverage: undefined }) },
    root
  )
  await updateReadme(root)
  const text = readFileSync(join(root, 'README.md'), 'utf8')
  expect(text).toContain('Keep this manual introduction.')
  expect(text).toContain(
    'Keep this manual introduction.\n  Preserve   this spacing and wrapping.'
  )
  expect(text).toContain('Manual usage for array.')
  expect(text).toContain('Keep this manual ending.')
  expect(text).toContain('**failed**')
  expect(text).toContain('Coverage was not collected in this run.')
  expect(text).not.toContain('100%')
  expect(text.split('## map')[1].split('## text')[0]).toBe(mapBefore)
  const data = readJson<TestReport>(testPath('array', root))!
  expect(data.compatibility!.chromium.status).toBe('passed')
  expect(data.vitest!.coverage).toBeUndefined()
  expect(text).toMatch(/Firefox browser window\s*\|[^|\n]*—[^|\n]*\|\s*not run/)
  await updateReadme(root)
  expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe(text)
})
it('refuses to replace missing generated markers and escapes table cells', () => {
  expect(() => replaceBlock('manual text', 'array:tests', 'result')).toThrow(
    'Missing README report block'
  )
  const text = renderTests({
    vitest: unit({
      files: [
        {
          file: 'test/array/a|b/test.ts',
          passed: 1,
          failed: 0,
          skipped: 0,
          duration: 10,
          status: 'passed',
        },
      ],
    }),
  })
  expect(text).toContain('a&#124;b')
})
function module(
  root: string,
  states: ('passed' | 'failed' | 'skipped')[]
): TestModule {
  return {
    moduleId: join(root, 'test/array/events/test.ts'),
    relativeModuleId: 'test/array/events/test.ts',
    ok: () => !states.includes('failed'),
    state: () => (states.includes('failed') ? 'failed' : 'passed'),
    errors: () => [],
    diagnostic: () => ({ duration: 10 }),
    children: {
      *allTests() {
        for (const state of states) yield { result: () => ({ state }) }
      },
    },
  } as unknown as TestModule
}
it('records failed and skipped tests, then clears coverage for a later run without coverage', async () => {
  const root = workspace()
  const reporter = new Reporter({ root })
  const file = module(root, ['passed', 'failed', 'skipped'])
  reporter.onTestRunStart([{ moduleId: file.moduleId }] as never)
  reporter.onCoverage({
    files: () => [join(root, 'src/SequencedArray/class.ts')],
    fileCoverageFor: () => ({ toSummary: () => coverage }),
  })
  await reporter.onTestRunEnd([file], [], 'failed')
  expect(readJson<TestReport>(testPath('array', root))!.vitest).toMatchObject({
    passed: 1,
    failed: 1,
    skipped: 1,
    status: 'failed',
    coverage,
  })
  reporter.onTestRunStart([{ moduleId: file.moduleId }] as never)
  await reporter.onTestRunEnd([module(root, ['passed'])], [], 'passed')
  expect(
    readJson<TestReport>(testPath('array', root))!.vitest!.coverage
  ).toBeUndefined()
  await reporter.onTestRunEnd([module(root, ['passed'])], [], 'failed')
  expect(readJson<TestReport>(testPath('array', root))!.vitest!.status).toBe(
    'failed'
  )
})
it('does not publish stale benchmark measurements after a failed run', async () => {
  const root = workspace()
  writeJson(benchmarkPath('map', root), benchmark())
  const reporter = new Reporter({ root })
  reporter.onTestRunStart([
    { moduleId: join(root, 'benchmark/map/map.bench.ts') },
  ] as never)
  await reporter.onTestRunEnd(
    [],
    [{ message: 'failed import' }] as never,
    'failed'
  )
  const result = readJson<BenchmarkReport>(benchmarkPath('map', root))!
  expect(result.status).toBe('failed')
  expect(result.complete).toBe(false)
  expect(result.results).toEqual([])
  expect(readFileSync(join(root, 'README.md'), 'utf8')).not.toContain('8,000')
})
it('records browser failures without erasing earlier Node or other browser results', async () => {
  const root = workspace()
  saveTests(
    'array',
    {
      vitest: unit(),
      compatibility: {
        chromium: {
          generatedAt: '2026-10-20T10:00:00.000Z',
          status: 'passed',
          version: '100',
          passed: 1,
          failed: 0,
          skipped: 0,
          duration: 1,
        },
      },
    },
    root
  )
  const reporter = new BrowserReporter({ root })
  reporter.onBegin(undefined, {
    allTests: () => [
      {
        location: {
          file: join(root, 'test/array/compatibility/browser.spec.ts'),
        },
        parent: { project: () => ({ use: { browserName: 'firefox' } }) },
        results: [
          {
            status: 'failed',
            duration: 50,
            annotations: [{ type: 'browser-version', description: '99' }],
          },
        ],
        outcome: () => 'unexpected',
      },
    ],
  } as never)
  await reporter.onEnd({
    status: 'failed',
    startTime: new Date(),
    duration: 50,
  })
  const data = readJson<TestReport>(testPath('array', root))!
  expect(data.vitest!.passed).toBe(2)
  expect(data.compatibility!.chromium.status).toBe('passed')
  expect(data.compatibility!.firefox).toMatchObject({
    status: 'failed',
    failed: 1,
    version: '99',
  })
})
