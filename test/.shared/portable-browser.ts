import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Model, Outcome } from './portable.ts'
import { runtimeBundle } from './runtimes.ts'

export async function checkBrowser(page: Page, model: Model): Promise<void> {
  await page.addScriptTag({ content: await runtimeBundle() })
  const outcomes = await page.evaluate((model) => {
    const runtime = globalThis as unknown as {
      Compatibility: { runSuite(): Outcome[] }
    }
    return runtime.Compatibility.runSuite().filter(
      (outcome) => outcome.model === model
    )
  }, model)
  expect(outcomes).toHaveLength(3)
  expect(outcomes.filter((outcome) => outcome.error)).toEqual([])
}
