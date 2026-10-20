import { expect, test } from '@playwright/test'

test('Map methods, JSON keys and replication events work in a browser', async ({
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
    const maps = [new Sequenced.Map(1), new Sequenced.Map(2)]
    maps.forEach((map) => map.apply([[1], [2]]))
    maps[0].addEventListener('delta', ({ detail }: CustomEvent<unknown>) =>
      maps[1].apply(detail)
    )
    maps[1].addEventListener('delta', ({ detail }: CustomEvent<unknown>) =>
      maps[0].apply(detail)
    )
    try {
      maps[0].set(1, 'number').set('1', 'string').set('', false)
      maps[0].set(1, 'updated')
      const deleted = maps[0].delete('1')
      const restored = new Sequenced.Map(1, JSON.parse(JSON.stringify(maps[0])))
      try {
        return {
          entries: [...maps[1]],
          size: maps[1].size,
          deleted,
          restored: [...restored],
        }
      } finally {
        restored.destroy()
      }
    } finally {
      maps.forEach((map) => map.destroy())
    }
  })
  expect(result).toEqual({
    entries: [
      [1, 'updated'],
      ['', false],
    ],
    size: 2,
    deleted: true,
    restored: [
      [1, 'updated'],
      ['', false],
    ],
  })
})
