import { deepStrictEqual } from 'node:assert'
import { Projection } from '@sovereignbase/sequencer'
import type { Gossip } from '@sovereignbase/sequencer'
import {
  SequencedText,
  editText,
  releaseText,
  textSnapshot,
} from '../../test/text/text.js'
import type { SequencedTextSnapshot } from '../../src/SequencedText/types/type.js'

import { random } from '../random.js'
import type { Implementation } from '../runner.js'
export type { Implementation } from '../runner.js'

export const operations = [
  'length',
  'toString',
  'iterator',
  'insert.head',
  'insert.middle',
  'insert.tail',
  'insert.random',
  'remove.random',
  'replace.random',
  'apply.insert.random',
  'apply.remove.random',
  'apply.replace.random',
  'merge.insert.random',
  'merge.remove.random',
  'merge.replace.random',
  'merge.identical',
  'snapshot',
  'toJSON',
] as const
export type Operation = (typeof operations)[number]
export type TextConstructor = typeof SequencedText
export let resultSink: unknown
let eventSink: unknown

export function isReadOnly(operation: Operation): boolean {
  return [
    'length',
    'toString',
    'iterator',
    'merge.identical',
    'snapshot',
    'toJSON',
  ].includes(operation)
}
export function isTraversal(operation: Operation): boolean {
  return operation === 'iterator'
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
  const value = 'x'.repeat(size)
  const snapshot = textSnapshot(value)
  const payloads = Array.from({ length: batch }, (_, i) => (i % 10) + '😀')
  const positions: number[] = []
  const deltas: Gossip<string>[] = []
  const states: SequencedTextSnapshot[] = []
  const next = random(seed)
  let expected = value
  const remote =
    operation.startsWith('apply.') || operation.startsWith('merge.')
  const action = remote
    ? operation.slice(operation.indexOf('.') + 1)
    : operation
  if (operation === 'merge.identical') {
    const identical = new Projection<string>(1, snapshot)
    try {
      states.push(identical.sequence(true))
    } finally {
      identical.destroy()
    }
  } else if (!isReadOnly(operation)) {
    const sender = remote ? new Projection<string>(200, snapshot) : undefined
    try {
      sender?.apply([[1]])
      for (const payload of payloads) {
        const at =
          action === 'insert.head'
            ? 0
            : action === 'insert.middle'
              ? Math.floor(expected.length / 2)
              : action === 'insert.tail'
                ? expected.length
                : Math.floor(
                    next() *
                      (expected.length + (action.startsWith('insert.') ? 1 : 0))
                  )
        positions.push(at)
        let delta: Gossip<string> | undefined
        if (action.startsWith('insert.')) {
          expected = editText(expected, at, at, payload)
          if (sender) delta = sender.insert(payload.split(''), at)
        } else if (action === 'remove.random') {
          expected = editText(expected, at, at + 1)
          if (sender) delta = sender.remove(at, at)
        } else {
          expected = editText(expected, at, at + 1, payload)
          if (sender) delta = sender.replace(payload.split(''), at, at)
        }
        if (delta) deltas.push(delta)
        if (operation.startsWith('merge.')) states.push(sender!.sequence(true))
      }
    } finally {
      sender?.destroy()
    }
  }
  return {
    operation,
    value,
    snapshot,
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

interface Subject {
  length(): number
  read(): string
  iterate(): string[]
  insert(at: number, payload: string, units: string[]): unknown
  remove(start: number, end: number): unknown
  replace(start: number, end: number, payload: string, units: string[]): unknown
  apply(delta: unknown): unknown
  merge(snapshot: unknown): unknown
  snapshot(): unknown
  toJSON(): unknown
  dispose(): void
}
function plain(snapshot: SequencedTextSnapshot): Subject {
  const projection = new Projection<string>(1, snapshot)
  return {
    length: () => projection.length(),
    read: () => projection.values().join(''),
    iterate: () => projection.values(),
    insert: (at, _payload, units) => projection.insert(units, at),
    remove: (start, end) => projection.remove(start, end - 1),
    replace: (start, end, _payload, units) =>
      projection.replace(units, start, end - 1),
    apply: (delta) => projection.apply(delta),
    merge: (snapshot) => projection.merge(snapshot),
    snapshot: () => projection.sequence(true),
    toJSON: () => projection.sequence(true),
    dispose: () => projection.destroy(),
  }
}
function wrapped(
  snapshot: SequencedTextSnapshot,
  Constructor: TextConstructor,
  listeners: boolean
): Subject {
  const text = new Constructor(1, snapshot)
  const listener = (event: CustomEvent<unknown>) => {
    eventSink = event.detail
  }
  if (listeners) {
    text.addEventListener('change', listener)
    text.addEventListener('delta', listener)
    text.addEventListener('snapshot', listener)
  }
  return {
    length: () => text.length,
    read: () => text.toString(),
    iterate: () => Array.from(text),
    insert: (at, payload) => text.insert(at, payload),
    remove: (start, end) => text.remove(start, end),
    replace: (start, end, payload) => text.replace(start, end, payload),
    apply: (delta) => text.apply(delta),
    merge: (state) => text.merge(state),
    snapshot: () => text.snapshot(),
    toJSON: () => text.toJSON(),
    dispose() {
      if (listeners) {
        text.removeEventListener('change', listener)
        text.removeEventListener('delta', listener)
        text.removeEventListener('snapshot', listener)
      }
      releaseText(text)
      eventSink = undefined
    },
  }
}

export function createWorkload(
  fixture: Fixture,
  implementation: Implementation,
  Constructor?: TextConstructor
) {
  if (implementation !== 'plain' && !Constructor)
    throw new TypeError(
      'Wrapper benchmarks require the real SequencedText constructor'
    )
  const snapshot = structuredClone(fixture.snapshot)
  const subject =
    implementation === 'plain'
      ? plain(snapshot)
      : wrapped(snapshot, Constructor!, implementation === 'wrapper+listeners')
  const payloads = fixture.payloads.map((text) => ({
    text,
    units: text.split(''),
  }))
  const deltas = structuredClone(fixture.deltas)
  const states = structuredClone(fixture.states)
  const { operation, positions, batch } = fixture
  let call: (i: number) => unknown
  switch (operation) {
    case 'length':
      call = () => subject.length()
      break
    case 'toString':
      call = () => subject.read()
      break
    case 'iterator':
      call = () => subject.iterate()
      break
    case 'insert.head':
    case 'insert.middle':
    case 'insert.tail':
    case 'insert.random':
      call = (i) =>
        subject.insert(positions[i], payloads[i].text, payloads[i].units)
      break
    case 'remove.random':
      call = (i) => subject.remove(positions[i], positions[i] + 1)
      break
    case 'replace.random':
      call = (i) =>
        subject.replace(
          positions[i],
          positions[i] + 1,
          payloads[i].text,
          payloads[i].units
        )
      break
    case 'apply.insert.random':
    case 'apply.remove.random':
    case 'apply.replace.random':
      call = (i) => subject.apply(deltas[i])
      break
    case 'merge.insert.random':
    case 'merge.remove.random':
    case 'merge.replace.random':
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
  return {
    run() {
      for (let i = 0; i < batch; i++) resultSink = call(i)
    },
    verify() {
      deepStrictEqual(subject.read(), fixture.expected)
      if (operation === 'length')
        deepStrictEqual(resultSink, fixture.value.length)
      if (operation === 'toString') deepStrictEqual(resultSink, fixture.value)
      if (operation === 'iterator')
        deepStrictEqual(resultSink, fixture.value.split(''))
      if (
        operation === 'toJSON' ||
        (operation === 'snapshot' && implementation !== 'wrapper')
      ) {
        const restored = new Projection<string>(
          300,
          operation === 'snapshot' && implementation === 'wrapper+listeners'
            ? eventSink
            : resultSink
        )
        try {
          deepStrictEqual(restored.values().join(''), fixture.expected)
        } finally {
          restored.destroy()
        }
      }
    },
    dispose() {
      subject.dispose()
      resultSink = undefined
    },
  }
}
