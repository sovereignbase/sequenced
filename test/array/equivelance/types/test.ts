import { describe, expect, expectTypeOf, it } from 'vitest'
import { Sequenced, SequencedArray } from '../../../../src/index.js'
import type {
  SequencedArrayChange,
  SequencedArrayDelta,
  SequencedArraySnapshot,
} from '../../../../src/index.js'
import { arraySnapshot } from '../../array.js'

describe('SequencedArray public declarations', () => {
  it('exports the constructor directly and through Sequenced.Array', () => {
    expect(Sequenced.Array).toBe(SequencedArray)
    const array = new Sequenced.Array<number>(1)
    try {
      expectTypeOf(array).toEqualTypeOf<SequencedArray<number>>()
      expectTypeOf(array.at(0)).toEqualTypeOf<number | undefined>()
      expectTypeOf(array.get(0)).toEqualTypeOf<number | undefined>()
      expectTypeOf(
        array.map((value, index, receiver) => {
          expectTypeOf(receiver).toEqualTypeOf<SequencedArray<number>>()
          return `${index}:${value}`
        })
      ).toEqualTypeOf<string[]>()
      expectTypeOf(
        array.reduce((acc, value) => acc + value, '')
      ).toEqualTypeOf<string>()
      expectTypeOf(array.toJSON()).toEqualTypeOf<
        SequencedArraySnapshot<number>
      >()
      array.addEventListener('delta', (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<SequencedArrayDelta<number>>()
      })
      array.addEventListener('change', (event) => {
        expectTypeOf(event.detail).toEqualTypeOf<SequencedArrayChange<number>>()
      })
      array.push(1)
      if (false) {
        // @ts-expect-error Writes must match the element type.
        array.set(0, 'invalid')
        // @ts-expect-error Push must match the element type.
        array.push('invalid')
        // @ts-expect-error Callback receivers are replicas, not indexed JS arrays.
        array.forEach((_, __, receiver: number[]) => receiver.push(1))
        // @ts-expect-error A differently typed accumulator needs an initial value.
        array.reduce<string>((acc, value) => acc + value)
      }
    } finally {
      array.destroy()
    }
  })

  it('preserves type guards and flattening inference', () => {
    const array = new SequencedArray<number | string>(
      1,
      arraySnapshot([1, 'a'])
    )
    const nested = new SequencedArray<number[]>(2, arraySnapshot([[1], [2]]))
    try {
      const isNumber = (value: number | string): value is number =>
        typeof value === 'number'
      expectTypeOf(array.filter(isNumber)).toEqualTypeOf<number[]>()
      expectTypeOf(array.find(isNumber)).toEqualTypeOf<number | undefined>()
      expectTypeOf(array.findLast(isNumber)).toEqualTypeOf<number | undefined>()
      expectTypeOf(nested.flat()).toEqualTypeOf<number[]>()
      expectTypeOf(nested.flatMap((value) => value)).toEqualTypeOf<number[]>()
      expect(array.filter(isNumber)).toEqual([1])
      expect(nested.flat()).toEqual([1, 2])
    } finally {
      array.destroy()
      nested.destroy()
    }
  })
})
