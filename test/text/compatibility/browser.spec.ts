import { expect, test } from '@playwright/test'

test('Text editing and change-driven rendering work in a browser', async ({
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
    const alice = new Sequenced.Text(1)
    const bob = new Sequenced.Text(2)
    alice.apply([[1], [2]])
    bob.apply([[1], [2]])
    let rendered = ''
    bob.addEventListener(
      'change',
      ({
        detail,
      }: CustomEvent<ReadonlyArray<readonly [number, number, string?]>>) => {
        for (const [start, end, inserted = ''] of detail)
          rendered = rendered.slice(0, start) + inserted + rendered.slice(end)
      }
    )
    alice.addEventListener('delta', ({ detail }: CustomEvent<unknown>) =>
      bob.apply(detail)
    )
    bob.addEventListener('delta', ({ detail }: CustomEvent<unknown>) =>
      alice.apply(detail)
    )
    alice.insert(0, 'Hello 😀')
    alice.replace(0, 5, 'Hei')
    alice.remove(3, 4)
    return { value: String(bob), length: bob.length, rendered, units: [...bob] }
  })
  expect(result).toEqual({
    value: 'Hei😀',
    length: 5,
    rendered: 'Hei😀',
    units: 'Hei😀'.split(''),
  })
})
