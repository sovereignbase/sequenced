import type { Reporter, Suite, FullResult } from '@playwright/test/reporter'
import { modelOf, saveTests, updateReadme, repository } from './reporting.ts'
import type { Model, RuntimeRun } from './reporting.ts'

export default class ReadmeReporter implements Reporter {
  private readonly root: string
  constructor(options: { root?: string } = {}) {
    this.root = options.root ?? repository
  }
  private suite?: Suite
  onBegin(_config: unknown, suite: Suite): void {
    this.suite = suite
  }
  async onEnd(result: FullResult): Promise<void> {
    const reports = new Map<Model, Record<string, RuntimeRun>>()
    for (const test of this.suite?.allTests() ?? []) {
      const model = modelOf(test.location.file)
      if (!model) continue
      const runtime = test.parent.project()?.use.browserName
      if (!runtime) continue
      let runtimes = reports.get(model)
      if (!runtimes) reports.set(model, (runtimes = {}))
      const summary = (runtimes[runtime] ??= {
        generatedAt: new Date().toISOString(),
        status: 'passed',
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
      })
      const last = test.results.at(-1)
      const version = last?.annotations.find(
        (annotation) => annotation.type === 'browser-version'
      )?.description
      if (version) summary.version = version
      summary.duration += last?.duration ?? 0
      if (last?.status === 'passed') summary.passed++
      else if (!last || last.status === 'skipped') summary.skipped++
      else summary.failed++
      if (summary.failed) summary.status = 'failed'
      else if (test.outcome() === 'flaky') summary.status = 'flaky'
      else if (summary.skipped && !summary.passed) summary.status = 'skipped'
      if (result.status === 'interrupted') summary.status = 'interrupted'
    }
    for (const [model, compatibility] of reports)
      saveTests(model, { compatibility }, this.root)
    if (reports.size) await updateReadme(this.root)
  }
}
