import { describe, expect, it } from 'vitest'
import { SequencedArray } from '../../../../src/SequencedArray/class.js'
import {
  createWorkload,
  operations,
  prepareFixture,
} from '../../../../benchmark/array/workloads.js'

describe('array benchmark fixtures', () => {
  describe.each(['plain', 'wrapper', 'wrapper+listeners'] as const)('%s', (implementation) => {
  it.each(operations)(
    '%s starts fresh and reaches the native-array model',
    (operation) => {
      const fixture = prepareFixture(operation, 64, 8)
      for (let repeat = 0; repeat < 2; repeat++) {
        const workload = createWorkload(fixture, implementation, SequencedArray)
        try {
          workload.run()
          expect(() => workload.verify()).not.toThrow()
        } finally {
          workload.dispose()
        }
      }
    }
  )
  })

  it('does not silently substitute plain sequencer for a missing wrapper', () => {
    const fixture = prepareFixture('push', 64, 8)
    expect(() => createWorkload(fixture, 'wrapper')).toThrow(TypeError)
  })
})
