import { Projection } from '@sovereignbase/sequencer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SequencedError } from '../../../src/index.js'
import { SequencedMap } from '../../../src/SequencedMap/class.js'
import type {
  SequencedMapEntry,
  SequencedMapSnapshot,
} from '../../../src/index.js'
import { mapSnapshot } from '../map.js'

type Entry = SequencedMapEntry<string | number, unknown>
const maps: SequencedMap<string | number, unknown>[] = []
function create(entries: Entry[] = []) {
  const map = new SequencedMap<string | number, unknown>(
    1,
    mapSnapshot(entries)
  )
  maps.push(map)
  return map
}
afterEach(() => {
  vi.restoreAllMocks()
  maps.splice(0).forEach((map) => map.destroy())
})

describe('Map entries, index and events', () => {
  it('constructor keeps the first duplicate key and removes later physical entries', () => {
    const map = create([
      ['a', 1],
      [1, 2],
      ['a', 3],
      ['1', 4],
      [1, 5],
      [-0, 6],
      [0, 7],
    ])
    expect([...map]).toEqual([
      ['a', 1],
      [1, 2],
      ['1', 4],
      [0, 6],
    ])
    const raw = new Projection<Entry>(2, map.toJSON())
    try {
      expect([...new Map(raw.values())]).toEqual([...map])
      expect(raw.length()).toBe(4)
    } finally {
      raw.destroy()
    }
    map.set('1', 40)
    map.delete('a')
    expect([...map]).toEqual([
      [1, 2],
      ['1', 40],
      [0, 6],
    ])
  })

  it.each([
    null,
    undefined,
    ['a'],
    ['a', 1, 2],
    [{}, 1],
    [NaN, 1],
    [Infinity, 1],
  ])('rejects an invalid snapshot entry %j', (entry) => {
    const snapshot = mapSnapshot([entry as unknown as Entry])
    expect(() => new SequencedMap(1, snapshot)).toThrow(SequencedError)
  })

  it('uses Projection positions for reads and replaces existing keys in place', () => {
    const map = create([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    const read = vi.spyOn(Projection.prototype, 'value')
    const replace = vi.spyOn(Projection.prototype, 'replace')
    const insert = vi.spyOn(Projection.prototype, 'insert')
    map.get('b')
    expect(read).toHaveBeenLastCalledWith(1)
    map.set('b', 20)
    expect(replace).toHaveBeenLastCalledWith([['b', 20]], 1, 1)
    expect(insert).not.toHaveBeenCalled()
    map.delete('a')
    expect(map.get('c')).toBe(3)
    expect(read).toHaveBeenLastCalledWith(1)
    map.set('d', 4)
    expect(insert).toHaveBeenLastCalledWith([['d', 4]], 2)
    map.delete('d')
    expect(map.get('b')).toBe(20)
  })

  it('emits value records with undefined for delete and clear', () => {
    const map = create()
    const change = vi.fn()
    const delta = vi.fn()
    map.addEventListener('change', change)
    map.addEventListener('delta', delta)
    for (const edit of [
      () => map.set(1, undefined),
      () => map.set('1', 2),
      () => map.set(1, 3),
      () => map.delete('1'),
      () => map.set('1', 4),
      () => map.clear(),
    ]) {
      edit()
    }
    expect(change.mock.calls.map(([event]) => event.detail)).toEqual([
      { 1: undefined },
      { 1: 2 },
      { 1: 3 },
      { 1: undefined },
      { 1: 4 },
      { 1: undefined },
    ])
    expect(Object.hasOwn(change.mock.calls[3][0].detail, '1')).toBe(true)
    expect(delta).toHaveBeenCalledTimes(6)
    map.clear()
    map.delete('missing')
    map.get('missing')
    map.has('missing')
    map.toJSON()
    expect(delta).toHaveBeenCalledTimes(6)
  })

  it('treats __proto__ and constructor as ordinary change keys', () => {
    const map = create()
    const change = vi.fn()
    map.addEventListener('change', change)
    map.set('__proto__', 1)
    map.set('constructor', 2)
    map.clear()
    const expected: Array<Record<string, unknown>> = [
      { ['__proto__']: 1 },
      { constructor: 2 },
      { ['__proto__']: undefined, constructor: undefined },
    ]
    expect(change.mock.calls.map(([event]) => event.detail)).toEqual(expected)
    expect(Object.getPrototypeOf(change.mock.calls[0][0].detail)).toBe(
      Object.prototype
    )
  })

  describe.each(['apply', 'merge'] as const)('%s forwarding', (method) => {
    it.each(
      [null, ['a'], ['a', 1, 2], [{}, 1], [NaN, 1], [Infinity, 1]].map(
        (entry) => ({ entry })
      )
    )(
      'rejects a malformed Map entry without throwing or changing state: %j',
      ({ entry }) => {
        const map = create([['existing', 1]])
        const sender = new Projection<unknown>(2)
        try {
          const delta = sender.insert([['valid', 2], entry], 0)
          const input = method === 'apply' ? delta : sender.sequence()
          const engine = vi.spyOn(Projection.prototype, method)
          const change = vi.fn()
          map.addEventListener('change', change)
          expect(() => Reflect.apply(map[method], map, [input])).not.toThrow()
          expect(engine).not.toHaveBeenCalled()
          expect(change).not.toHaveBeenCalled()
          expect([...map]).toEqual([['existing', 1]])
          map.set('after', 3)
          expect([...map]).toEqual([
            ['existing', 1],
            ['after', 3],
          ])
        } finally {
          sender.destroy()
        }
      }
    )

    it.each(
      [undefined, null, 0, false, 'invalid', [], [null], [[], null]].map(
        (input) => ({ input })
      )
    )('does not throw for malformed transport input %j', ({ input }) => {
      const map = create([['a', 1]])
      expect(() => Reflect.apply(map[method], map, [input])).not.toThrow()
      expect([...map]).toEqual([['a', 1]])
    })

    it('does not throw after destruction', () => {
      const map = create()
      map.destroy()
      expect(() => map[method]([[], []])).not.toThrow()
    })

    it('forwards the original input and reply; visible events use Map keys', () => {
      const map = create([['a', 1]])
      const input: unknown = method === 'apply' ? [[1], [2]] : [[], []]
      const reply = [[1]] as const
      vi.spyOn(Projection.prototype, 'values').mockImplementation(() => {
        throw new Error('apply/merge must not read the entire Projection')
      })
      const engine = vi.spyOn(Projection.prototype, method).mockReturnValue([
        [
          [
            0,
            1,
            [
              ['a', 2],
              [1, undefined],
            ],
          ],
        ],
        reply,
      ])
      vi.spyOn(Projection.prototype, 'value').mockImplementation(
        (at) =>
          [
            ['a', 2],
            [1, undefined],
          ][at]
      )
      const changes = vi.fn()
      const delta = vi.fn()
      map.addEventListener('change', changes)
      map.addEventListener('delta', delta)
      if (method === 'apply') map.apply(input)
      else map.merge(input as SequencedMapSnapshot<string | number, unknown>)
      expect(engine).toHaveBeenCalledExactlyOnceWith(input)
      expect(engine.mock.calls[0][0]).toBe(input)
      expect(delta.mock.calls[0][0].detail).toBe(reply)
      expect(changes.mock.calls[0][0].detail).toEqual({ a: 2, 1: undefined })
    })

    it('ack-only and unchanged results do not invent visible changes', () => {
      const map = create()
      const listener = vi.fn()
      map.addEventListener('change', listener)
      map.addEventListener('delta', listener)
      const engine = vi.spyOn(Projection.prototype, method)
      for (const result of [undefined, [[]], [[], []]] as const) {
        engine.mockReturnValue(result)
        map[method]([[], []])
      }
      expect(listener).not.toHaveBeenCalled()
      const error = new Error('engine failure')
      engine.mockImplementation(() => {
        throw error
      })
      expect(() => map[method]([[], []])).not.toThrow()
      expect(listener).not.toHaveBeenCalled()
    })
  })

  it('rejects insertion footage with missing Map entries without throwing', () => {
    const map = create([['existing', 1]])
    const sender = new Projection<Entry>(2)
    try {
      const insertion = sender.insert(
        [
          ['a', 1],
          ['b', 2],
        ],
        0
      )
      const tuple = insertion.find((item) => Array.isArray(item[0]))!
      const words = tuple[0]
      for (const footage of [undefined, [], [['a', 1]]]) {
        expect(() => map.apply([[words, footage]])).not.toThrow()
        expect([...map]).toEqual([['existing', 1]])
      }
    } finally {
      sender.destroy()
    }
  })

  it('delegates a malformed gossip batch unchanged without throwing', () => {
    const map = create()
    const raw = new Projection<Entry>(2)
    try {
      const delta = raw.insert([['a', 1]], 0)
      const input = [...delta, null]
      const engine = vi.spyOn(Projection.prototype, 'apply')
      expect(() => map.apply(input)).not.toThrow()
      expect(engine).toHaveBeenCalledExactlyOnceWith(input)
    } finally {
      raw.destroy()
    }
  })

  it('snapshot is JSON serializable, including finite numeric and empty string keys', () => {
    const map = create([
      ['', 1],
      [-0, 2],
      ['0', 3],
      [Number.MAX_VALUE, 4],
      [Number.MIN_VALUE, 5],
    ])
    const listener = vi.fn()
    map.addEventListener('snapshot', listener)
    map.snapshot()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toBeInstanceOf(CustomEvent)
    expect(listener.mock.calls[0][0].detail).toEqual(map.toJSON())
    const restored = new SequencedMap<string | number, unknown>(
      2,
      JSON.parse(JSON.stringify(map))
    )
    maps.push(restored)
    expect([...restored]).toEqual([...map])
  })

  it('normalizes typed snapshot metadata without changing entry identities', () => {
    const map = create()
    const entries = [['a', 1]] as Entry[]
    vi.spyOn(Projection.prototype, 'sequence').mockReturnValue([
      Uint32Array.from([0, 1]),
      entries,
    ])
    const result = map.toJSON()
    expect(result).toEqual([[0, 1], entries])
    expect(result[1]).toBe(entries)
  })

  it('supports EventTarget removal, once, objects, AbortSignal and manual dispatch', () => {
    const map = create()
    const removed = vi.fn(),
      once = vi.fn(),
      aborted = vi.fn()
    const object = { handleEvent: vi.fn() }
    const controller = new AbortController()
    map.removeEventListener('snapshot', removed)
    map.dispatchEvent('snapshot', [[], []])
    map.addEventListener('snapshot', removed)
    map.removeEventListener('snapshot', removed)
    map.addEventListener('snapshot', once, { once: true })
    map.addEventListener('snapshot', object)
    map.addEventListener('snapshot', aborted, { signal: controller.signal })
    controller.abort()
    const detail = map.toJSON()
    map.dispatchEvent('snapshot', detail)
    expect(object.handleEvent.mock.calls[0][0].detail).toBe(detail)
    map.snapshot()
    expect(once).toHaveBeenCalledTimes(1)
    expect(removed).not.toHaveBeenCalled()
    expect(aborted).not.toHaveBeenCalled()
    expect(object.handleEvent).toHaveBeenCalledTimes(2)
    map.removeEventListener('snapshot', object)
    map.snapshot()
    expect(object.handleEvent).toHaveBeenCalledTimes(2)
    map.destroy()
    map.destroy()
  })
})
