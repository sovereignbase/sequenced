import { createRequire } from 'node:module'
import { runSuite } from './portable.ts'

const commonjs = process.argv[2] === 'cjs'
const library = commonjs
  ? createRequire(import.meta.url)('../../dist/index.cjs')
  : undefined
console.log(
  JSON.stringify({
    version:
      (globalThis as any).Deno?.version.deno ??
      (globalThis as any).Bun?.version ??
      process.version,
    outcomes: library
      ? runSuite(library.Sequenced, library.SequencedError)
      : runSuite(),
  })
)
