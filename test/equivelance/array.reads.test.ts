import { beforeAll, describe, expect, it } from 'vitest'
import { SequencedError } from '../../src/errors/class.js'
import {
  arraySnapshot,
  loadArray,
  type ArrayConstructor,
  type ArraySubject,
} from '../.shared/array.js'

let ArrayReplica: ArrayConstructor
beforeAll(async () => {
  ArrayReplica = await loadArray()
})

type ReadCase = [
  name: string,
  read: (array: ArraySubject<number> | number[]) => unknown,
]
const cases: ReadCase[] = [
  ['at()', (a) => a.at(0)],
  ...[-Infinity, -20, -5, -1.8, -1, -0, 1.8, 4, 5, 20, Infinity, NaN].map(
    (at): ReadCase => [`at(${at})`, (a) => a.at(at)]
  ),
  ['concat()', (a) => a.concat()],
  ['concat(values, array)', (a) => a.concat(7, [8, 9])],
  ['entries', (a) => [...a.entries()]],
  ['keys', (a) => [...a.keys()]],
  ['values', (a) => [...a.values()]],
  ['iterator', (a) => [...a]],
  ['every', (a) => Reflect.apply(a.every, a, [(x: number) => x > 0])],
  ['every false', (a) => Reflect.apply(a.every, a, [(x: number) => x < 2])],
  ['filter', (a) => Reflect.apply(a.filter, a, [(x: number) => x % 2 === 0])],
  ['find', (a) => Reflect.apply(a.find, a, [(x: number) => x === 2])],
  ['find missing', (a) => Reflect.apply(a.find, a, [(x: number) => x === 99])],
  ['findIndex', (a) => a.findIndex((x) => x === 2)],
  ['findIndex missing', (a) => a.findIndex((x) => x === 99)],
  [
    'findLast',
    (a) => Reflect.apply(a.findLast, a, [(x: number) => x % 2 === 0]),
  ],
  ['findLastIndex', (a) => a.findLastIndex((x) => x === 2)],
  ['findLastIndex missing', (a) => a.findLastIndex((x) => x === 99)],
  ['flatMap', (a) => Reflect.apply(a.flatMap, a, [(x: number) => [x, x + 1]])],
  [
    'forEach',
    (a) => {
      const values: number[] = []
      a.forEach((x) => values.push(x))
      return values
    },
  ],
  ['includes', (a) => a.includes(2)],
  ['includes missing', (a) => a.includes(99)],
  ['indexOf', (a) => a.indexOf(2)],
  ['lastIndexOf', (a) => a.lastIndexOf(2)],
  ['join default', (a) => a.join()],
  ['join separator', (a) => a.join(' / ')],
  ['map', (a) => a.map((x, index) => x + index)],
  [
    'reduce with initial',
    (a) =>
      Reflect.apply(a.reduce, a, [(sum: number, x: number) => sum + x, 10]),
  ],
  [
    'reduce without initial',
    (a) => Reflect.apply(a.reduce, a, [(sum: number, x: number) => sum + x]),
  ],
  [
    'reduceRight',
    (a) =>
      Reflect.apply(a.reduceRight, a, [
        (sum: number, x: number) => sum - x,
        10,
      ]),
  ],
  [
    'reduceRight without initial',
    (a) =>
      Reflect.apply(a.reduceRight, a, [(sum: number, x: number) => sum - x]),
  ],
  ['slice()', (a) => a.slice()],
  ['slice middle', (a) => a.slice(1, 3)],
  ['slice negative', (a) => a.slice(-3, -1)],
  ['slice reversed', (a) => a.slice(3, 1)],
  ['slice clamped', (a) => a.slice(-100, Infinity)],
  ['some', (a) => a.some((x) => x === 2)],
  ['some missing', (a) => a.some((x) => x === 99)],
  ['toReversed', (a) => a.toReversed()],
  ['toSorted default', (a) => a.toSorted()],
  ['toSorted comparator', (a) => a.toSorted((a, b) => b - a)],
  ['toSpliced()', (a) => Reflect.apply(a.toSpliced, a, [])],
  ['toSpliced delete tail', (a) => a.toSpliced(1)],
  ['toSpliced replace', (a) => a.toSpliced(-2, 1, 9, 10)],
  ['with positive', (a) => a.with(1, 9)],
  ['with negative', (a) => a.with(-1, 9)],
  ['toString', (a) => a.toString()],
  ['toLocaleString', (a) => a.toLocaleString('fi-FI')],
]

