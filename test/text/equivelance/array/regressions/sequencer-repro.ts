/**
 * Standalone upstream reproduction: no SequencedArray imports.
 * Run: node test/equivelance/array/regressions/sequencer-repro.ts
 */
import { strictEqual } from 'node:assert'
import { Projection, type Gossip } from '@sovereignbase/sequencer'

const seed = new Projection<number>(100)
seed.insert([1, 2, 3, 4], 0)
const snapshot = seed.sequence()
seed.destroy()
const peers = [1, 2, 3].map((actor) => new Projection<number>(actor, snapshot))
for (const peer of peers) peer.apply([[1], [2], [3]])
const deltas: Gossip<number>[] = []
let state = 1
const random = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return state >>> 8
}

try {
  for (let step = 0; step < 60; step++) {
    const peer = peers[random() % 3]
    const length = peer.length()
    const at = random() % (length + 1)
    const value = random() % 100
    const count = Math.min(random() % 3, length - at)
    let delta: Gossip<number> | undefined
    switch (random() % 5) {
      case 0:
        delta = peer.insert([value], length)
        break
      case 1:
        delta = peer.insert([value], 0)
        break
      case 2:
        delta = count
          ? peer.replace([value], at, at + count - 1)
          : peer.insert([value], at)
        break
      case 3:
        if (length) delta = peer.remove(length - 1, length - 1)
        break
      case 4:
        if (length) delta = peer.replace([value], at % length, at % length)
        break
    }
    if (delta) deltas.push(structuredClone(delta))
    for (let i = 0; i < peer.length(); i++) peer.value(i)
  }
  for (const [index, peer] of peers.entries()) {
    const order = deltas.slice()
    for (let i = order.length - 1; i > 0; i--) {
      const j = random() % (i + 1)
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    for (const delta of [...order, ...order]) peer.apply(delta)
    const values = peer.values()
    console.log({
      peer: index,
      length: peer.length(),
      valuesLength: values.length,
    })
    strictEqual(
      values.length,
      peer.length(),
      `peer ${index}: bulk values must match length`
    )
  }
} finally {
  peers.forEach((peer) => peer.destroy())
}
