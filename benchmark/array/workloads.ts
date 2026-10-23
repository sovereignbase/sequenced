import { deepStrictEqual } from 'node:assert'
import { Projection } from '@sovereignbase/sequencer'
import type { Gossip, Sequence } from '@sovereignbase/sequencer'
import {
  arraySnapshot,
  type ArrayConstructor,
  type ArraySubject,
} from '../../test/array/array.js'

import { random } from '../random.js'
import type { Implementation } from '../runner.js'
export type { Implementation } from '../runner.js'

export const operations = [
  'length',
  'at.random',
  'get.random',
  'values',
  'slice.all',
  'slice.random',
  'push',
  'unshift',
  'splice.random',
  'set.random',
  'delete.random',
  'apply.insert.random',
  'apply.set.random',
  'apply.delete.random',
  'merge.insert.random',
  'merge.set.random',
  'merge.delete.random',
  'merge.identical',
  'snapshot',
  'toJSON',
] as const
export type Operation = (typeof operations)[number]
export let resultSink: unknown
let eventSink: unknown

export function isReadOnly(operation: Operation): boolean {
  return [
    'length',
    'at.random',
    'get.random',
    'values',
    'slice.all',
    'slice.random',
    'merge.identical',
    'snapshot',
    'toJSON',
  ].includes(operation)
}
export function isTraversal(operation: Operation): boolean {
  return operation === 'values'
}

export function prepareFixture(
  operation: Operation,
  size: number,
  batch: number,
  seed = 0xc0ffee
) {
  if (
    !Number.isInteger(size) ||
    !Number.isInteger(batch) ||
    batch < 1 ||
    size < batch
  )
    throw new RangeError('Fixture requires integers 1 <= batch <= size')
  const values = Array.from({ length: size }, (_, i) => i)
  const snapshot = arraySnapshot(values)
  const payloads = Array.from({ length: batch }, (_, i) => [-i - 1])
  const expected = values.slice()
  const positions: number[] = []
  const deltas: Gossip<number>[] = []
  const states: Sequence<number>[] = []
  const next = random(seed)
  const remote =
    operation.startsWith('apply.') || operation.startsWith('merge.')
  const action = remote
    ? operation.slice(operation.indexOf('.') + 1)
    : operation
  const pointRead = operation === 'at.random' || operation === 'get.random'
  if (pointRead) {
    for (let i = 0; i < size; i++) positions.push(Math.floor(next() * size))
  } else if (operation === 'merge.identical') {
    const identical = new Projection<number>(1, snapshot)
    try {
      states.push(identical.sequence())
    } finally {
      identical.destroy()
    }
  } else {
    const sender = remote ? new Projection<number>(200, snapshot) : undefined
    try {
      sender?.apply([[1]])
      for (let i = 0; i < batch; i++) {
        const at = Math.floor(
          next() * (expected.length + (action === 'insert.random' ? 1 : 0))
        )
        positions.push(at)
        let delta: Gossip<number> | undefined
        switch (action) {
          case 'push':
            expected.push(...payloads[i])
            break
          case 'unshift':
            expected.unshift(...payloads[i])
            break
          case 'insert.random':
            expected.splice(at, 0, ...payloads[i])
            delta = sender!.insert(payloads[i], at)
            break
          case 'splice.random':
          case 'set.random':
            expected[at] = payloads[i][0]
            if (sender) delta = sender.replace(payloads[i], at, at)
            break
          case 'delete.random':
            expected.splice(at, 1)
            if (sender) delta = sender.remove(at, at)
            break
        }
        if (delta) deltas.push(delta)
        if (operation.startsWith('merge.')) states.push(sender!.sequence())
      }
    } finally {
      sender?.destroy()
    }
  }
  return {
    operation,
    snapshot,
    values,
    payloads,
    positions,
    deltas,
    states,
    expected,
    batch,
    seed,
  }
}
type Fixture = ReturnType<typeof prepareFixture>

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
  apply(gossip: unknown): unknown
  merge(snapshot: unknown): unknown
  snapshot(): unknown
  toJSON(): Sequence<number>
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
    toJSON: () => projection.sequence(),
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
    replica.addEventListener('snapshot', onChange)
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
    snapshot: () => replica!.snapshot(),
    toJSON: () => replica!.toJSON(),
    dispose: () => {
      if (listeners) {
        replica!.removeEventListener('delta', onDelta)
        replica!.removeEventListener('change', onChange)
        replica!.removeEventListener('snapshot', onChange)
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
  const payloads = fixture.payloads.map((values) => values.slice())
  const deltas = structuredClone(fixture.deltas)
  const states = structuredClone(fixture.states)
  const { operation, batch, positions } = fixture
  let call: (i: number) => unknown
  switch (operation) {
    case 'length':
      call = () => subject.length()
      break
    case 'at.random':
      call = (i) => subject.at(positions[i])
      break
    case 'get.random':
      call = (i) => subject.get(positions[i])
      break
    case 'values':
      call = () => subject.values()
      break
    case 'slice.all':
      call = () => subject.slice(0, fixture.values.length)
      break
    case 'slice.random':
      call = (i) =>
        subject.slice(
          positions[i],
          Math.min(positions[i] + 16, fixture.values.length)
        )
      break
    case 'push':
      call = (i) => subject.push(payloads[i])
      break
    case 'unshift':
      call = (i) => subject.unshift(payloads[i])
      break
    case 'splice.random':
      call = (i) => subject.splice(positions[i], payloads[i])
      break
    case 'set.random':
      call = (i) => subject.set(positions[i], payloads[i][0])
      break
    case 'delete.random':
      call = (i) => subject.delete(positions[i])
      break
    case 'apply.insert.random':
    case 'apply.set.random':
    case 'apply.delete.random':
      call = (i) => subject.apply(deltas[i])
      break
    case 'merge.insert.random':
    case 'merge.set.random':
    case 'merge.delete.random':
      call = (i) => subject.merge(states[i])
      break
    case 'merge.identical':
      call = () => subject.merge(states[0])
      break
    case 'snapshot':
      call = () => subject.snapshot()
      break
    case 'toJSON':
      call = () => subject.toJSON()
      break
  }
  const pointRead = operation === 'at.random' || operation === 'get.random'
  let cursor = 0
  let last = 0
  return {
    run() {
      for (let i = 0; i < batch; i++) {
        last = pointRead ? cursor : i
        resultSink = call(last)
        if (pointRead && ++cursor === positions.length) cursor = 0
      }
    },
    verify() {
      deepStrictEqual(subject.values(), fixture.expected)
      switch (operation) {
        case 'length':
          deepStrictEqual(resultSink, fixture.values.length)
          break
        case 'at.random':
        case 'get.random':
          deepStrictEqual(resultSink, fixture.values[positions[last]])
          break
        case 'values':
        case 'slice.all':
          deepStrictEqual(resultSink, fixture.values)
          break
        case 'slice.random':
          deepStrictEqual(
            resultSink,
            fixture.values.slice(positions[last], positions[last] + 16)
          )
          break
        case 'snapshot':
        case 'toJSON': {
          if (operation === 'snapshot' && implementation === 'wrapper') break
          const restored = new Projection<number>(
            300,
            operation === 'snapshot' && implementation === 'wrapper+listeners'
              ? eventSink
              : resultSink
          )
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
