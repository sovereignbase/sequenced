import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { Sequenced } from '../../../src/index.js'
import { SequencedStruct } from '../../../src/SequencedStruct/class.js'
import type { SequencedStructDelta } from '../../../src/SequencedStruct/types/type.js'

const defaults = { title: '', count: 0, done: false }
type Fields = typeof defaults

describe('SequencedStruct', () => {
  it('exposes fixed, enumerable fields with their own types', () => {
    const struct = new Sequenced.Struct(1, defaults)
    expectTypeOf(struct.title).toEqualTypeOf<string>()
    expectTypeOf(struct.count).toEqualTypeOf<number>()
    expectTypeOf(struct.done).toEqualTypeOf<boolean>()
    if (false) {
      // @ts-expect-error Field assignments must match the field type.
      struct.count = 'wrong'
      // @ts-expect-error The struct shape is fixed.
      struct.extra = true
    }
    expect({ ...struct }).toEqual(defaults)
    expect(Object.keys(struct)).toEqual(Object.keys(defaults))
    expect(Reflect.set(struct, 'extra', true)).toBe(false)
    expect(Reflect.deleteProperty(struct, 'title')).toBe(false)
    expect(() => new SequencedStruct(1, { apply: '' })).toThrow(TypeError)
  })

  it('replicates writes and falsy values independently per field', () => {
    const alice = new SequencedStruct(1, defaults)
    const bob = new SequencedStruct(2, defaults)
    const change = vi.fn()
    bob.addEventListener('change', change)
    alice.addEventListener('delta', (event) => bob.apply(event.detail))
    bob.addEventListener('delta', (event) => alice.apply(event.detail))
    alice.title = 'hello'
    alice.count = 7
    alice.count = 0
    alice.done = true
    alice.done = false
    alice.title = ''
    expect(bob.valueOf()).toEqual(defaults)
    expect(change.mock.calls.map(([event]) => event.detail)).toEqual([
      { title: 'hello' },
      { count: 7 },
      { count: 0 },
      { done: true },
      { done: false },
      { title: '' },
    ])
  })

  it('hydrates and merges snapshots after JSON serialization', () => {
    const alice = new SequencedStruct(1, defaults)
    alice.count = 42
    const snapshot = JSON.parse(JSON.stringify(alice))
    expect(snapshot.title).toEqual([[], []])
    expect(Array.isArray(snapshot.count[0])).toBe(true)
    const bob = new SequencedStruct(2, defaults, snapshot)
    const carol = new SequencedStruct(3, defaults)
    carol.merge(snapshot)
    expect(bob.valueOf()).toEqual(alice.valueOf())
    expect(carol.valueOf()).toEqual(alice.valueOf())
    bob.addEventListener('delta', (event) => carol.apply(event.detail))
    bob.count = 0
    expect(carol.count).toBe(0)
  })

  it('converges under concurrent, reversed and duplicate delivery', () => {
    const alice = new SequencedStruct(1, defaults)
    const bob = new SequencedStruct(2, defaults)
    const observer = new SequencedStruct(3, defaults)
    const deltas: SequencedStructDelta<Fields>[] = []
    alice.addEventListener('delta', (event) => deltas.push(event.detail))
    bob.addEventListener('delta', (event) => deltas.push(event.detail))
    alice.title = 'alice'
    bob.title = 'bob'
    alice.count = 1
    bob.done = true
    for (const delta of deltas.slice()) alice.apply(delta)
    for (const delta of deltas.slice().reverse()) bob.apply(delta)
    for (const delta of [...deltas.slice().reverse(), ...deltas]) {
      observer.apply(delta)
    }
    expect(bob.valueOf()).toEqual(alice.valueOf())
    expect(observer.valueOf()).toEqual(alice.valueOf())
    expect(alice.count).toBe(1)
    expect(alice.done).toBe(true)
    alice.title = 'resolved'
    const replacement = deltas.at(-1)
    bob.apply(replacement)
    observer.apply(replacement)
    expect(alice.title).toBe('resolved')
    expect(bob.title).toBe('resolved')
    expect(observer.title).toBe('resolved')
    const restored = new SequencedStruct(4, defaults, alice.toJSON())
    expect(restored.valueOf()).toEqual(alice.valueOf())
  })

  it('supports snapshots and removing typed listeners', () => {
    const struct = new SequencedStruct(1, defaults)
    const listener = vi.fn()
    struct.addEventListener('snapshot', listener)
    struct.snapshot()
    expect(listener.mock.calls[0][0].detail).toEqual(struct.toJSON())
    struct.removeEventListener('snapshot', listener)
    struct.snapshot()
    expect(listener).toHaveBeenCalledTimes(1)
    struct.addEventListener('change', (event) => {
      expectTypeOf(event.detail.count).toEqualTypeOf<number | undefined>()
    })
  })

  it('ignores unknown fields and invalid gossip envelopes', () => {
    const struct = new SequencedStruct(1, defaults)
    struct.apply(null)
    struct.apply([])
    struct.apply({ extra: [], count: null })
    expect(struct.valueOf()).toEqual(defaults)
  })
})
