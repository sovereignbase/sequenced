import { readFileSync, writeFileSync } from 'node:fs'
import { runCase } from './run.mjs'

const report = JSON.parse(readFileSync('benchmark/.results/sequencer-audit-deterministic.json', 'utf8'))
const targets = [
  'consumer-splices', 'visible-model', 'local-values', 'local-indexed',
  'indexed-values', 'range-values', 'length-values', 'snapshot-json', 'convergence', 'exception',
]
const minimized = []
let cursor = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < targets.length) {
    const category = targets[cursor++]
    const candidates = report.results.filter((r) => r.failures.some((f) => f.category === category))
    // Prefer a direct symptom without an earlier unrelated exception.
    const rank = (result) => result.failures.find((f) => f.category === category)?.step ?? 1_000
    candidates.sort((a, b) => rank(a) - rank(b) || a.failures.length - b.failures.length)
    const original = candidates[0]
    if (!original) continue
    const { intents: originalIntents, ...config } = { ...original.config, intents: original.intents }
    const cache = new Map()
    let evaluations = 0
    const test = async (intents) => {
      const key = intents.map((intent) => intent.id).join(',')
      if (cache.has(key)) return cache.get(key)
      const result = await runCase({ ...config, intents })
      evaluations++
      cache.set(key, result)
      return result
    }
    const firstFailure = original.failures.find((f) => f.category === category)
    let intents = firstFailure.step === undefined ? originalIntents
      : originalIntents.filter((intent) => intent.id <= firstFailure.step)
    let result = await test(intents)
    if (!result.failures.some((f) => f.category === category)) {
      minimized.push({ category, unstable: true, config, result })
      continue
    }
    let granularity = 2
    while (intents.length > 1 && evaluations < 250) {
      const width = Math.ceil(intents.length / granularity)
      let reduced = false
      for (let at = 0; at < intents.length; at += width) {
        const candidate = [...intents.slice(0, at), ...intents.slice(at + width)]
        if (!candidate.length) continue
        const attempt = await test(candidate)
        if (attempt.failures.some((f) => f.category === category)) {
          intents = candidate
          result = attempt
          granularity = Math.max(2, granularity - 1)
          reduced = true
          break
        }
      }
      if (!reduced) {
        if (granularity >= intents.length) break
        granularity = Math.min(intents.length, granularity * 2)
      }
    }
    const repeats = []
    for (let repeat = 0; repeat < 3; repeat++) {
      const run = await runCase({ ...config, intents })
      repeats.push(run.failures.map((f) => f.category))
    }
    minimized.push({ category, evaluations, config, intents, failures: result.failures, repeats })
    console.log(`${category}: ${originalIntents.length} -> ${intents.length} operations (${evaluations} evaluations)`)
    writeFileSync('benchmark/.results/sequencer-audit-minimized.json', JSON.stringify(minimized, null, 2) + '\n')
  }
}))
writeFileSync('benchmark/.results/sequencer-audit-minimized.json', JSON.stringify(minimized, null, 2) + '\n')
