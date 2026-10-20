import { afterAll, expect, it } from 'vitest'
import { runtimes } from '../.shared/runtimes.ts'
import { models, saveTests, updateReadme } from '../../scripts/reporting.ts'

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
    for (const model of models) {
      const outcomes =
        result?.outcomes.filter((outcome) => outcome.model === model) ?? []
      saveTests(model, {
        compatibility: {
          [name]: {
            generatedAt: new Date().toISOString(),
            version: result?.version,
            status:
              failure ||
              !outcomes.length ||
              outcomes.some((outcome) => outcome.error)
                ? 'failed'
                : 'passed',
            passed: outcomes.filter((outcome) => !outcome.error).length,
            failed:
              failure || !outcomes.length
                ? 1
                : outcomes.filter((outcome) => outcome.error).length,
            skipped: 0,
            duration: Date.now() - started,
          },
        },
      })
    }
    if (failure) throw failure
    expect(result!.outcomes.length).toBeGreaterThan(0)
    expect(result!.outcomes.filter((outcome) => outcome.error)).toEqual([])
  })
}
afterAll(() => updateReadme())
