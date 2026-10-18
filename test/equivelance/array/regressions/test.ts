import { describe, expect, it, vi } from 'vitest'
import { SequencedArray } from '../../../../src/SequencedArray/class.js'
import type { Change, Gossip } from '@sovereignbase/sequencer'
import { arraySnapshot } from '../../../.shared/array.js'

describe('SequencedArray implementation regressions', () => {
  it('invokes callable callbacks even when their call property is shadowed', () => {
    const replica = new SequencedArray(1, arraySnapshot([1, 2]))
    const callback = Object.assign((value: number) => value * 2, { call: null })
    try {
      expect(replica.map(callback)).toEqual([2, 4])
      expect(replica.filter(callback)).toEqual([1, 2])
      expect(replica.find(callback)).toBe(1)
      expect(replica.findLast(callback)).toBe(2)
      expect(replica.findIndex(callback)).toBe(0)
      expect(replica.findLastIndex(callback)).toBe(1)
      expect(replica.every(callback)).toBe(true)
      expect(replica.some(callback)).toBe(true)
      expect(replica.flatMap(callback)).toEqual([2, 4])
      expect(() => replica.forEach(callback)).not.toThrow()
    } finally {
      replica.destroy()
    }
  })
  it('find returns the visited value even if the predicate replaces it', () => {
    const replica = new SequencedArray(1, arraySnapshot([1, 2, 3]))
    try {
      expect(
        replica.find((value, index) => {
          replica.set(index, 99)
          return value === 2
        })
      ).toBe(2)
      expect([...replica]).toEqual([99, 99, 3])
    } finally {
      replica.destroy()
    }
  })

  it('find methods visit truncated positions as undefined in native order', () => {
    for (const method of [
      'find',
      'findIndex',
      'findLast',
      'findLastIndex',
    ] as const) {
      const replica = new SequencedArray<number | undefined>(
        1,
        arraySnapshot([1, 2, 3])
      )
      const observe = (
        array: SequencedArray<number | undefined> | (number | undefined)[]
      ) => {
        const visited: unknown[] = []
        const callback = (value: number | undefined, index: number) => {
          visited.push([value, index])
          array.length = 0
          return value === undefined
        }
        const result = Reflect.apply(array[method], array, [callback])
        return { result, visited }
      }
      try {
        expect(observe(replica), method).toEqual(observe([1, 2, 3]))
      } finally {
        replica.destroy()
      }
    }
  })

  it('findLast callbacks can edit pending values without changing visited values', () => {
    const replica = new SequencedArray(1, arraySnapshot([1, 2, 3]))
    try {
      expect(
        replica.findLast((value, index) => {
          replica.set(index, 99)
          return value === 2
        })
      ).toBe(2)
    } finally {
      replica.destroy()
    }
  })

  it('flatMap flattens each returned array before invoking the next callback', () => {
    const replica = new SequencedArray(1, arraySnapshot([1, 2, 3]))
    const shared: number[] = []
    try {
      expect(
        replica.flatMap((value) => {
          shared.push(value)
          return shared
        })
      ).toEqual([1, 1, 2, 1, 2, 3])
    } finally {
      replica.destroy()
    }
  })

  it('uses shallow value references in local reads and plain-array copies', () => {
    const object = { count: 1 }
    const replica = new SequencedArray(1, arraySnapshot([object]))
    try {
      expect(replica.get(0)).toBe(object)
      expect(replica.slice()[0]).toBe(object)
      expect(replica.map((value) => value)[0]).toBe(object)
      replica.get(0)!.count++
      expect(object.count).toBe(2)
    } finally {
      replica.destroy()
    }
  })

  it('no-op edits and invalid extension positions leave state and events unchanged', () => {
    const replica = new SequencedArray<number>(1)
    const listener = vi.fn()
    replica.addEventListener('change', listener)
    replica.addEventListener('delta', listener)
    try {
      replica.push()
      replica.unshift()
      replica.pop()
      replica.shift()
      replica.splice()
      replica.reverse()
      replica.sort()
      replica.copyWithin(0, 0)
      replica.fill(1)
      replica.length = 0
      for (const index of [-1, 0, 0.5, Infinity, NaN]) {
        expect(replica.get(index)).toBeUndefined()
        expect(() => replica.set(index, 1)).toThrow(RangeError)
        expect(() => replica.delete(index)).toThrow(RangeError)
      }
      expect(listener).not.toHaveBeenCalled()
      expect([...replica]).toEqual([])
    } finally {
      replica.destroy()
      replica.destroy()
    }
  })

  it('replicates grown length as explicit undefined values', () => {
    const alice = new SequencedArray(1, arraySnapshot([1]))
    const bob = new SequencedArray<number | undefined>(2, alice.toJSON())
    alice.addEventListener('delta', (event) => bob.apply(event.detail))
    try {
      alice.length = 4
      expect([...alice]).toEqual([1, undefined, undefined, undefined])
      expect([...bob]).toEqual([...alice])
      alice.length = 1
      expect([...bob]).toEqual([1])
    } finally {
      alice.destroy()
      bob.destroy()
    }
  })

  it('supports synchronous bidirectional delivery and change-splice consumers', () => {
    const alice = new SequencedArray<number>(1)
    const bob = new SequencedArray<number>(2)
    const views = [[], []] as number[][]
    const peers = [alice, bob]
    for (const [index, peer] of peers.entries()) {
      peer.addEventListener('change', (event) => {
        for (const [start, end, values] of event.detail)
          views[index].splice(
            start,
            end - start,
            ...((values ?? []) as number[])
          )
      })
      peer.addEventListener('delta', (event) =>
        peers[1 - index].apply(structuredClone(event.detail))
      )
    }
    try {
      alice.push(1, 2, 3)
      bob.set(1, 20)
      alice.splice(0, 1, 0, 1)
      bob.delete(2)
      expect([...alice]).toEqual([0, 1, 3])
      expect([...bob]).toEqual([...alice])
      expect(views).toEqual([[...alice], [...alice]])
    } finally {
      alice.destroy()
      bob.destroy()
    }
  })

  it('converges across seeded offline histories and shuffled duplicate delivery', () => {
    for (let seed = 1; seed <= 24; seed++) {
      let state = seed
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0
        return state >>> 8
      }
      const snapshot = arraySnapshot([1, 2, 3, 4])
      const peers = [1, 2, 3].map(
        (actor) => new SequencedArray(actor, snapshot)
      )
      // Register all offline participants before deletions can be compacted.
      for (const peer of peers) peer.apply([[1], [2], [3]])
      const models = peers.map(() => [1, 2, 3, 4])
      const views = models.map((values) => values.slice())
      const deltas: Gossip<number>[] = []
      let phase = 'local edits'
      const replay = (view: number[], change: Change<number>) => {
        for (const [start, end, values] of change)
          view.splice(start, end - start, ...((values ?? []) as number[]))
      }
      for (const [i, peer] of peers.entries()) {
        peer.addEventListener('delta', (event) =>
          deltas.push(structuredClone(event.detail))
        )
        peer.addEventListener('change', (event) =>
          replay(views[i], event.detail)
        )
      }
      try {
        for (let step = 0; step < 60; step++) {
          const actor = random() % peers.length
          const peer = peers[actor]
          const model = models[actor]
          const index = random() % (model.length + 1)
          const value = random() % 100
          const count = random() % 3
          switch (random() % 5) {
            case 0:
              peer.push(value)
              model.push(value)
              break
            case 1:
              peer.unshift(value)
              model.unshift(value)
              break
            case 2:
              peer.splice(index, count, value)
              model.splice(index, count, value)
              break
            case 3:
              peer.pop()
              model.pop()
              break
            case 4:
              if (model.length) {
                peer.set(index % model.length, value)
                model[index % model.length] = value
              }
              break
          }
          expect([...peer], `seed ${seed} step ${step}`).toEqual(model)
          expect(views[actor]).toEqual(model)
        }
        const authored = deltas.slice()
        for (const [receiver, peer] of peers.entries()) {
          phase = `delivery to peer ${receiver}`
          const order = authored.slice()
          for (let i = order.length - 1; i > 0; i--) {
            const j = random() % (i + 1)
            ;[order[i], order[j]] = [order[j], order[i]]
          }
          for (const [delivery, delta] of [...order, ...order].entries()) {
            phase = `delivery ${delivery} to peer ${receiver}`
            peer.apply(delta)
          }
        }
        for (const [i, peer] of peers.entries()) {
          phase = `snapshot peer ${i}`
          expect([...peer], `seed ${seed}`).toEqual([...peers[0]])
          expect(views[i]).toEqual([...peer])
          phase = `export peer ${i}`
          const serialized = JSON.parse(JSON.stringify(peer))
          phase = `hydrate peer ${i}`
          const restored = new SequencedArray(10, serialized)
          try {
            expect([...restored]).toEqual([...peer])
          } finally {
            restored.destroy()
          }
        }
      } catch (error) {
        throw new Error(`seed ${seed}, ${phase}`, { cause: error })
      } finally {
        peers.forEach((peer) => peer.destroy())
      }
    }
  })
})
