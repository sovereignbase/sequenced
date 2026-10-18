import { Projection } from '@sovereignbase/sequencer'
import type { Change, Gossip } from '@sovereignbase/sequencer'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  arraySnapshot,
  loadArray,
  type ArrayConstructor,
  type ArraySubject,
} from '../../../.shared/array.js'

let ArrayReplica: ArrayConstructor
beforeAll(async () => {
  ArrayReplica = await loadArray()
})

function replay(view: number[], changes: Change<number>): void {
  for (const [start, end, values] of changes)
    view.splice(start, end - start, ...((values ?? []) as number[]))
}

function capture(replica: ArraySubject<number>) {
  const deltas: Gossip<number>[] = []
  const changes: Change<number>[] = []
  replica.addEventListener('delta', (event) => deltas.push(event.detail))
  replica.addEventListener('change', (event) => changes.push(event.detail))
  return { deltas, changes }
}

describe('SequencedArray CRDT extensions', () => {
  it('get/set/delete address one visible element; delete shifts subsequent elements', () => {
    const replica = new ArrayReplica(1, arraySnapshot([1, 2, 3, 4]))
    expect(replica.get(1)).toBe(2)
    replica.set(1, 20)
    expect([...replica]).toEqual([1, 20, 3, 4])
    replica.delete(1)
    expect([...replica]).toEqual([1, 3, 4])
    expect(replica.get(1)).toBe(3)
  })

  it('emits replayable local changes and raw-sequencer-compatible deltas', () => {
    const snapshot = arraySnapshot([1, 2, 3])
    const replica = new ArrayReplica(1, snapshot)
    const receiver = new Projection<number>(2, snapshot)
    const view = [1, 2, 3]
    const { deltas, changes } = capture(replica)
    const edits = [
      () => replica.push(4, 5),
      () => replica.unshift(0),
      () => replica.set(2, 20),
      () => replica.delete(1),
      () => replica.splice(-2, 1, 40, 41),
      () => replica.pop(),
      () => replica.shift(),
      () => replica.reverse(),
      () => replica.fill(9, 1, 2),
      () => replica.copyWithin(0, 1, 2),
      () => replica.sort((a, b) => a - b),
      () => {
        replica.length = 1
      },
    ]
    try {
      for (const edit of edits) {
        deltas.length = changes.length = 0
        const previous = [...replica]
        edit()
        if (JSON.stringify(previous) !== JSON.stringify([...replica])) {
          expect(deltas.length).toBeGreaterThan(0)
          expect(changes.length).toBeGreaterThan(0)
        }
        for (const delta of deltas) receiver.apply(structuredClone(delta))
        for (const change of changes) replay(view, change)
        expect(receiver.values()).toEqual([...replica])
        expect(view).toEqual([...replica])
      }
    } finally {
      receiver.destroy()
    }
  })

  it('applies raw sequencer insert/replace/remove gossip and tolerates duplicate delivery', () => {
    const sender = new Projection<number>(1)
    const replica = new ArrayReplica<number>(2)
    const view: number[] = []
    replica.addEventListener('change', (event) => replay(view, event.detail))
    replica.addEventListener('delta', (event) => sender.apply(event.detail))
    try {
      for (const edit of [
        () => sender.insert([1, 2, 3], 0),
        () => sender.replace([20, 21], 1, 1),
        () => sender.remove(0, 0),
      ]) {
        const delta = structuredClone(edit())
        replica.apply(delta)
        replica.apply(delta)
        expect([...replica]).toEqual(sender.values())
        expect(view).toEqual(sender.values())
      }
    } finally {
      sender.destroy()
    }
  })

  it('roundtrips JSON snapshots and merges independent edits', () => {
    const alice = new ArrayReplica(1, arraySnapshot([1, 2, 3]))
    const snapshot = JSON.parse(JSON.stringify(alice))
    const bob = new ArrayReplica<number>(2, snapshot)
    expect([...bob]).toEqual([...alice])
    alice.push(4)
    bob.unshift(0)
    const aliceState = alice.toJSON()
    const bobState = bob.toJSON()
    alice.merge(bobState)
    bob.merge(aliceState)
    expect([...alice]).toEqual([...bob])
    expect([...alice]).toEqual([0, 1, 2, 3, 4])
    bob.merge(alice.toJSON())
    expect([...bob]).toEqual([...alice])
    const restored = new ArrayReplica(3, JSON.parse(JSON.stringify(alice)))
    expect([...restored]).toEqual([...alice])
  })

  it('converges with concurrent, reversed and duplicate gossip', () => {
    const initial = arraySnapshot([1, 2, 3])
    const alice = new ArrayReplica(1, initial)
    const bob = new ArrayReplica(2, initial)
    const observer = new ArrayReplica(3, initial)
    const deltas: Gossip<number>[] = []
    alice.addEventListener('delta', (event) =>
      deltas.push(structuredClone(event.detail))
    )
    bob.addEventListener('delta', (event) =>
      deltas.push(structuredClone(event.detail))
    )
    alice.push(4)
    alice.set(0, 10)
    bob.unshift(0)
    bob.delete(2)
    const authored = deltas.slice()
    for (const delta of authored) alice.apply(delta)
    for (const delta of authored.slice().reverse()) bob.apply(delta)
    for (const delta of [...authored.slice().reverse(), ...authored])
      observer.apply(delta)
    expect([...bob]).toEqual([...alice])
    expect([...observer]).toEqual([...alice])
  })

  it('does not change visible state for malformed apply input', () => {
    const replica = new ArrayReplica(1, arraySnapshot([1, 2]))
    for (const invalid of [null, undefined, 'invalid', {}, [null]]) {
      replica.apply(invalid)
      expect([...replica]).toEqual([1, 2])
    }
  })
})

