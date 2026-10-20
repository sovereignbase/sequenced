import { beforeAll, describe, expect, it } from 'vitest'
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

const methods = [
  'every',
  'some',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'map',
  'flatMap',
  'forEach',
] as const

describe('SequencedArray callbacks and iterators', () => {
  it.each(methods)(
    '%s passes value, index, receiver and thisArg in native order',
    (method) => {
      const values = [1, 2, 3, 4]
      const replica = new ArrayReplica(1, arraySnapshot(values))
      const context = { threshold: 3 }
      const observe = (array: ArraySubject<number> | number[]) => {
        const calls: unknown[] = []
        const callback = function (
          this: typeof context,
          value: number,
          index: number,
          receiver: number[]
        ) {
          calls.push([value, index, receiver === array, this === context])
          return value < this.threshold
        }
        return {
          result: Reflect.apply(array[method], array, [callback, context]),
          calls,
        }
      }
      expect(observe(replica)).toEqual(observe(values))
    }
  )

  it.each(methods)('%s propagates callback exceptions', (method) => {
    const replica = new ArrayReplica(1, arraySnapshot([1, 2]))
    const failure = new Error('callback failed')
    expect(() =>
      Reflect.apply(replica[method], replica, [
        () => {
          throw failure
        },
      ])
    ).toThrow(failure)
  })

  it.each(methods)('%s rejects a non-callable callback', (method) => {
    const replica = new ArrayReplica(1, arraySnapshot([1]))
    expect(() => Reflect.apply(replica[method], replica, [null])).toThrow(
      TypeError
    )
  })

  it.each(['reduce', 'reduceRight'] as const)(
    '%s passes the accumulator and receiver',
    (method) => {
      const values = [1, 2, 3]
      const replica = new ArrayReplica(1, arraySnapshot(values))
      const observe = (array: ArraySubject<number> | number[]) => {
        const calls: unknown[] = []
        const callback = (acc: number, value: number, index: number, receiver: unknown) => {
          calls.push([acc, value, index, receiver === array])
          return acc - value
        }
        const result = Reflect.apply(array[method], array, [callback, 10])
        return { result, calls }
      }
      expect(observe(replica)).toEqual(observe(values))
    }
  )

  it('forEach captures the initial length but observes edits to pending values', () => {
    const observe = (array: ArraySubject<number> | number[]) => {
      const visited: number[] = []
      array.forEach((value, index) => {
        visited.push(value)
        if (index === 0) {
          array.push(4)
          array.splice(1, 1, 20)
        }
      })
      return { visited, values: [...array] }
    }
    expect(observe(new ArrayReplica(1, arraySnapshot([1, 2, 3])))).toEqual(
      observe([1, 2, 3])
    )
  })

  it('map observes truncation during a callback', () => {
    const observe = (array: ArraySubject<number> | number[]) =>
      array.map((value, index) => {
        if (index === 0) array.length = 1
        return value * 2
      })
    expect(observe(new ArrayReplica(1, arraySnapshot([1, 2, 3])))).toEqual(
      observe([1, 2, 3])
    )
  })

  it.each(['entries', 'keys', 'values', Symbol.iterator] as const)(
    '%s iterator observes subsequent append and replacement',
    (method) => {
      const observe = (array: ArraySubject<number> | number[]) => {
        const iterator = array[method]()
        const first = iterator.next()
        array.splice(1, 1, 20)
        array.push(4)
        return [first, [...iterator], iterator.next()]
      }
      expect(observe(new ArrayReplica(1, arraySnapshot([1, 2, 3])))).toEqual(
        observe([1, 2, 3])
      )
    }
  )
})