describe('SequencedArray read equivalence', () => {
  it.each(cases)(
    '%s returns the native result without mutating the source',
    (_, read) => {
      const values = [3, 2, 10, 2, 1]
      const replica = new ArrayReplica(1, arraySnapshot(values))
      expect(read(replica)).toEqual(read(values.slice()))
      expect([...replica]).toEqual(values)
    }
  )

  it.each([-Infinity, -10, -2, -1, 0, 1.5, 3, Infinity, NaN])(
    'matches search fromIndex=%s including NaN and signed zero',
    (from) => {
      const values = [NaN, 0, -0, 2, 2]
      const replica = new ArrayReplica(1, arraySnapshot(values))
      for (const needle of [NaN, 0, -0, 2, 99]) {
        expect(replica.includes(needle, from)).toBe(
          values.includes(needle, from)
        )
        expect(replica.indexOf(needle, from)).toBe(values.indexOf(needle, from))
        expect(replica.lastIndexOf(needle, from)).toBe(
          values.lastIndexOf(needle, from)
        )
      }
    }
  )

  it('matches empty array results and scopes reduction errors', () => {
    const replica = new ArrayReplica<number>(1)
    for (const [name, read] of cases) {
      if (
        name === 'reduce without initial' ||
        name === 'reduceRight without initial'
      ) {
        expect(() => read([])).toThrow(TypeError)
        expect(() => read(replica)).toThrow(SequencedError)
        expect(() => read(replica)).toThrowError(
          expect.objectContaining({ code: 'REDUCE_EMPTY_ARRAY' })
        )
        continue
      }
      const outcome = (array: ArraySubject<number> | number[]) => {
        try {
          return { value: read(array) }
        } catch (error) {
          return { error: (error as Error).constructor.name }
        }
      }
      expect(outcome(replica), name).toEqual(outcome([]))
    }
  })

  it.each([-6, 5, Infinity, -Infinity])(
    'with(%s) throws RangeError',
    (index) => {
      const replica = new ArrayReplica(1, arraySnapshot([1, 2, 3, 4, 5]))
      expect(() => replica.with(index, 0)).toThrow(RangeError)
    }
  )

  it('flattens nested arrays at the same depths', () => {
    const values = [1, [2, [3, [4]]], [], 5]
    const replica = new ArrayReplica(1, arraySnapshot(values))
    for (const depth of [undefined, 0, 1, 2, Infinity, -1, NaN])
      expect(replica.flat(depth)).toEqual(values.flat(depth))
  })

  it('matches joins for null, undefined and nested arrays', () => {
    const values = [null, undefined, [1, 2], 'x']
    const replica = new ArrayReplica(1, arraySnapshot(values))
    expect(replica.join('|')).toBe(values.join('|'))
    expect(replica.toString()).toBe(values.toString())
  })

  it('returns independent plain arrays from copying methods', () => {
    const replica = new ArrayReplica(1, arraySnapshot([1, 2, 3]))
    const copies = [
      replica.slice(),
      replica.map((x) => x),
      replica.filter(() => true),
      replica.concat(),
      replica.toReversed(),
      replica.toSorted(),
      replica.toSpliced(1, 1),
      replica.with(0, 9),
    ]
    for (const copy of copies) {
      expect(Array.isArray(copy)).toBe(true)
      copy.push(99)
      expect([...replica]).toEqual([1, 2, 3])
    }
  })
})
