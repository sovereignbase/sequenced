import { describe, expect, it, vi } from 'vitest'
import { SequencedArray } from '../../../../src/SequencedArray/class.js'
import { SequencedError } from '../../../../src/errors/class.js'
import { arraySnapshot } from '../../array.js'
import { inspect } from 'node:util'

describe('SequencedArray implementation regressions', () => {
  it('flatMap skips holes in returned native arrays', () => {
    const replica = new SequencedArray(1, arraySnapshot([1, 2]))
    const flatten = (value: number) => [value, , value + 1]
    try {
      expect(replica.flatMap(flatten)).toEqual([1, 2].flatMap(flatten))
    } finally {
      replica.destroy()
    }
  })

  it('console inspection exposes visible values', () => {
    const replica = new SequencedArray(1, arraySnapshot([1, 2]))
    try {
      expect(inspect(replica)).toBe(inspect([1, 2]))
      expect(
        Reflect.apply(
          Reflect.get(replica, Symbol.for('Deno.customInspect')),
          replica,
          []
        )
      ).toEqual([1, 2])
    } finally {
      replica.destroy()
    }
  })
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
        expect(() => replica.set(index, 1)).toThrow(SequencedError)
        expect(() => replica.delete(index)).toThrow(SequencedError)
      }
      expect(listener).not.toHaveBeenCalled()
      expect([...replica]).toEqual([])
    } finally {
      replica.destroy()
      replica.destroy()
    }
  })
})
