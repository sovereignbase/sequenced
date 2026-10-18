import { Projection } from '@sovereignbase/sequencer'

function isDeepStrictEqual(left, right) {
  if (Object.is(left, right)) return true
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    if ((i in left) !== (i in right) || !isDeepStrictEqual(left[i], right[i])) return false
  }
  return true
}

export function scenario(config) {
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

