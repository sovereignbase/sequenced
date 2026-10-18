Tested with `@sovereignbase/sequencer@1.0.1` in Node 24 and Chromium.

| Contract | Expected | Observed |
| --- | --- | --- |
| `apply`/`merge` changes | Replaying returned splices equals `values()` | Wrong/missing values. Two-edit merge: replay gives `['e', undefined, 'root']`, state is `['d', 'e', 'root']`. |
| Indexed/range reads | `value(i)` and `values(a,b)` match bulk values | Duplicated, missing or shifted values after edits/delivery. |
| Synchronous edits and offline convergence | Replicas preserve edit positions and converge | Different element ordering, including with immediate delivery. |
| Length and snapshot roundtrip | Length, visible values and hydrated snapshot agree | E.g. length 6 with 3 bulk values; hydration can drop/reorder visible content. |
| Valid removal | Removing an existing inclusive range succeeds | `NATIVE_OPERATION_FAILED` from `Projection.remove()`. |

The existing suite passes 184/184 tests. An additional 1,024-history matrix fails 584 histories. The nine reduced reproductions below all fail in both Node and Chromium.

Save as `repro.mjs`, then run:

```sh
npm install @sovereignbase/sequencer@1.0.1
node repro.mjs
node repro.mjs merge-splices --details
```

<details>
<summary>repro.mjs — all nine cases</summary>

