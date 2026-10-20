import { beforeAll, describe, expect, it } from 'vitest'
import { SequencedError } from '../../../../src/errors/class.js'
import {
  arraySnapshot,
  loadArray,
  type ArrayConstructor,
  type ArraySubject,
} from '../../array.js'

let ArrayReplica: ArrayConstructor
beforeAll(async () => {
  ArrayReplica = await loadArray()
})

type Mutation = (array: ArraySubject<number> | number[]) => unknown
const cases: [string, Mutation][] = [
  ['push()', (a) => a.push()],
  ['push multiple', (a) => a.push(8, 9)],
  ['pop', (a) => a.pop()],
  ['shift', (a) => a.shift()],
  ['unshift()', (a) => a.unshift()],
  ['unshift multiple', (a) => a.unshift(8, 9)],
  ['reverse', (a) => a.reverse()],
  ['sort default', (a) => a.sort()],
  ['sort numeric', (a) => a.sort((a, b) => a - b)],
  ['fill all', (a) => a.fill(7)],
  ['fill middle', (a) => a.fill(7, 1, 3)],
  ['fill negative', (a) => a.fill(7, -3, -1)],
  ['fill clamped', (a) => a.fill(7, -100, Infinity)],
  ['fill reversed', (a) => a.fill(7, 4, 1)],
  ['copyWithin overlapping forward', (a) => a.copyWithin(1, 0, 3)],
  ['copyWithin overlapping backward', (a) => a.copyWithin(0, 1)],
  ['copyWithin negative', (a) => a.copyWithin(-2, 0, 3)],
  ['copyWithin clamped', (a) => a.copyWithin(100, -100, Infinity)],
  ['splice()', (a) => Reflect.apply(a.splice, a, [])],
  ['splice omitted deleteCount', (a) => a.splice(2)],
  [
    'splice explicit undefined deleteCount',
    (a) => a.splice(2, undefined as unknown as number, 9),
  ],
  ['splice insert', (a) => a.splice(2, 0, 8, 9)],
  ['splice replace', (a) => a.splice(1, 2, 8, 9, 10)],
  ['splice remove', (a) => a.splice(1, 2)],
  ['splice negative start', (a) => a.splice(-2, 1, 8)],
  ['splice very negative start', (a) => a.splice(-100, 1, 8)],
  ['splice start past end', (a) => a.splice(100, 3, 8)],
  ['splice negative count', (a) => a.splice(1, -3, 8)],
  ['splice infinite count', (a) => a.splice(1, Infinity)],
  ['splice fractional arguments', (a) => a.splice(1.8, 2.8, 8)],
  ['splice NaN', (a) => a.splice(NaN, NaN, 8)],
]

describe('SequencedArray mutation equivalence', () => {
  describe.each([
    { initial: [] as number[] },
    { initial: [1] },
    { initial: [3, 2, 10, 2, 1] },
  ])('initial values $initial', ({ initial }) => {
    it.each(cases)('%s matches native values and return value', (_, mutate) => {
      const native = initial.slice()
      const replica = new ArrayReplica(1, arraySnapshot(initial))
      const expected = mutate(native)
      const actual = mutate(replica)
      if (expected === native) expect(actual).toBe(replica)
      else expect(actual).toEqual(expected)
      expect([...replica]).toEqual(native)
      expect(replica.length).toBe(native.length)
    })
  })

  it.each([0, 1, 3, 5, 8])(
    'length=%s matches native visible values',
    (length) => {
      const native = [1, 2, 3, 4, 5]
      const replica = new ArrayReplica(1, arraySnapshot(native))
      native.length = length
      replica.length = length
      // Iteration observes grown slots as undefined; sparse descriptors are out of scope.
      expect([...replica]).toEqual([...native])
      expect(replica.length).toBe(native.length)
    }
  )

  it.each([-1, 1.5, NaN, Infinity, 2 ** 32])(
    'rejects invalid length %s',
    (length) => {
      const replica = new ArrayReplica(1, arraySnapshot([1, 2, 3]))
      expect(() => {
        replica.length = length
      }).toThrow(SequencedError)
      expect([...replica]).toEqual([1, 2, 3])
    }
  )

  it('keeps sort stable for equal comparator results', () => {
    const native = [
      { group: 2, id: 'a' },
      { group: 1, id: 'b' },
      { group: 2, id: 'c' },
      { group: 1, id: 'd' },
    ]
    const replica = new ArrayReplica(1, arraySnapshot(native))
    const comparator = (
      a: (typeof native)[number],
      b: (typeof native)[number]
    ) => a.group - b.group
    expect(replica.sort(comparator)).toBe(replica)
    expect([...replica]).toEqual(native.sort(comparator))
  })

  it('matches native state through a reproducible mixed edit history', () => {
    let seed = 0x51ced
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed
    }
    const native: number[] = []
    const replica = new ArrayReplica<number>(1)
    for (let step = 0; step < 300; step++) {
      const at = (random() % (native.length + 3)) - 1
      const value = random() % 100
      const count = random() % 4
      const operations: Mutation[] = [
        (a) => a.push(value),
        (a) => a.pop(),
        (a) => a.shift(),
        (a) => a.unshift(value),
        (a) => a.splice(at, count, value),
        (a) => a.reverse(),
        (a) => a.fill(value, at, at + count),
        (a) => a.copyWithin(at, 0, count),
      ]
      const mutate = operations[(random() >>> 8) % operations.length]
      const expected = mutate(native)
      const actual = mutate(replica)
      if (expected === native) expect(actual, `step ${step}`).toBe(replica)
      else expect(actual, `step ${step}`).toEqual(expected)
      expect([...replica], `step ${step}, seed 0x51ced`).toEqual(native)
    }
  })
})
