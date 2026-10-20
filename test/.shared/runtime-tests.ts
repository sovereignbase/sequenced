import { afterAll, expect, it } from 'vitest'
import { runtimes } from './runtimes.ts'
import { saveTests, updateReadme } from '../../scripts/reporting.ts'
import type { Model } from './portable.ts'

export function runtimeTests(model: Model): void {
  for (const [name, run] of Object.entries(runtimes)) {
    it(name, async () => {
      const started = Date.now()
      let result: Awaited<ReturnType<typeof run>> | undefined
      let failure: unknown
      try {
        result = await run()
      } catch (error) {
        failure = error
      }
      const outcomes =
        result?.outcomes.filter((outcome) => outcome.model === model) ?? []
      const failed = Boolean(
        failure || !outcomes.length || outcomes.some((outcome) => outcome.error)
      )
      saveTests(model, {
        compatibility: {
          [name]: {
            generatedAt: new Date().toISOString(),
            version: result?.version,
            status: failed ? 'failed' : 'passed',
            passed: failed ? 0 : 1,
            failed: failed ? 1 : 0,
            skipped: 0,
            duration: Date.now() - started,
          },
        },
      })
      if (failure) throw failure
      expect(outcomes).toHaveLength(3)
      expect(outcomes.filter((outcome) => outcome.error)).toEqual([])
    })
  }
  afterAll(() => updateReadme())
}
