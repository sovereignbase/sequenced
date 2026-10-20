import { Projection } from '@sovereignbase/sequencer'
import { SequencedArray } from '../../src/SequencedArray/class.js'
import type { Sequence } from '@sovereignbase/sequencer'

/** ES2024 Array instance methods. Static Array factories are a separate API. */
export const arrayMethods = [
  'at',
  'concat',
  'copyWithin',
  'entries',
  'every',
  'fill',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flat',
  'flatMap',
  'forEach',
  'includes',
  'indexOf',
  'join',
  'keys',
  'lastIndexOf',
  'map',
  'pop',
  'push',
  'reduce',
  'reduceRight',
  'reverse',
  'shift',
  'slice',
  'some',
  'sort',
  'splice',
  'toLocaleString',
  'toReversed',
  'toSorted',
  'toSpliced',
  'toString',
  'unshift',
  'values',
  'with',
] as const satisfies ReadonlyArray<keyof unknown[]>

export type ArraySubject<T> = SequencedArray<T>
export type ArrayConstructor = typeof SequencedArray

/** Equivalence tests and benchmarks use the actual implementation and types. */
export async function loadArray(): Promise<ArrayConstructor> {
  return SequencedArray
}

/** Both implementations hydrate exactly the same trusted sequencer snapshot. */
export function arraySnapshot<T>(values: T[]): Sequence<T> {
  const projection = new Projection<T>(100)
  try {
    if (values.length) projection.insert(values.slice(), 0)
    return projection.sequence()
  } finally {
    projection.destroy()
  }
}
