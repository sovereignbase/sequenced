import type { Reporter } from 'vitest/node'
import {
  benchmarkPath,
  environment,
  metrics,
  modelOf,
  readJson,
  saveTests,
  updateReadme,
  writeJson,
  renderBenchmarks,
  repository,
} from './reporting.ts'
import type {
  BenchmarkReport,
  Counts,
  Coverage,
  Model,
  TestFile,
} from './reporting.ts'
import { writeFileSync } from 'node:fs'

interface CoverageMap {
  files(): string[]
  fileCoverageFor(file: string): { toSummary(): Coverage }
}
export default class ReadmeReporter implements Reporter {
  private readonly root: string
  constructor(options: { root?: string } = {}) {
    this.root = options.root ?? repository
  }
  private started = 0
  private selected = new Map<Model, boolean>()
  private coverage?: CoverageMap
  private filter?: string

  onInit: NonNullable<Reporter['onInit']> = (vitest) => {
    this.filter = vitest.config.testNamePattern?.toString()
  }
  onTestRunStart: NonNullable<Reporter['onTestRunStart']> = (
    specifications
  ) => {
    this.started = Date.now()
    this.coverage = undefined
    this.selected.clear()
    for (const specification of specifications) {
      const model = modelOf(specification.moduleId)
      if (model)
        this.selected.set(
          model,
          specification.moduleId.replaceAll('\\', '/').includes('/benchmark/')
        )
    }
  }
  onCoverage(coverage: unknown): void {
    this.coverage = coverage as CoverageMap
  }
  private modelCoverage(model: Model): Coverage | undefined {
    if (!this.coverage) return
    const files = this.coverage
      .files()
      .filter((file) =>
        file
          .replaceAll('\\', '/')
          .includes(
            '/src/Sequenced' + model[0].toUpperCase() + model.slice(1) + '/'
          )
      )
    if (!files.length) return
    const result = Object.fromEntries(
      metrics.map((metric) => [metric, { total: 0, covered: 0, pct: 100 }])
    ) as Coverage
    for (const file of files) {
      const summary = this.coverage.fileCoverageFor(file).toSummary()
      for (const metric of metrics) {
        result[metric].total += summary[metric].total
        result[metric].covered += summary[metric].covered
      }
    }
    for (const metric of metrics) {
      const value = result[metric]
      value.pct = value.total
        ? Math.floor((10000 * value.covered) / value.total) / 100
        : 100
    }
    return result
  }
  onTestRunEnd: NonNullable<Reporter['onTestRunEnd']> = async (
    modules,
    errors,
    reason
  ) => {
    let changed = false
    for (const [model, benchmark] of this.selected) {
      const selected = modules.filter(
        (module) => modelOf(module.moduleId) === model
      )
      const status =
        reason === 'interrupted'
          ? reason
          : reason === 'failed' ||
              errors.length ||
              !selected.length ||
              selected.some((module) => !module.ok())
            ? 'failed'
            : 'passed'
      if (benchmark) {
        const path = benchmarkPath(model, this.root)
        const current = readJson<BenchmarkReport>(path)
        const report: BenchmarkReport =
          current && Date.parse(current.generatedAt) >= this.started
            ? current
            : {
                generatedAt: new Date().toISOString(),
                environment: environment(),
                config: {
                  sizes: [],
                  batch: 0,
                  time: 0,
                  implementations: [],
                  operations: [],
                },
                complete: false,
                results: [],
              }
        report.status = status
        report.complete =
          status === 'passed' && report.complete && report.results.length > 0
        writeJson(path, report)
        writeFileSync(
          path.replace(/\.json$/, '.md'),
          '# Sequenced' +
            model[0].toUpperCase() +
            model.slice(1) +
            ' benchmark\n\n' +
            renderBenchmarks(report) +
            '\n'
        )
      } else {
        const files: TestFile[] = selected
          .map((module) => {
            const counts: Counts = { passed: 0, failed: 0, skipped: 0 }
            for (const test of module.children.allTests()) {
              const state = test.result().state
              if (state === 'passed') counts.passed++
              else if (state === 'failed') counts.failed++
              else counts.skipped++
            }
            return {
              file: module.relativeModuleId.replaceAll('\\', '/'),
              ...counts,
              duration: module.diagnostic().duration,
              status: module.state(),
            }
          })
          .sort((left, right) => left.file.localeCompare(right.file))
        const counts = files.reduce(
          (sum, file) => ({
            passed: sum.passed + file.passed,
            failed: sum.failed + file.failed,
            skipped: sum.skipped + file.skipped,
          }),
          { passed: 0, failed: 0, skipped: 0 }
        )
        saveTests(
          model,
          {
            vitest: {
              ...counts,
              files,
              status,
              generatedAt: new Date().toISOString(),
              environment: environment(),
              coverage: this.modelCoverage(model),
              filter: this.filter,
              errors:
                errors.length +
                selected.reduce(
                  (sum, module) => sum + module.errors().length,
                  0
                ),
            },
          },
          this.root
        )
      }
      changed = true
    }
    if (changed) await updateReadme(this.root)
  }
}
