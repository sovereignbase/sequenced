import { deepStrictEqual } from 'node:assert'
import { Projection } from '@sovereignbase/sequencer'
import type { Gossip, Sequence } from '@sovereignbase/sequencer'
import {
  arraySnapshot,
  type ArrayConstructor,
  type ArraySubject,
} from '../../test/array/array.js'

export const operations = [
  'length',
  'at.middle',
  'get.middle',
  'values',
  'slice.all',
  'slice.middle',
  'push',
  'unshift',
  'splice.middle',
  'set.middle',
  'delete.middle',
  'apply.insert',
  'merge.insert',
  'snapshot',
] as const
export type Operation = (typeof operations)[number]
export type Implementation = 'plain' | 'wrapper' | 'wrapper+listeners'

/** Keep API results observable without formatting or assertions in the timer. */
export let resultSink: unknown
let eventSink: unknown

export interface Fixture {
  snapshot: Sequence<number>
  values: number[]
  payloads: number[][]
  deltas: Gossip<number>[]
  snapshots: Sequence<number>[]
  expected: number[]
  batch: number
  middle: number
  operation: Operation
}

/** Deterministic inputs and distinct remote updates are authored outside timing. */
export function prepareFixture(
  operation: Operation,
  size: number,
  batch: number
): Fixture {
  if (
    !Number.isInteger(size) ||
    size < 1 ||
    !Number.isInteger(batch) ||
    batch < 1 ||
    batch > size
  )
    throw new RangeError('Fixture requires integers 1 <= batch <= size')
  const values = Array.from({ length: size }, (_, i) => i)
  const snapshot = arraySnapshot(values)
  const payloads = Array.from({ length: batch }, (_, i) => [-i - 1])
  const middle = Math.floor(size / 2)
  const expected = values.slice()
  const deltas: Gossip<number>[] = []
  const snapshots: Sequence<number>[] = []
  if (operation === 'apply.insert' || operation === 'merge.insert') {
    const sender = new Projection<number>(200, snapshot)
    try {
      for (const payload of payloads) {
        deltas.push(sender.insert(payload.slice(), middle))
        if (operation === 'merge.insert') snapshots.push(sender.sequence())
        expected.splice(middle, 0, ...payload)
      }
    } finally {
      sender.destroy()
    }
  } else {
    for (const payload of payloads) {
      switch (operation) {
        case 'push':
          expected.push(...payload)
          break
        case 'unshift':
          expected.unshift(...payload)
          break
        case 'splice.middle':
          expected.splice(middle, 1, ...payload)
          break
        case 'set.middle':
          expected[middle] = payload[0]
          break
        case 'delete.middle':
          expected.splice(Math.floor(expected.length / 2), 1)
          break
      }
    }
  }
  return {
    operation,
    snapshot,
    values,
    payloads,
    deltas,
    snapshots,
    expected,
    batch,
    middle,
  }
}

/** Public calls differ only where Array and Projection use different range conventions. */
interface Subject {
  length(): number
  at(index: number): number | undefined
  get(index: number): number | undefined
  values(): number[]
  slice(start: number, end: number): number[]
  push(values: number[]): unknown
  unshift(values: number[]): unknown
  splice(index: number, values: number[]): unknown
  set(index: number, value: number): unknown
  delete(index: number): unknown
  apply(gossip: Gossip<number>): unknown
  merge(snapshot: Sequence<number>): unknown
  snapshot(): Sequence<number>
  dispose(): void
}

function plain(snapshot: Sequence<number>): Subject {
  const projection = new Projection<number>(1, snapshot)
  return {
    length: () => projection.length(),
    at: (i) => projection.value(i),
    get: (i) => projection.value(i),
    values: () => projection.values(),
    slice: (start, end) => projection.values(start, end - 1),
    push: (values) => projection.insert(values, projection.length()),
    unshift: (values) => projection.insert(values, 0),
    splice: (i, values) => projection.replace(values, i, i),
    set: (i, value) => projection.replace([value], i, i),
    delete: (i) => projection.remove(i, i),
    apply: (gossip) => projection.apply(gossip),
    merge: (state) => projection.merge(state),
    snapshot: () => projection.sequence(),
    dispose: () => projection.destroy(),
  }
}