```js
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { Projection } from '@sovereignbase/sequencer'

function isDeepStrictEqual(left, right) {
  if (Object.is(left, right)) return true
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    if ((i in left) !== (i in right) || !isDeepStrictEqual(left[i], right[i])) return false
  }
  return true
}

function scenario(config) {
  config.nativeSeed ??= (Math.imul(config.seed, 0x9e3779b1) ^ 0x13579bdf) >>> 0
  const { seed, mode, peers: count, order, compact, hydrate } = config
  let state = seed >>> 0
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state >>> 8
  }
  const failures = []
  const categories = new Set()
  let checks = 0
  let context = {}
  const record = (category, details) => {
    if (categories.has(category)) return
    categories.add(category)
    failures.push(structuredClone({ category, ...context, ...details }))
  }
  const equal = (category, actual, expected, details = {}) => {
    checks++
    if (!isDeepStrictEqual(actual, expected)) record(category, { actual, expected, ...details })
  }
  const initial = Array.from({ length: [0, 1, 4, 16][seed % 4] }, (_, i) => `base:${i}`)
  const cryptoRandom = crypto.getRandomValues
  crypto.getRandomValues = (array) => { array[0] = config.nativeSeed; return array }
  let origin
  try { origin = new Projection(100) }
  finally { crypto.getRandomValues = cryptoRandom }
  if (initial.length) origin.insert(initial.slice(), 0)
  const snapshot = structuredClone(origin.sequence())
  origin.destroy()
  const membership = Array.from({ length: count }, (_, i) => [i + 1])
  if (!compact) membership.push([999])
  const peers = Array.from({ length: count }, (_, i) => new Projection(i + 1, structuredClone(snapshot)))
  for (const peer of peers) peer.apply(membership)
  const models = peers.map(() => initial.slice())
  const views = peers.map(() => initial.slice())
  const packets = []
  const intents = config.intents ?? Array.from({ length: config.steps ?? 80 }, (_, id) => ({
    id, author: random() % count, kind: random() % 3,
    boundary: random() % 4, selector: random(), width: 1 + random() % 5,
    frames: random() % 6, read: random() % 3,
  }))
  const ownSnapshots = []
  let baseline
  const safe = (operation) => {
    try { return operation() }
    catch (error) {
      record('exception', { name: error?.name, message: error?.message ?? String(error) })
      throw error
    }
  }
  const inspect = (peer, expected) => {
    const values = safe(() => peer.values())
    equal('length-values', peer.length(), values.length)
    if (expected) equal('visible-model', values, expected)
    const indexed = []
    for (let i = values.length - 1; i >= 0; i--) indexed[i] = safe(() => peer.value(i))
    equal('indexed-values', indexed, values)
    if (values.length) {
      const from = Math.floor(values.length / 3)
      const to = Math.min(values.length - 1, from + 3)
      equal('range-values', safe(() => peer.values(from, to)), values.slice(from, to + 1))
    }
    return values
  }
  const applyResult = (peer, view, result, before) => {
    const changes = result?.[0] ?? []
    for (const [from, to, values] of changes) {
      checks++
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > view.length)
        record('splice-bounds', { before, splices: changes, from, to, viewLength: view.length })
      view.splice(from, to - from, ...(values ?? []))
    }
    const actual = inspect(peer)
    equal('consumer-splices', view, actual, { before, splices: changes })
    // Prevent one bad packet from generating dependent consumer mismatches.
    view.splice(0, view.length, ...actual)
    return actual
  }
  const checkSnapshot = (peer) => {
    const before = peer.values()
    const saved = safe(() => peer.sequence())
    equal('snapshot-mutates-live', peer.values(), before)
    const clone = safe(() => new Projection(700, structuredClone(saved)))
    try { inspect(clone, before) } finally { clone.destroy() }
    const json = safe(() => new Projection(701, JSON.parse(JSON.stringify(saved))))
    try { equal('snapshot-json', json.values(), before) } finally { json.destroy() }
  }
  const deliveryOrder = (entries, receiver) => {
    if (order === 'reverse') return entries.slice().reverse()
    if (order !== 'shuffle') return entries.slice()
    const key = (id) => {
      let n = (seed ^ Math.imul(id + 1, 0x9e3779b1) ^ Math.imul(receiver + 1, 0x85ebca6b)) >>> 0
      n = Math.imul(n ^ (n >>> 16), 0x7feb352d)
      return (n ^ (n >>> 15)) >>> 0
    }
    return entries.slice().sort((a, b) => key(a.id) - key(b.id))
  }
  try {
    for (const intent of intents) {
      const { author, id, width, frames, read } = intent
      context = { phase: 'local', author, step: id }
      const peer = peers[author]
      const model = models[author]
      const length = model.length
      const kind = length === 0 ? 0 : intent.kind
      const limit = length - (kind === 0 ? 0 : 1)
      const at = intent.boundary === 0 ? 0 : intent.boundary === 1 ? Math.floor(limit / 2)
        : intent.boundary === 2 ? limit : intent.selector % (limit + 1)
      const widthActual = Math.min(width, length - at)
      const payload = Array.from({ length: kind === 0 ? Math.max(1, frames) : frames }, (_, i) => `${author}:${id}:${i}`)
      const delta = safe(() => kind === 0 ? peer.insert(payload.slice(), at)
        : kind === 1 ? peer.remove(at, at + widthActual - 1)
          : peer.replace(payload.slice(), at, at + widthActual - 1))
      model.splice(at, kind === 0 ? 0 : widthActual, ...(kind === 1 ? [] : payload))
      packets.push({ id, author, delta: structuredClone(delta) })
      if (mode === 'live') {
        views[author] = model.slice()
        for (let receiver = 0; receiver < count; receiver++) {
          if (receiver === author) continue
          context = { phase: 'live-apply', author, receiver, step: id }
          const result = safe(() => peers[receiver].apply(structuredClone(delta)))
          applyResult(peers[receiver], views[receiver], result, models[receiver].slice())
          models[receiver] = model.slice()
          inspect(peers[receiver], model)
          if (result?.[1]) {
            const before = views[author].slice()
            applyResult(peer, views[author], safe(() => peer.apply(result[1])), before)
          }
        }
      }
      if (read === 0) inspect(peer, model)
      else if (read === 1) equal('local-values', peer.values(), model)
      else for (let i = 0; i < model.length; i++) equal('local-indexed', peer.value(i), model[i])
      if (hydrate && id % 11 === 0) {
        context = { phase: 'mid-hydrate', author, step: id }
        const saved = safe(() => peer.sequence())
        const restored = safe(() => new Projection(author + 1, structuredClone(saved)))
        inspect(restored, model)
        peer.destroy()
        peers[author] = restored
        restored.apply(membership)
      }
    }
    for (let receiver = 0; receiver < count; receiver++) {
      context = { phase: 'local-final', receiver }
      inspect(peers[receiver], models[receiver])
      if (mode !== 'live') views[receiver] = models[receiver].slice()
      if (mode === 'merge') ownSnapshots.push({ id: receiver, state: structuredClone(peers[receiver].sequence()) })
    }
    baseline = new Projection(900, structuredClone(snapshot))
    baseline.apply(membership)
    for (const packet of packets) baseline.apply(structuredClone(packet.delta))
    const expected = inspect(baseline)
    if (mode !== 'live') {
      for (let receiver = 0; receiver <= count; receiver++) {
        const fresh = receiver === count
        const peer = fresh ? new Projection(800, structuredClone(snapshot)) : peers[receiver]
        if (fresh) peer.apply(membership)
        const view = fresh ? initial.slice() : views[receiver]
        const entries = deliveryOrder(mode === 'merge' ? ownSnapshots : packets, receiver)
        try {
          for (const [delivery, packet] of [...entries, ...entries].entries()) {
            context = { phase: mode === 'merge' ? 'merge' : 'offline-apply', receiver, delivery, packet: packet.id }
            const before = view.slice()
            const result = safe(() => mode === 'merge' ? peer.merge(structuredClone(packet.state)) : peer.apply(structuredClone(packet.delta)))
            applyResult(peer, view, result, before)
          }
          context = { phase: 'convergence', receiver }
          equal('convergence', inspect(peer), expected)
          checkSnapshot(peer)
        } finally { if (fresh) peer.destroy() }
      }
    } else {
      for (const [receiver, peer] of peers.entries()) {
        context = { phase: 'live-final', receiver }
        inspect(peer, expected)
        equal('consumer-splices', views[receiver], expected)
        checkSnapshot(peer)
      }
    }
  } catch (error) {
    record('exception', { name: error?.name, message: error?.message ?? String(error) })
  }
  finally {
    baseline?.destroy()
    peers.forEach((peer) => peer.destroy())
  }
  return { config, checks, failures, intents }
}



function decode(rows) {
  return rows.map(([id, author, kind, boundary, selector, width, frames, read]) => ({ id, author, kind, boundary, selector, width, frames, read }))
}
const cases = [
  { name: 'merge-splices', direct: true },
  { name: "local-values", ...{"mode":"live","peers":2,"compact":true,"hydrate":false,"seed":67,"nativeSeed":2077442700}, intents: decode([[2,0,1,2,5538092,5,0,2],[4,1,0,2,6968358,3,0,1],[5,0,2,2,2894660,3,4,0],[6,1,2,1,1756883,3,1,0],[7,0,2,0,4698825,2,3,2],[8,0,0,1,11930162,4,4,2],[10,0,2,0,14707364,3,4,2],[11,0,1,1,15669669,2,5,1],[14,1,1,2,7067772,2,0,1],[15,0,0,3,16588601,2,0,1],[16,1,2,0,4012024,3,0,2],[17,1,2,1,9025062,1,1,1]]) },
{ name: "local-indexed", ...{"mode":"live","peers":2,"compact":true,"hydrate":false,"seed":71,"nativeSeed":4063583176}, intents: decode([[6,0,1,3,1697069,2,4,0],[7,1,0,1,8083762,4,2,1],[8,0,2,1,4893852,2,0,2],[9,0,0,2,14763051,5,4,1],[10,0,1,3,9024848,4,5,1],[14,0,0,1,8225757,3,5,2]]) },
{ name: "indexed-values", ...{"mode":"apply","peers":3,"order":"shuffle","compact":false,"hydrate":true,"seed":78,"nativeSeed":665880625}, intents: decode([[10,2,0,3,3274747,2,4,0],[16,1,1,0,6644343,3,2,0],[17,2,1,2,7902808,5,4,0],[18,1,0,3,2272919,3,1,2]]) },
{ name: "length-values", ...{"mode":"merge","peers":3,"order":"shuffle","compact":false,"seed":19,"nativeSeed":2907280380}, intents: decode([[60,2,1,0,15782509,5,3,2],[62,0,1,3,16309285,1,2,2],[64,2,1,0,10294644,2,0,0],[65,2,2,0,9101887,2,3,1],[68,0,2,1,11203043,5,0,2]]) },
{ name: "range-values", ...{"mode":"live","peers":2,"compact":false,"hydrate":true,"seed":103,"nativeSeed":3137760744}, intents: decode([[6,0,1,3,1218552,4,2,1],[7,0,2,3,1608821,3,4,2],[8,1,2,3,15712234,5,5,0],[10,1,1,0,13896361,1,5,1],[11,1,1,2,6192472,2,3,1],[15,0,1,1,520198,2,3,2],[19,1,2,1,5994572,1,4,1]]) },
{ name: "snapshot-json", ...{"mode":"apply","peers":5,"order":"reverse","compact":false,"seed":47,"nativeSeed":528010400}, intents: decode([[6,4,1,0,2055956,1,4,0],[35,4,1,0,12574273,5,0,0],[54,4,0,0,9497405,5,1,0],[57,2,1,0,15818029,4,5,1]]) },
{ name: "convergence", ...{"mode":"apply","peers":5,"order":"reverse","compact":false,"seed":47,"nativeSeed":528010400}, intents: decode([[13,0,0,1,14234649,3,2,1],[14,4,1,0,1277847,3,4,1],[35,4,1,0,12574273,5,0,0],[54,4,0,0,9497405,5,1,0]]) },
{ name: "exception", ...{"mode":"live","peers":2,"compact":false,"hydrate":true,"seed":121,"nativeSeed":3681492854}, intents: decode([[0,1,0,3,2463686,5,3,2],[1,1,1,3,11702593,5,1,2],[3,0,2,3,3649742,3,3,2],[8,1,2,1,9214662,2,0,2],[9,0,2,1,3603638,2,4,0],[11,0,2,1,1453874,1,4,2],[12,0,2,2,12359682,3,4,1],[13,1,0,2,14465213,4,5,1],[14,0,0,2,5923352,1,0,2],[15,1,2,3,874605,4,2,1],[16,0,1,0,4732703,2,2,1],[17,1,1,0,6566216,2,3,2],[18,1,1,2,13252749,5,5,0],[19,0,2,3,15422506,5,2,0],[20,0,1,0,12447867,5,4,1],[21,0,1,2,12811938,2,3,2],[22,0,2,2,950279,5,4,2],[23,1,1,2,7522004,5,1,1],[24,0,2,3,10243761,4,5,2],[25,0,1,0,11938903,3,4,1]]) }
]
function mergeSplices() {
  const origin = new Projection(100)
  origin.insert(['root'], 0)
  const snapshot = origin.sequence()
  const author = new Projection(5, snapshot)
  const receiver = new Projection(1, snapshot)
  try {
    for (const peer of [author, receiver]) peer.apply([[1], [2], [3], [4], [5]])
    author.insert(['a', 'b', 'c', 'd', 'e'], 0)
    author.remove(0, 2)
    const actual = receiver.values()
    const result = receiver.merge(author.sequence())
    for (const [from, to, values] of result[0]) actual.splice(from, to - from, ...(values ?? []))
    const expected = receiver.values()
    return { checks: 1, failures: isDeepStrictEqual(actual, expected) ? [] : [
      { category: 'consumer-splices', before: ['root'], splices: result[0], actual, expected }
    ] }
  } finally { origin.destroy(); author.destroy(); receiver.destroy() }
}
if (!isMainThread) {
  parentPort.postMessage(workerData.direct ? mergeSplices() : scenario(workerData))
} else {
  const name = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
  const selected = name ? cases.filter((test) => test.name === name) : cases
  if (!selected.length) throw new Error('Unknown case: ' + name)
  let failures = 0
  for (const test of selected) {
    const result = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), { workerData: test })
      const timer = setTimeout(() => { void worker.terminate(); reject(new Error('Case timed out')) }, 5000)
      worker.once('message', (value) => { clearTimeout(timer); void worker.terminate(); resolve(value) })
      worker.once('error', (error) => { clearTimeout(timer); reject(error) })
    })
    if (result.failures.length) failures++
    console.log(test.name + ': ' + (result.failures.length ? 'FAIL ' + result.failures.map((f) => f.category).join(', ') : 'PASS'))
    if (process.argv.includes('--details')) console.dir(result.failures, { depth: null })
  }
  console.log(failures + '/' + selected.length + ' reproductions fail')
  process.exitCode = failures ? 1 : 0
}
```

</details>
