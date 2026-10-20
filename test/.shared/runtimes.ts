import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { mkdirSync, writeFileSync } from 'node:fs'
import { build } from 'tsdown'
import { EdgeRuntime } from 'edge-runtime'
import { Miniflare } from 'miniflare'
import type { Outcome } from './portable.ts'

export interface RuntimeResult {
  version: string
  outcomes: Outcome[]
}
const require = createRequire(import.meta.url)
const entry = fileURLToPath(new URL('./runtime-cli.ts', import.meta.url))
async function processRun(
  executable: string,
  args: string[]
): Promise<RuntimeResult> {
  const { stdout } = await promisify(execFile)(executable, args, {
    timeout: 45_000,
    windowsHide: true,
  })
  return JSON.parse(stdout)
}
let bundle: Promise<string> | undefined
export function runtimeBundle(): Promise<string> {
  return (bundle ??= build({
    config: false,
    entry: fileURLToPath(new URL('./portable.ts', import.meta.url)),
    deps: { alwaysBundle: ['@sovereignbase/sequencer'] },
    format: 'iife',
    globalName: 'Compatibility',
    platform: 'neutral',
    target: 'es2024',
    dts: false,
    write: false,
    clean: false,
    logLevel: 'silent',
  }).then((result) => {
    const chunk = result.bundles[0].chunks.find(
      (chunk) => chunk.type === 'chunk' && chunk.isEntry
    )
    if (!chunk || chunk.type !== 'chunk')
      throw new Error('Missing runtime bundle')
    return chunk.code
  }))
}
export const runtimes: Record<string, () => Promise<RuntimeResult>> = {
  'node.esm': () => processRun(process.execPath, [entry]),
  'node.cjs': () => processRun(process.execPath, [entry, 'cjs']),
  bun: () => {
    const manifest = require.resolve('bun/package.json')
    return processRun(resolve(dirname(manifest), require(manifest).bin.bun), [
      entry,
    ])
  },
  deno: () => {
    const map = fileURLToPath(
      new URL('../.results/deno-imports.json', import.meta.url)
    )
    mkdirSync(dirname(map), { recursive: true })
    writeFileSync(
      map,
      JSON.stringify({
        imports: {
          '@sovereignbase/sequencer': import.meta
            .resolve('@sovereignbase/sequencer'),
        },
      })
    )
    return processRun(process.execPath, [
      require.resolve('deno/bin.cjs'),
      'run',
      '--no-config',
      '--no-lock',
      '--import-map',
      map,
      entry,
    ])
  },
  edge: async () => ({
    version: require('edge-runtime/package.json').version,
    outcomes: new EdgeRuntime({ initialCode: await runtimeBundle() }).evaluate(
      'Compatibility.runSuite()'
    ),
  }),
  workerd: async () => {
    const runtime = new Miniflare({
      workers: [
        {
          config: {
            name: 'compability',
            compatibilityDate: '2026-10-06',
            manifest: {
              mainModule: 'worker.js',
              modules: {
                'worker.js': {
                  type: 'esm',
                  contents: `${await runtimeBundle()}\nexport default {fetch() {return Response.json(Compatibility.runSuite())}}`,
                },
              },
            },
          },
        },
      ],
    })
    try {
      const response = await runtime.dispatchFetch('http://localhost/')
      if (!response.ok) throw new Error(await response.text())
      return {
        version: require('workerd/package.json').version,
        outcomes: (await response.json()) as Outcome[],
      }
    } finally {
      await runtime.dispose()
    }
  },
}