function wrapped(
  snapshot: Sequence<number>,
  Constructor: ArrayConstructor,
  listeners: boolean
): Subject {
  let replica: ArraySubject<number> | undefined = new Constructor(1, snapshot)
  const onDelta = (event: CustomEvent<Gossip<number>>) => {
    eventSink = event.detail
  }
  const onChange = (event: CustomEvent<unknown>) => {
    eventSink = event.detail
  }
  if (listeners) {
    replica.addEventListener('delta', onDelta)
    replica.addEventListener('change', onChange)
  }
  return {
    length: () => replica!.length,
    at: (i) => replica!.at(i),
    get: (i) => replica!.get(i),
    values: () => Array.from(replica!.values()),
    slice: (start, end) => replica!.slice(start, end),
    push: (values) => replica!.push(...values),
    unshift: (values) => replica!.unshift(...values),
    splice: (i, values) => replica!.splice(i, 1, ...values),
    set: (i, value) => replica!.set(i, value),
    delete: (i) => replica!.delete(i),
    apply: (gossip) => replica!.apply(gossip),
    merge: (state) => replica!.merge(state),
    snapshot: () => replica!.toJSON(),
    dispose: () => {
      if (listeners) {
        replica!.removeEventListener('delta', onDelta)
        replica!.removeEventListener('change', onChange)
      }
      replica!.destroy()
      replica = undefined
      eventSink = undefined
    },
  }
}

export function createWorkload(
  fixture: Fixture,
  implementation: Implementation,
  Constructor?: ArrayConstructor
) {
  if (implementation !== 'plain' && !Constructor)
    throw new TypeError(
      'Wrapper benchmarks require the real SequencedArray constructor'
    )
  const subject =
    implementation === 'plain'
      ? plain(structuredClone(fixture.snapshot))
      : wrapped(
          structuredClone(fixture.snapshot),
          Constructor!,
          implementation === 'wrapper+listeners'
        )
  // Engines can retain supplied Footage; each timed batch owns its inputs.
  const payloads = fixture.payloads.map((values) => values.slice())
  const deltas = structuredClone(fixture.deltas)
  const snapshots = structuredClone(fixture.snapshots)
  const { operation, batch, middle } = fixture
  const calls: Record<Operation, () => void> = {
    length: () => {
      for (let i = 0; i < batch; i++) resultSink = subject.length()
    },
    'at.middle': () => {
      for (let i = 0; i < batch; i++) resultSink = subject.at(middle)
    },
    'get.middle': () => {
      for (let i = 0; i < batch; i++) resultSink = subject.get(middle)
    },
    values: () => {
      for (let i = 0; i < batch; i++) resultSink = subject.values()
    },
    'slice.all': () => {
      for (let i = 0; i < batch; i++)
        resultSink = subject.slice(0, fixture.values.length)
    },
    'slice.middle': () => {
      for (let i = 0; i < batch; i++)
        resultSink = subject.slice(
          middle,
          Math.min(middle + 16, fixture.values.length)
        )
    },
    push: () => {
      for (const values of payloads) resultSink = subject.push(values)
    },
    unshift: () => {
      for (const values of payloads) resultSink = subject.unshift(values)
    },
    'splice.middle': () => {
      for (const values of payloads) resultSink = subject.splice(middle, values)
    },
    'set.middle': () => {
      for (const [value] of payloads) resultSink = subject.set(middle, value)
    },
    'delete.middle': () => {
      for (let i = 0; i < batch; i++)
        resultSink = subject.delete(Math.floor(subject.length() / 2))
    },
    'apply.insert': () => {
      for (const delta of deltas) resultSink = subject.apply(delta)
    },
    'merge.insert': () => {
      for (const snapshot of snapshots) resultSink = subject.merge(snapshot)
    },
    snapshot: () => {
      for (let i = 0; i < batch; i++) resultSink = subject.snapshot()
    },
  }
  return {
    run: calls[operation],
    verify() {
      deepStrictEqual(subject.values(), fixture.expected)
      switch (operation) {
        case 'length':
          deepStrictEqual(resultSink, fixture.values.length)
          break
        case 'at.middle':
        case 'get.middle':
          deepStrictEqual(resultSink, fixture.values[middle])
          break
        case 'values':
        case 'slice.all':
          deepStrictEqual(resultSink, fixture.values)
          break
        case 'slice.middle':
          deepStrictEqual(resultSink, fixture.values.slice(middle, middle + 16))
          break
        case 'snapshot': {
          const restored = new Projection<number>(300, resultSink)
          try {
            deepStrictEqual(restored.values(), fixture.expected)
          } finally {
            restored.destroy()
          }
        }
      }
    },
    dispose() {
      subject.dispose()
      resultSink = undefined
    },
  }
}
