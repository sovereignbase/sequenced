import { Projection } from '@sovereignbase/sequencer'
import type { Change, Gossip, Sequence } from '@sovereignbase/sequencer'

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

export type ArrayEvents<T> = {
  delta: Gossip<T>
  change: Change<T>
  snapshot: Sequence<T>
}

export type ArrayListener<T, K extends keyof ArrayEvents<T>> =
  | ((event: CustomEvent<ArrayEvents<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<ArrayEvents<T>[K]>): void }

/**
 * Runtime contract for the unfinished implementation, not an assertion that its
 * current TypeScript declaration implements Array. Numeric property access and
 * sparse property descriptors are outside this method-level contract.
 */
export type ArraySubject<T> = Pick<
  T[],
  (typeof arrayMethods)[number] | 'length' | typeof Symbol.iterator
> & {
  get(index: number): T | undefined
  set(index: number, value: T): void
  delete(index: number): void
  apply(gossip: unknown): void
  merge(snapshot: Sequence<T>): void
  snapshot(): void
  toJSON(): Sequence<T>
  addEventListener<K extends keyof ArrayEvents<T>>(
    type: K,
    listener: ArrayListener<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener<K extends keyof ArrayEvents<T>>(
    type: K,
    listener: ArrayListener<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void
  dispatchEvent<K extends keyof ArrayEvents<T>>(
    type: K,
    detail: ArrayEvents<T>[K]
  ): void
}

export interface ArrayConstructor {
  new <T>(actorID: number, snapshot?: Sequence<T>): ArraySubject<T>
}

/**
 * Load source lazily so a broken wrapper cannot prevent plain-sequencer
 * benchmarks or harness typechecking. Import failures remain real test failures.
 */
export async function loadArray(): Promise<ArrayConstructor> {
  const source = new URL('../../src/SequencedArray/class.ts', import.meta.url)
    .href
  const module = await import(/* @vite-ignore */ source)
  if (typeof module.SequencedArray !== 'function')
    throw new TypeError('SequencedArray source must export its constructor')
  return module.SequencedArray as ArrayConstructor
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
