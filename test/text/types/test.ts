import { expect, expectTypeOf, it } from 'vitest'
import { Sequenced } from '../../../src/index.js'
import type { Gossip } from '@sovereignbase/sequencer'
import type {
  SequencedTextChange,
  SequencedTextSnapshot,
} from '../../../src/SequencedText/types/type.js'
import { releaseText } from '../text.js'

it('types the existing Text edits, snapshots, iterator and event payloads', () => {
  const text = new Sequenced.Text(1)
  try {
    expectTypeOf<
      ConstructorParameters<typeof Sequenced.Text>[1]
    >().toBeUnknown()
    expectTypeOf<Parameters<typeof text.apply>[0]>().toBeUnknown()
    expectTypeOf<Parameters<typeof text.merge>[0]>().toBeUnknown()
    expectTypeOf(text.insert(0, 'a')).toEqualTypeOf<void>()
    expectTypeOf(text.replace(0, 1, 'b')).toEqualTypeOf<void>()
    expectTypeOf(text.remove(0, 1)).toEqualTypeOf<void>()
    expectTypeOf(text.length).toEqualTypeOf<number>()
    expectTypeOf(text.toString()).toEqualTypeOf<string>()
    expectTypeOf(text.toJSON()).toEqualTypeOf<SequencedTextSnapshot>()
    expectTypeOf([...text]).toEqualTypeOf<string[]>()
    text.addEventListener('change', ({ detail }) => {
      expectTypeOf(detail).toEqualTypeOf<SequencedTextChange>()
    })
    text.addEventListener('delta', ({ detail }) => {
      expectTypeOf(detail).toEqualTypeOf<Gossip<string>>()
    })
    text.addEventListener('snapshot', {
      handleEvent: ({ detail }) => {
        expectTypeOf(detail).toEqualTypeOf<SequencedTextSnapshot>()
      },
    })
    text.insert(0, 'typed')
    text.snapshot()
    expect(text.toString()).toBe('typed')
    if (false) {
      // @ts-expect-error Text input must be a string.
      text.insert(0, ['a'])
      // @ts-expect-error No extra String instance methods are required.
      text.toUpperCase()
    }
  } finally {
    releaseText(text)
  }
})
