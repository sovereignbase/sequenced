import { afterEach, describe, expect, it, vi } from 'vitest'
import { inspect } from 'node:util'
import { Sequenced, SequencedMap, SequencedError } from '../../../src/index.js'
import type { SerializableKey as Key } from '../../../src/index.js'
import { mapSnapshot } from '../map.js'

const maps: SequencedMap<Key, unknown>[] = []
function create<V>(entries: Array<readonly [Key, V]> = []) {
  const map = new SequencedMap<Key, V>(1, mapSnapshot(entries))
  maps.push(map)
  return map
}
afterEach(() => maps.splice(0).forEach((map) => map.destroy()))

const initial: Array<[Key, number | undefined]> = [
  ['a', 1],
  [1, 2],
  ['1', 3],
  ['', undefined],
  [0, 5],
]
type Subject =
  Map<Key, number | undefined> | SequencedMap<Key, number | undefined>
const cases: Array<[string, (map: Subject) => unknown]> = [
  ['size', (map) => map.size],
  ...[
    'a',
    1,
    '1',
    '',
    0,
    -0,
    'missing',
    -2,
    2.5,
    Number.MAX_VALUE,
    '__proto__',
  ].flatMap((key): Array<[string, (map: Subject) => unknown]> => [
    [`get ${key}`, (map) => map.get(key)],
    [`has ${key}`, (map) => map.has(key)],
    [`delete ${key}`, (map) => map.delete(key)],
    [`set ${key}`, (map) => map.set(key, 99)],
  ]),
  ['clear', (map) => map.clear()],
  ['keys', (map) => [...map.keys()]],
  ['values', (map) => [...map.values()]],
  ['entries', (map) => [...map.entries()]],
  ['iterator', (map) => [...map]],
  [
    'forEach',
    (map) => {
      const visited: unknown[] = []
      const context = {}
      const result = map.forEach(function (
        this: unknown,
        value,
        key,
        receiver
      ) {
        visited.push([key, value, receiver === map, this === context])
      }, context)
      return { result, visited }
    },
  ],
  ['String', (map) => String(map)],
  ['Object toString', (map) => Object.prototype.toString.call(map)],
]

