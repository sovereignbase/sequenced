import { Projection } from '@sovereignbase/sequencer'
import type { Gossip, Sequence } from '@sovereignbase/sequencer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SequencedMap } from '../../../../src/SequencedMap/class.js'
import type { SequencedMapEntry } from '../../../../src/index.js'

type Entry = SequencedMapEntry<string | number, number>
afterEach(() => vi.restoreAllMocks())

describe('incremental Map patches', () => {
  it('removes an entire duplicate group and shifts past hidden entries on local deletion', () => {
    const source = new Projection<Entry>(2)
    const map = new SequencedMap<string | number, number>(1)
    source.apply([[1], [2]])
    map.apply([[1], [2]])
    try {
      map.apply(
        source.insert(
          [
            ['a', 1],
            ['a', 2],
            ['b', 3],
            ['c', 4],
            ['c', 5],
          ],
          0
        )
      )
      map.apply(source.remove(0, 1))
      expect([...map]).toEqual([
        ['b', 3],
        ['c', 4],
      ])
      map.delete('b')
      expect([...map]).toEqual([['c', 4]])
      map.set('c', 6)
      expect([...map]).toEqual([['c', 6]])
      map.clear()
      expect([...map]).toEqual([])
    } finally {
      source.destroy()
      map.destroy()
    }
  })

  it.each(
    [
      [],
      [2, 0],
      [-1],
      [1.5],
      [0x100000000],
      [[], []],
      [[1, 2, 3, 4, 5, 6], [], 'extra'],
      [[1, 2, 3, 4, 5, 6], null],
    ].map((invalid) => ({ invalid }))
  )(
    'delegates malformed transport metadata without throwing: %j',
    ({ invalid }) => {
      const source = new Projection<Entry>(2)
      const map = new SequencedMap<string | number, number>(1)
      try {
        const delta = source.insert([['a', 1]], 0)
        expect(() => map.apply([...delta, invalid])).not.toThrow()
      } finally {
        source.destroy()
        map.destroy()
      }
    }
  )

  it('accepts typed acknowledgement metadata without reading all values', () => {
    const map = new SequencedMap<string | number, number>(1)
    try {
      map.apply([Uint32Array.of(1), Uint32Array.of(2)])
      map.set('a', 1)
      expect([...map]).toEqual([['a', 1]])
    } finally {
      map.destroy()
    }
  })

  it('delegates a sparse gossip batch without throwing', () => {
    const source = new Projection<Entry>(2)
    const map = new SequencedMap<string | number, number>(1)
    try {
      const delta = [...source.insert([['a', 1]], 0)]
      delta.length++
      const engine = vi.spyOn(Projection.prototype, 'apply')
      expect(() => map.apply(delta)).not.toThrow()
      expect(engine).toHaveBeenCalledExactlyOnceWith(delta)
    } finally {
      source.destroy()
      map.destroy()
    }
  })

  it.each([1, 8])(
    'matches first-entry Map semantics across batches of %i edits',
    (batch) => {
      for (let seed of [1, 17, 0xc0ffee, 0xffffffff]) {
        const source = new Projection<Entry>(2)
        const map = new SequencedMap<string | number, number>(1)
        source.apply([[1], [2]])
        map.apply([[1], [2]])
        const rendered = new Map<string, number>()
        map.addEventListener('change', ({ detail }) => {
          for (const [key, value] of Object.entries(detail)) {
            if (value === undefined) rendered.delete(key)
            else rendered.set(key, value)
          }
        })
        const original = Projection.prototype.values
        const bulk = vi
          .spyOn(Projection.prototype, 'values')
          .mockImplementation(function (this: Projection<Entry>) {
            if (this !== source)
              throw new Error('Map must consume patches without a full read')
            return original.call(this)
          })
        const next = () =>
          (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0)
        let pending: Gossip<Entry>[number][] = []
        try {
          for (let step = 0; step < 400; step++) {
            const length = source.length()
            const operation = next() % 3
            const at = next() % (length + (operation === 0 || !length ? 1 : 0))
            const entries = Array.from(
              { length: (next() % 4) + 1 },
              (): Entry => [`key-${next() % 12}`, step]
            )
            const delta =
              !length || operation === 0
                ? source.insert(entries, at)
                : operation === 1
                  ? source.replace(
                      entries,
                      at,
                      Math.min(length - 1, at + (next() % 4))
                    )
                  : source.remove(at, Math.min(length - 1, at + (next() % 4)))
            pending.push(...delta)
            if ((step + 1) % batch) continue
            map.apply(pending)
            pending = []
            const expected = new Map<string | number, number>()
            for (const [key, value] of source.values())
              if (!expected.has(key)) expected.set(key, value)
            expect([...map]).toEqual([...expected])
            expect(map.size).toBe(expected.size)
            expect([...map.keys()]).toEqual([...expected.keys()])
            expect(Object.fromEntries(rendered)).toEqual(
              Object.fromEntries(expected)
            )
          }
        } finally {
          bulk.mockRestore()
          source.destroy()
          map.destroy()
        }
      }
    }
  )

  it.each(['apply', 'merge'] as const)(
    '%s reads only the changed visible value for an observed replacement',
    (method) => {
      const source = new Projection<Entry>(2)
      const map = new SequencedMap<string | number, number>(1)
      source.apply([[1], [2]])
      map.apply([[1], [2]])
      map.apply(
        source.insert(
          Array.from({ length: 1000 }, (_, i): Entry => [i, i]),
          0
        )
      )
      const changes = vi.fn()
      map.addEventListener('change', changes)
      const delta = source.replace([[500, -1]], 500, 500)
      const input = method === 'merge' ? source.sequence() : delta
      const read = vi.spyOn(Projection.prototype, 'value')
      const bulk = vi
        .spyOn(Projection.prototype, 'values')
        .mockImplementation(() => {
          throw new Error('Map must consume patches without a full read')
        })
      try {
        if (method === 'apply') map.apply(input)
        else map.merge(input as Sequence<Entry>)
        expect(read).toHaveBeenCalledExactlyOnceWith(500)
        expect(changes.mock.calls.map(([event]) => event.detail)).toEqual([
          { 500: -1 },
        ])
        expect([...map.keys()]).toEqual(
          Array.from({ length: 1000 }, (_, i) => i)
        )
      } finally {
        bulk.mockRestore()
        source.destroy()
        map.destroy()
      }
    }
  )

  it('does not read values for unobserved edits, acknowledgements or hidden replacements', () => {
    const source = new Projection<Entry>(2)
    const map = new SequencedMap<string, number>(1)
    source.apply([[1], [2]])
    map.apply([[1], [2]])
    const read = vi.spyOn(Projection.prototype, 'value')
    const bulk = vi
      .spyOn(Projection.prototype, 'values')
      .mockImplementation(() => {
        throw new Error('Map must consume patches without a full read')
      })
    try {
      map.apply(
        source.insert(
          [
            ['a', 1],
            ['b', 2],
            ['a', 3],
          ],
          0
        )
      )
      map.apply(source.replace([['a', 4]], 0, 0))
      map.apply([[2]])
      const changes = vi.fn()
      map.addEventListener('change', changes)
      map.apply(source.replace([['a', 5]], 2, 2))
      expect(read).not.toHaveBeenCalled()
      expect(changes).not.toHaveBeenCalled()
      expect([...map]).toEqual([
        ['a', 4],
        ['b', 2],
      ])
      map.apply(source.remove(0, 0))
      expect([...map]).toEqual([
        ['b', 2],
        ['a', 5],
      ])
      expect(changes.mock.calls[0][0].detail).toEqual({ a: 5 })
    } finally {
      bulk.mockRestore()
      source.destroy()
      map.destroy()
    }
  })
})
