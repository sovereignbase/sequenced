import { expect, expectTypeOf, it } from 'vitest'
import { Sequenced, SequencedMap } from '../../../src/index.js'
import type {
  SequencedMapChange,
  SequencedMapDelta,
  SequencedMapSnapshot,
} from '../../../src/index.js'

it('exports Map key/value generics, native returns and typed events', () => {
  const map = new Sequenced.Map<string | number, boolean>(1)
  try {
    expectTypeOf(map).toEqualTypeOf<SequencedMap<string | number, boolean>>()
    expectTypeOf(map.set('a', true)).toEqualTypeOf<typeof map>()
    expectTypeOf(map.get('a')).toEqualTypeOf<boolean | undefined>()
    expectTypeOf(map.delete('a')).toEqualTypeOf<boolean>()
    expectTypeOf([...map]).toEqualTypeOf<Array<[string | number, boolean]>>()
    expectTypeOf(map.toJSON()).toEqualTypeOf<
      SequencedMapSnapshot<string | number, boolean>
    >()
    map.addEventListener('change', ({ detail }) => {
      expectTypeOf(detail).toEqualTypeOf<
        SequencedMapChange<string | number, boolean>
      >()
      expectTypeOf(detail['a']).toEqualTypeOf<boolean | undefined>()
    })
    map.addEventListener('delta', ({ detail }) => {
      expectTypeOf(detail).toEqualTypeOf<
        SequencedMapDelta<string | number, boolean>
      >()
    })
    map.forEach((value, key, receiver) => {
      expectTypeOf(value).toEqualTypeOf<boolean>()
      expectTypeOf(key).toEqualTypeOf<string | number>()
      expectTypeOf(receiver).toEqualTypeOf<typeof map>()
    })
    map.set(1, true)
    expect(map.get(1)).toBe(true)
    if (false) {
      // @ts-expect-error Only string/number keys.
      map.set({}, true)
      // @ts-expect-error Values retain their type.
      map.set('a', 1)
      // @ts-expect-error Generic key constraint.
      new SequencedMap<object, number>(1)
    }
  } finally {
    map.destroy()
  }
})
