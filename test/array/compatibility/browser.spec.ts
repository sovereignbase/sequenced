import { checkBrowser } from '../../.shared/portable-browser.ts'
import { expect, test } from '@playwright/test'

test('Array methods and typed events work in a browser', async ({
  page,
  browser,
}, testInfo) => {
  testInfo.annotations.push({
    type: 'browser-version',
    description: browser.version(),
  })
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { Sequenced } = await import(
      new URL('/dist/index.js', location.href).href
    )
    const alice = new Sequenced.Array(1)
    const bob = new Sequenced.Array(2)
    alice.addEventListener('delta', ({ detail }: CustomEvent<unknown>) =>
      bob.apply(detail)
    )
    bob.addEventListener('delta', ({ detail }: CustomEvent<unknown>) =>
      alice.apply(detail)
    )
    try {
      const length = alice.push(1, 2, 3)
      const removed = alice.splice(1, 1, 20)
      return {
        length,
        removed,
        values: [...bob],
        mapped: bob.map((value: number) => value * 2),
        reversed: bob.toReversed(),
      }
    } finally {
      alice.destroy()
      bob.destroy()
    }
  })
  expect(result).toEqual({
    length: 3,
    removed: [2],
    values: [1, 20, 3],
    mapped: [2, 40, 6],
    reversed: [3, 20, 1],
  })
  await checkBrowser(page, 'array')
})
