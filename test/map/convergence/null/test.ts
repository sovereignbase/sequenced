import { Projection } from '@sovereignbase/sequencer'
import { describe, expect, it, vi } from 'vitest'
import { SequencedMap } from '../../../../src/SequencedMap/class.js'
import { replication } from '../../../.shared/replication.js'

type Slot = readonly [string, number] | null

describe('Map null deletion slots', () => {
  it('keeps following physical positions stable and leaves snapshots unchanged', () => {
    const map = new SequencedMap<string, number>(1)
    map.set('a', 1).set('b', 2).set('c', 3)
    const remove = vi.spyOn(Projection.prototype, 'remove')
    const replace = vi.spyOn(Projection.prototype, 'replace')
    const read = vi.spyOn(Projection.prototype, 'value')
    try {
      expect(map.delete('a')).toBe(true)
      expect(remove).not.toHaveBeenCalled()
      expect(replace).toHaveBeenLastCalledWith([null], 0, 0)
      expect(map.get('c')).toBe(3)
      expect(read).toHaveBeenLastCalledWith(2)
      map.set('c', 30)
      expect(replace).toHaveBeenLastCalledWith([['c', 30]], 2, 2)
      const snapshot = map.toJSON()
      map.snapshot()
      expect(remove).not.toHaveBeenCalled()
      const raw = new Projection<Slot>(2, snapshot)
      try {
        expect(raw.values()).toEqual([null, ['b', 2], ['c', 30]])
      } finally {
        raw.destroy()
      }
    } finally {
      vi.restoreAllMocks()
      map.destroy()
    }
  })

  it('deletes every duplicate while keeping unrelated null slots and keys intact', () => {
    const source = new Projection<Slot>(2)
    const map = new SequencedMap<string, number>(1)
    source.apply([[1], [2]])
    map.apply([[1], [2]])
    try {
      map.apply(
        source.insert(
          [null, ['a', 1], ['b', 2], ['a', 3], null, ['c', 4], ['a', 5]],
          0
        )
      )
      expect(map.delete('a')).toBe(true)
      expect([...map]).toEqual([
        ['b', 2],
        ['c', 4],
      ])
      const raw = new Projection<Slot>(3, map.toJSON())
      try {
        expect(raw.values()).toEqual([
          null,
          null,
          ['b', 2],
          null,
          null,
          ['c', 4],
          null,
        ])
      } finally {
        raw.destroy()
      }
      expect(map.delete('b')).toBe(true)
      expect(map.get('c')).toBe(4)
      map.set('d', 6)
      expect([...map]).toEqual([
        ['c', 4],
        ['d', 6],
      ])
      map.clear()
      expect([...map]).toEqual([])
      map.set('after', 7)
      expect([...map]).toEqual([['after', 7]])
    } finally {
      source.destroy()
      map.destroy()
    }
  })

  it('continues exchanging edits when a registered offline actor restores and cleans null slots', () => {
    const original = new SequencedMap<string, number>(1)
    // Keep the offline actor's coordinates until it receives the pending history.
    original.apply([[2]])
    original.set('a', 1).set('b', 2).set('c', 3)
    original.delete('b')
    const restored = new SequencedMap<string, number>(
      2,
      JSON.parse(JSON.stringify(original))
    )
    original.addEventListener('delta', ({ detail }) => restored.apply(detail))
    restored.addEventListener('delta', ({ detail }) => original.apply(detail))
    try {
      restored.set('d', 4)
      original.set('c', 30)
      restored.delete('a')
      const expected = new Map([
        ['c', 30],
        ['d', 4],
      ])
      expect(new Map(original)).toEqual(expected)
      expect(new Map(restored)).toEqual(expected)
      original.merge(restored.toJSON())
      restored.merge(original.toJSON())
      expect(new Map(original)).toEqual(expected)
      expect(new Map(restored)).toEqual(expected)
    } finally {
      original.destroy()
      restored.destroy()
    }
  })

  it.each([1, 17, 0xc0ffee])(
    'converges concurrent delete/set edits and later compaction (seed %s)',
    (seed) => {
      const maps = [1, 2, 3].map(
        (actor) => new SequencedMap<string, number>(actor)
      )
      const transport = replication(maps, [1, 2, 3])
      try {
        maps[0].set('a', 1).set('b', 2).set('c', 3)
        transport.flush(seed)
        maps[0].delete('a')
        maps[1].set('a', 10)
        maps[2].delete('b')
        transport.flush(seed, true)
        const expected = [...maps[0]]
        maps.forEach((map) => expect([...map]).toEqual(expected))
        const restored = new SequencedMap<string, number>(4, maps[0].toJSON())
        try {
          maps.forEach((map) => map.merge(restored.toJSON()))
          transport.flush(seed, true)
          maps.forEach((map) => expect([...map]).toEqual([...restored]))
        } finally {
          restored.destroy()
        }
      } finally {
        transport.close()
        maps.forEach((map) => map.destroy())
      }
    }
  )
})
