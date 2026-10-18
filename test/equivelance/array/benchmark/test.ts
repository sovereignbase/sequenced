import { describe, expect, it } from 'vitest'
import {
  createWorkload,
  operations,
  prepareFixture,
} from '../../../../benchmark/array/workloads.js'

/** Verify the runnable baseline independently from the unfinished wrapper. */
describe('array benchmark fixtures', () => {
  it.each(operations)(
    '%s starts fresh and reaches the native-array model',
    (operation) => {
      const fixture = prepareFixture(operation, 64, 8)
      for (let repeat = 0; repeat < 2; repeat++) {
        const workload = createWorkload(fixture, 'plain')
        try {
          workload.run()
          expect(() => workload.verify()).not.toThrow()
        } finally {
          workload.dispose()
        }
      }
    }
  )

  it('does not silently substitute plain sequencer for a missing wrapper', () => {
    const fixture = prepareFixture('push', 64, 8)
    expect(() => createWorkload(fixture, 'wrapper')).toThrow(TypeError)
  })
})
