import { test } from '@playwright/test'
import { runEditors } from '../../.shared/editors.ts'
test.setTimeout(60_000)
for (const transport of ['p2p', 'ws'] as const)
  test(transport, ({ browser }) => runEditors(browser, 'array', transport))
