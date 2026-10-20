import { describe, expect, it } from 'vitest'
import { SequencedMap } from '../../../src/index.js'
import {
  operations,
  prepareFixture,
  createWorkload,
} from '../../../benchmark/map/workloads.js'

describe.each(['plain', 'wrapper', 'wrapper+listeners'] as const)(
  'Map benchmark fixtures: %s',
  (implementation) => {
    it.each(operations)(
      '%s validates fresh inputs against a native Map model',
      (operation) => {
        const fixture = prepareFixture(
          operation,
          64,
          operation === 'clear' || operation === 'construct' ? 1 : 8
        )
        for (let repeat = 0; repeat < 2; repeat++) {
          const workload = createWorkload(fixture, implementation, SequencedMap)
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
it('does not benchmark a substitute when the Map constructor is missing', () => {
  expect(() => createWorkload(prepareFixture('get', 64, 8), 'wrapper')).toThrow(
    TypeError
  )
})
