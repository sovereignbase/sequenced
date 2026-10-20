import { Projection } from '@sovereignbase/sequencer'
import { describe, expect, it } from 'vitest'
import { SequencedMap } from '../../src/index.js'
import type {
  SequencedMapEntry,
  SequencedMapChange,
} from '../../src/index.js'
import { replication } from '../.shared/replication.js'

function observe(map: SequencedMap<string, number>) {
  const view = new Map(map)
  map.addEventListener('change', ({ detail }) => {
    for (const [key, value] of Object.entries(detail)) {
      if (value === undefined) view.delete(key)
      else view.set(key, value)
    }
    // Record properties carry values; current Map keys supply iteration order.
    const ordered = [...map.keys()].map((key) => [key, view.get(key)!] as const)
    view.clear()
    for (const [key, value] of ordered) view.set(key, value)
  })
  return view
}

describe('Map model convergence with registered participants', () => {
  it.each([1, 17, 0xc0ffee, 0xffffffff])(
    'converges offline set/delete edits and rendered entry order (seed %s)',
    (seed) => {
      const maps = [1, 2, 3].map(
        (actor) => new SequencedMap<string, number>(actor)
      )
      const transport = replication(maps, [1, 2, 3])
      const views = maps.map(observe)
      try {
        maps[0].set('base', 0)
        transport.flush(seed)
        maps.forEach((map, i) => {
          const model = new Map(map)
          map.set(`own-${i}`, i)
          model.set(`own-${i}`, i)
          map.set(`own-${i}`, i + 10)
          model.set(`own-${i}`, i + 10)
          map.set(`temporary-${i}`, -1)
          model.set(`temporary-${i}`, -1)
          map.delete(`temporary-${i}`)
          model.delete(`temporary-${i}`)
          map.set('shared', i)
          model.set('shared', i)
          expect([...map]).toEqual([...model])
          expect([...views[i]]).toEqual([...model])
        })
        transport.flush(seed, true)
        const expected = [...maps[0]]
        expect(maps[0].size).toBe(5)
        expect(maps[0].get('base')).toBe(0)
        maps.forEach((map, i) => {
          expect([...map]).toEqual(expected)
          expect([...views[i]]).toEqual(expected)
          for (const owner of [0, 1, 2])
            expect(map.get(`own-${owner}`)).toBe(owner + 10)
        })
        // All histories and replies have drained before this read-only hydration.
        const restored = new SequencedMap<string, number>(1, maps[0].toJSON())
        try {
          expect([...restored]).toEqual(expected)
        } finally {
          restored.destroy()
        }
      } finally {
        transport.close()
        maps.forEach((map) => map.destroy())
      }
    }
  )

  it('resolves duplicate keys by Projection order and delete removes every competing entry', () => {
    const maps = [1, 2, 3].map(
      (actor) => new SequencedMap<string, number>(actor)
    )
    const transport = replication(maps, [1, 2, 3])
    try {
      maps.forEach((map, i) => map.set('shared', i))
      transport.flush(17, true)
      const raw = new Projection<SequencedMapEntry<string, number>>(
        1,
        maps[0].toJSON()
      )
      try {
        expect(raw.values()).toHaveLength(3)
        const first = raw.values()[0][1]
        maps.forEach((map) => expect([...map]).toEqual([['shared', first]]))
      } finally {
        raw.destroy()
      }
      maps[0].set('shared', 99)
      transport.flush()
      maps.forEach((map) => expect(map.get('shared')).toBe(99))
      expect(maps[1].delete('shared')).toBe(true)
      expect(maps[1].has('shared')).toBe(false)
      transport.flush(1, true)
      maps.forEach((map) => {
        expect(map.size).toBe(0)
        expect([...map]).toEqual([])
      })
      maps[2].set('shared', 100)
      transport.flush()
      maps.forEach((map) => expect([...map]).toEqual([['shared', 100]]))
    } finally {
      transport.close()
      maps.forEach((map) => map.destroy())
    }
  })

  it('clear removes physical duplicates as well as visible keys', () => {
    const maps = [1, 2].map((actor) => new SequencedMap<string, number>(actor))
    const transport = replication(maps, [1, 2])
    try {
      maps[0].set('same', 1)
      maps[1].set('same', 2).set('other', 3)
      transport.flush()
      maps[0].clear()
      transport.flush()
      maps.forEach((map) => expect([...map]).toEqual([]))
    } finally {
      transport.close()
      maps.forEach((map) => map.destroy())
    }
  })

  it('merges concurrent insertions and preserves visible first-entry winners', () => {
    const maps = [1, 2].map((actor) => new SequencedMap<string, number>(actor))
    const transport = replication(maps, [1, 2])
    const views = maps.map(observe)
    try {
      maps[0].set('a', 1).set('shared', 10)
      maps[1].set('b', 2).set('shared', 20)
      const states = maps.map((map) => map.toJSON()) // Insertions only; no removal history to compact.
      maps[0].merge(states[1])
      maps[1].merge(states[0])
      transport.flush()
      expect([...maps[0]]).toEqual([...maps[1]])
      maps.forEach((map, i) => {
        expect(map.size).toBe(3)
        expect(map.get('a')).toBe(1)
        expect(map.get('b')).toBe(2)
        expect([...views[i]]).toEqual([...map])
      })
    } finally {
      transport.close()
      maps.forEach((map) => map.destroy())
    }
  })

  it('Map events can reproduce a remote insertion before existing keys', () => {
    const map = new SequencedMap<string, number>(1)
    map.apply([[1], [2]])
    map.set('a', 1).set('b', 2)
    const view = observe(map)
    const sender = new Projection<SequencedMapEntry<string, number>>(
      2,
      map.toJSON()
    )
    try {
      map.apply(sender.insert([['prefix', 0]], 0))
      expect([...map]).toEqual([
        ['prefix', 0],
        ['a', 1],
        ['b', 2],
      ])
      expect([...view]).toEqual([...map])
      // A hidden duplicate does not alter the Map view or emit a visible change.
      const changes: SequencedMapChange<string, number>[] = []
      map.addEventListener('change', ({ detail }) => changes.push(detail))
      map.apply(sender.insert([['a', 999]], sender.length()))
      expect(map.get('a')).toBe(1)
      expect(changes).toEqual([])
      expect(map.delete('a')).toBe(true)
      expect([...map]).toEqual([
        ['prefix', 0],
        ['b', 2],
      ])
      expect([...view]).toEqual([...map])
      expect(map.get('b')).toBe(2)
    } finally {
      sender.destroy()
      map.destroy()
    }
  })

  it('continues after all editors hydrate one completed checkpoint', () => {
    let maps = [1, 2].map((actor) => new SequencedMap<string, number>(actor))
    let transport = replication(maps, [1, 2])
    try {
      maps[0].set('a', 1).set('removed', 0)
      transport.flush()
      maps[1].delete('removed')
      transport.flush()
      const snapshot = JSON.parse(JSON.stringify(maps[0]))
      transport.close()
      maps.forEach((map) => map.destroy())
      maps = [1, 2].map(
        (actor) => new SequencedMap(actor, structuredClone(snapshot))
      )
      transport = replication(maps, [1, 2])
      maps[0].set('a', 10)
      maps[1].set('b', 2)
      transport.flush()
      const expected = [...maps[0]]
      maps.forEach((map) => {
        expect(map.size).toBe(2)
        expect(map.get('a')).toBe(10)
        expect(map.get('b')).toBe(2)
        expect([...map]).toEqual(expected)
      })
    } finally {
      transport.close()
      maps.forEach((map) => map.destroy())
    }
  })

  it('keeps synchronous replies and change consumers in local edit order', () => {
    const maps = [1, 2].map((actor) => new SequencedMap<string, number>(actor))
    maps.forEach((map) => map.apply([[1], [2]]))
    const views = maps.map(observe)
    let responded = false
    maps[1].addEventListener('change', () => {
      if (!responded && maps[1].has('a')) {
        responded = true
        maps[1].set('b', 2)
      }
    })
    maps[0].addEventListener('delta', ({ detail }) => maps[1].apply(detail))
    maps[1].addEventListener('delta', ({ detail }) => maps[0].apply(detail))
    try {
      maps[0].set('a', 1)
      maps.forEach((map, i) => {
        expect([...map]).toEqual([
          ['a', 1],
          ['b', 2],
        ])
        expect([...views[i]]).toEqual([...map])
      })
    } finally {
      maps.forEach((map) => map.destroy())
    }
  })
})