describe('Map native equivalence for JSON keys', () => {
  it('exposes all native Map instance methods', () => {
    expect(Sequenced.Map).toBe(SequencedMap)
    const map = create()
    const names = Object.getOwnPropertyNames(Map.prototype).filter(
      (key) => !['constructor', 'size'].includes(key)
    )
    expect(names.sort()).toEqual(
      [
        'clear',
        'delete',
        'entries',
        'forEach',
        'get',
        'has',
        'keys',
        'set',
        'values',
      ].sort()
    )
    for (const name of names)
      expect(Reflect.get(map, name)).toBeTypeOf('function')
    expect([...map]).toEqual([])
    expect(map.size).toBe(0)
  })

  describe.each([{ entries: [] as typeof initial }, { entries: initial }])(
    'initial $entries',
    ({ entries }) => {
      it.each(cases)(
        '%s matches native return value, identity, contents and order',
        (_, action) => {
          const native = new Map(entries)
          const map = create(entries)
          const expected = action(native)
          const actual = action(map)
          if (expected === native) expect(actual).toBe(map)
          else expect(actual).toEqual(expected)
          expect([...map]).toEqual([...native])
          expect(map.size).toBe(native.size)
        }
      )
    }
  )

  it('set retains existing positions; delete/reinsert moves a key to the end', () => {
    const map = create(initial)
    const native = new Map(initial)
    for (const subject of [map, native]) {
      subject.set('a', 10)
      subject.set(1, undefined)
      subject.delete('a')
      subject.set('a', 20)
      subject.delete('1')
      subject.set('tail', 30)
    }
    expect([...map]).toEqual([...native])
    expect(map.get('')).toBeUndefined()
    expect(map.has('')).toBe(true)
  })

  it('canonicalizes -0 while keeping numeric and string keys distinct', () => {
    const map = create<unknown>()
    const native = new Map<Key, unknown>()
    for (const key of [
      -0,
      '0',
      0,
      -1,
      '-1',
      Number.MIN_VALUE,
      Number.MAX_VALUE,
      '',
    ]) {
      map.set(key, key)
      native.set(key, key)
    }
    expect([...map]).toEqual([...native])
    expect(Object.is(map.keys().next().value, -0)).toBe(false)
  })

  it('keeps shallow value identity and returns fresh entry containers', () => {
    const object = { count: 0 }
    const map = create([['x', object]])
    expect(map.get('x')).toBe(object)
    expect(map.values().next().value).toBe(object)
    const entry = map.entries().next().value!
    expect(entry[1]).toBe(object)
    entry[0] = 'different'
    object.count++
    expect(map.has('different')).toBe(false)
    expect(map.get('x')!.count).toBe(1)
  })

  it.each(['keys', 'values', 'entries', Symbol.iterator] as const)(
    '%s iterator observes native edits and stays exhausted',
    (method) => {
      const observe = (map: Subject) => {
        const iterator = map[method]()
        const first = iterator.next()
        map.set('a', 99)
        map.delete(1)
        map.set('tail', 9)
        map.set(1, 20)
        const rest = [...iterator]
        map.set('after exhaustion', 1)
        return { first, rest, done: iterator.next() }
      }
      expect(observe(create(initial))).toEqual(observe(new Map(initial)))
    }
  )

  it.each(['keys', 'values', 'entries'] as const)(
    '%s iterator survives clear and subsequent insertion',
    (method) => {
      const observe = (map: Subject) => {
        const iterator = map[method]()
        const first = iterator.next()
        map.clear()
        map.set('new', 1)
        return [first, [...iterator]]
      }
      expect(observe(create(initial))).toEqual(observe(new Map(initial)))
    }
  )

  it('forEach sees changes to pending values, deletions and new keys', () => {
    const observe = (map: Subject) => {
      const visits: unknown[] = []
      map.forEach((value, key) => {
        visits.push([key, value])
        if (key === 'a') {
          map.set(1, 99)
          map.delete('1')
          map.set('tail', 20)
        }
      })
      return { visits, entries: [...map] }
    }
    expect(observe(create(initial))).toEqual(observe(new Map(initial)))
  })

  it('forEach observes clear/reinsertion, callback identity and exceptions', () => {
    const observe = (map: Subject) => {
      const visits: unknown[] = []
      map.forEach((value, key) => {
        visits.push([key, value])
        if (key === 'a') {
          map.clear()
          map.set('new', 10)
        }
      })
      return visits
    }
    const map = create(initial)
    expect(observe(map)).toEqual(observe(new Map(initial)))
    const callback = Object.assign(vi.fn(), { call: null })
    map.forEach(callback)
    expect(callback).toHaveBeenCalledWith(10, 'new', map)
    const error = new Error('callback')
    expect(() =>
      map.forEach(() => {
        throw error
      })
    ).toThrow(error)
    expect(() => Reflect.apply(map.forEach, map, [null])).toThrow(
      SequencedError
    )
    expect(() => Reflect.apply(create().forEach, create(), [null])).toThrow(
      SequencedError
    )
  })

  it.each([
    undefined,
    null,
    true,
    {},
    [],
    new String('key'),
    Symbol('key'),
    1n,
    NaN,
    Infinity,
    -Infinity,
  ])('rejects non-JSON key %s without changing state', (key) => {
    const map = create(initial)
    for (const method of ['get', 'has', 'delete', 'set'] as const)
      expect(() => Reflect.apply(map[method], map, [key, 99])).toThrow(
        SequencedError
      )
    expect([...map]).toEqual(initial)
  })

  it.each([1, 17, 0xc0ffee, 0xffffffff])(
    'matches seeded local Map edits (seed %s)',
    (seed) => {
      const map = create<number>()
      const native = new Map<Key, number>()
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed >>> 8
      }
      for (let step = 0; step < 400; step++) {
        const id = random() % 12
        const key = random() % 2 ? String(id) : id
        const value = random()
        switch (random() % 5) {
          case 0:
            expect(map.delete(key)).toBe(native.delete(key))
            break
          case 1:
            expect(map.get(key)).toBe(native.get(key))
            break
          case 2:
            expect(map.has(key)).toBe(native.has(key))
            break
          case 3:
            if (random() % 8 === 0) {
              map.clear()
              native.clear()
              break
            }
          default:
            expect(map.set(key, value)).toBe(map)
            native.set(key, value)
        }
        expect([...map], `step ${step}`).toEqual([...native])
        expect(map.size).toBe(native.size)
      }
    }
  )

  it('inspect exposes the native Map view', () => {
    const map = create(initial)
    expect(inspect(map)).toBe(inspect(new Map(initial)))
    expect(
      Reflect.apply(Reflect.get(map, Symbol.for('Deno.customInspect')), map, [])
    ).toEqual(new Map(initial))
  })
})
