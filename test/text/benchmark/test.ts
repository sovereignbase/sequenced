import { describe, expect, it } from 'vitest'
import { SequencedText } from '../text.js'
import {
  operations,
  createWorkload,
  prepareFixture,
} from '../../../benchmark/text/workloads.js'

describe.each(['plain', 'wrapper', 'wrapper+listeners'] as const)(
  'Text benchmark fixtures: %s',
  (implementation) => {
    it.each(operations)(
      '%s starts fresh and reaches the string edit model',
      (operation) => {
        const fixture = prepareFixture(operation, 64, 8)
        for (let repeat = 0; repeat < 2; repeat++) {
          const workload = createWorkload(
            fixture,
            implementation,
            SequencedText
          )
          try {
            workload.run()
            expect(() => workload.verify()).not.toThrow()
          } finally {
            workload.dispose()
          }
        }
      }
    )
  }
)

it('does not substitute plain sequencer for a missing Text wrapper', () => {
  const fixture = prepareFixture('insert.tail', 64, 8)
  expect(() => createWorkload(fixture, 'wrapper')).toThrow(TypeError)
})
