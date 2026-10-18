import { Worker } from 'node:worker_threads'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const variants = [
  { name: 'live-compact', mode: 'live', peers: 2, compact: true, hydrate: false },
  { name: 'live-hydrate', mode: 'live', peers: 2, compact: false, hydrate: true },
  { name: 'offline-ordered', mode: 'apply', peers: 3, order: 'ordered', compact: false },
  { name: 'offline-shuffled', mode: 'apply', peers: 3, order: 'shuffle', compact: false },
  { name: 'offline-reversed', mode: 'apply', peers: 5, order: 'reverse', compact: false },
  { name: 'offline-hydrate', mode: 'apply', peers: 3, order: 'shuffle', compact: false, hydrate: true },
  { name: 'merge-three', mode: 'merge', peers: 3, order: 'shuffle', compact: false },
  { name: 'merge-five', mode: 'merge', peers: 5, order: 'reverse', compact: true },
]

export function runCase(config) {
  return new Promise((resolveCase) => {
    const worker = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: config })
    let done = false
    const finish = (result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      void worker.terminate()
      resolveCase(result)
    }
    const timer = setTimeout(() => finish({ config, checks: 0, failures: [{ category: 'timeout', message: '5000 ms' }] }), 5000)
    worker.once('message', finish)
    worker.once('error', (error) => finish({ config, checks: 0, failures: [{ category: 'worker-error', message: error.message }] }))
    worker.once('exit', (code) => { if (!done) finish({ config, checks: 0, failures: [{ category: 'worker-exit', code }] }) })
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1] }
  const only = option('--variant')
  const onlySeed = option('--seed')
  const seeds = Number(option('--seeds', '128'))
  const configs = (only ? variants.filter((v) => v.name === only) : variants)
    .flatMap((variant) => Array.from({ length: onlySeed ? 1 : seeds }, (_, i) => ({ ...variant, seed: onlySeed ? Number(onlySeed) : i + 1 })))
  const results = []
  let cursor = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < configs.length) {
      const config = configs[cursor++]
      results.push(await runCase(config))
      if (results.length % 128 === 0) console.log(`Completed ${results.length}/${configs.length} histories`)
    }
  }))
  results.sort((a, b) => a.config.name.localeCompare(b.config.name) || a.config.seed - b.config.seed)
  const grouped = {}
  for (const result of results) for (const failure of result.failures) {
    const group = grouped[failure.category] ??= { cases: 0, first: { config: result.config, failure, intents: result.intents } }
    group.cases++
  }
  const report = {
    node: process.version, generatedAt: new Date().toISOString(),
    cases: results.length, failedCases: results.filter((r) => r.failures.length).length,
    checks: results.reduce((sum, r) => sum + r.checks, 0), grouped, results,
  }
  const directory = resolve('benchmark/.results')
  mkdirSync(directory, { recursive: true })
  const output = resolve(directory, option('--output', 'sequencer-audit.json'))
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ cases: report.cases, failedCases: report.failedCases, checks: report.checks, categories: Object.fromEntries(Object.entries(grouped).map(([name, group]) => [name, group.cases])), output }, null, 2))
  process.exitCode = report.failedCases ? 1 : 0
}
