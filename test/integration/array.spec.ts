import { test } from '@playwright/test'
import { runEditors } from '../.shared/editors.ts'
for (const transport of ['p2p', 'ws'] as const)
  test(transport, ({ browser }) => runEditors(browser, 'array', transport))