describe('SequencedArray events', () => {
  it('snapshot emits a serializable replication snapshot', () => {
    const replica = new ArrayReplica(1, arraySnapshot([1, 2, 3]))
    const listener = vi.fn()
    replica.addEventListener('snapshot', listener)
    replica.snapshot()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toBeInstanceOf(CustomEvent)
    const snapshot = listener.mock.calls[0][0].detail
    expect(snapshot).toEqual(replica.toJSON())
    expect([
      ...new ArrayReplica(2, JSON.parse(JSON.stringify(snapshot))),
    ]).toEqual([1, 2, 3])
  })

  it('supports removal, listener objects, once and AbortSignal', () => {
    const replica = new ArrayReplica<number>(1)
    const removed = vi.fn()
    const once = vi.fn()
    const aborted = vi.fn()
    const object = { handleEvent: vi.fn() }
    const controller = new AbortController()
    replica.addEventListener('snapshot', removed)
    replica.removeEventListener('snapshot', removed)
    replica.addEventListener('snapshot', once, { once: true })
    replica.addEventListener('snapshot', aborted, { signal: controller.signal })
    replica.addEventListener('snapshot', object)
    controller.abort()
    replica.snapshot()
    replica.snapshot()
    expect(removed).not.toHaveBeenCalled()
    expect(aborted).not.toHaveBeenCalled()
    expect(once).toHaveBeenCalledTimes(1)
    expect(object.handleEvent).toHaveBeenCalledTimes(2)
    replica.removeEventListener('snapshot', object)
    replica.snapshot()
    expect(object.handleEvent).toHaveBeenCalledTimes(2)
  })

  it('dispatches events synchronously with the supplied detail', () => {
    const replica = new ArrayReplica<number>(1)
    const detail = arraySnapshot([1])
    const listener = vi.fn()
    replica.addEventListener('snapshot', listener)
    replica.dispatchEvent('snapshot', detail)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].detail).toBe(detail)
  })

  it('read methods do not emit edit events', () => {
    const replica = new ArrayReplica(1, arraySnapshot([1, 2, 3]))
    const { deltas, changes } = capture(replica)
    replica.at(0)
    replica.get(0)
    replica.map((x) => x + 1)
    replica.slice()
    replica.toJSON()
    replica.toString()
    expect(deltas).toEqual([])
    expect(changes).toEqual([])
  })
})
