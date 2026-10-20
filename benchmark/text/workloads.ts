import { deepStrictEqual } from 'node:assert'
import { Projection } from '@sovereignbase/sequencer'
import type { Gossip, Sequence } from '@sovereignbase/sequencer'
import {
  SequencedText,
  editText,
  releaseText,
  textSnapshot,
} from '../../test/text/text.js'
import type { SequencedTextSnapshot } from '../../src/SequencedText/types/type.js'

export const operations = [
  'length',
  'read',
  'iterate',
  'insert.head',
  'insert.middle',
  'insert.tail',
  'remove.middle',
  'replace.middle',
  'apply.insert',
  'merge.insert',
  'snapshot',
] as const
export type Operation = (typeof operations)[number]
export type Implementation = 'plain' | 'wrapper' | 'wrapper+listeners'
export type TextConstructor = typeof SequencedText
export async function loadText(): Promise<TextConstructor> {
  return SequencedText
}
export let resultSink: unknown
let eventSink: unknown

export function prepareFixture(
  operation: Operation,
  size: number,
  batch: number
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
  const raw: Sequence<string> = [snapshot[0], snapshot[1].split('')]
  const payloads = Array.from({ length: batch }, (_, i) => `${i % 10}😀`)
  const middle = Math.floor(size / 2)
  const deltas: Gossip<string>[] = []
  const states: SequencedTextSnapshot[] = []
  let expected = value
  if (operation === 'apply.insert' || operation === 'merge.insert') {
    const sender = new Projection<string>(200, raw)
    try {
      for (const payload of payloads) {
        deltas.push(sender.insert(payload.split(''), middle))
        if (operation === 'merge.insert') {
          const [words, values] = sender.sequence()
          states.push([words, values.join('')])
        }
        expected = editText(expected, middle, middle, payload)
      }
    } finally {
      sender.destroy()
    }
  } else
    for (const payload of payloads) {
      switch (operation) {
        case 'insert.head':
          expected = payload + expected
          break
        case 'insert.middle':
          expected = editText(expected, middle, middle, payload)
          break
        case 'insert.tail':
          expected += payload
          break
        case 'remove.middle': {
          const at = Math.floor(expected.length / 2)
          expected = editText(expected, at, at + 1)
          break
        }
        case 'replace.middle':
          expected = editText(expected, middle, middle + 1, payload)
          break
      }
    }
  return {
    operation,
    value,
    snapshot,
    payloads,
    middle,
    deltas,
    states,
    expected,
    batch,
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
  apply(delta: Gossip<string>): unknown
  merge(text: SequencedTextSnapshot, raw: Sequence<string>): unknown
  snapshot(): unknown
  dispose(): void
}
function plain(snapshot: SequencedTextSnapshot): Subject {
  const projection = new Projection<string>(1, [
    snapshot[0],
    snapshot[1].split(''),
  ])
  return {
    length: () => projection.length(),
    read: () => projection.values().join(''),
    iterate: () => projection.values(),
    insert: (at, _payload, units) => projection.insert(units, at),
    remove: (start, end) => projection.remove(start, end - 1),
    replace: (start, end, _payload, units) =>
      projection.replace(units, start, end - 1),
    apply: (delta) => projection.apply(delta),
    merge: (_text, raw) => projection.merge(raw),
    snapshot: () => projection.sequence(),
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
    snapshot: () => text.toJSON(),
    dispose() {
      if (listeners) {
        text.removeEventListener('change', listener)
        text.removeEventListener('delta', listener)
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
  const states = structuredClone(fixture.states).map((text) => ({
    text,
    raw: [text[0], text[1].split('')] as Sequence<string>,
  }))
  const { operation, middle, batch } = fixture
  return {
    run() {
      for (let i = 0; i < batch; i++) {
        const { text, units } = payloads[i]
        switch (operation) {
          case 'length':
            resultSink = subject.length()
            break
          case 'read':
            resultSink = subject.read()
            break
          case 'iterate':
            resultSink = subject.iterate()
            break
          case 'insert.head':
            resultSink = subject.insert(0, text, units)
            break
          case 'insert.middle':
            resultSink = subject.insert(middle, text, units)
            break
          case 'insert.tail':
            resultSink = subject.insert(subject.length(), text, units)
            break
          case 'remove.middle': {
            const at = Math.floor(subject.length() / 2)
            resultSink = subject.remove(at, at + 1)
            break
          }
          case 'replace.middle':
            resultSink = subject.replace(middle, middle + 1, text, units)
            break
          case 'apply.insert':
            resultSink = subject.apply(deltas[i])
            break
          case 'merge.insert':
            resultSink = subject.merge(states[i].text, states[i].raw)
            break
          case 'snapshot':
            resultSink = subject.snapshot()
            break
        }
      }
    },
    verify() {
      deepStrictEqual(subject.read(), fixture.expected)
      if (operation === 'length')
        deepStrictEqual(resultSink, fixture.value.length)
      if (operation === 'read') deepStrictEqual(resultSink, fixture.value)
      if (operation === 'iterate')
        deepStrictEqual(resultSink, fixture.value.split(''))
      if (operation === 'snapshot') {
        const [words, data] = resultSink as
          Sequence<string> | SequencedTextSnapshot
        const restored = new Projection<string>(300, [
          words,
          typeof data === 'string' ? data.split('') : data,
        ])
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
