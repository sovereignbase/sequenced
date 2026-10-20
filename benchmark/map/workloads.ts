import { deepStrictEqual } from 'node:assert'
import { Projection } from '@sovereignbase/sequencer'
import type { Gossip } from '@sovereignbase/sequencer'
import { SequencedMap } from '../../src/SequencedMap/class.js'
import type {
  SerializableKey,
  SequencedMapEntry,
  SequencedMapSnapshot,
} from '../../src/SequencedMap/types/type.js'
import { mapSnapshot } from '../../test/map/map.js'

export const operations = [
  'size',
  'get',
  'has',
  'entries',
  'set.existing',
  'set.new',
  'delete.head',
  'delete.tail',
  'clear',
  'apply.insert',
  'merge.insert',
  'snapshot',
  'construct',
] as const
export type Operation = (typeof operations)[number]
export type Implementation = 'plain' | 'wrapper' | 'wrapper+listeners'
type Entry = SequencedMapEntry<SerializableKey, number>
type Snapshot = SequencedMapSnapshot<SerializableKey, number>
type MapReplica = SequencedMap<SerializableKey, number>
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
  const entries = Array.from({ length: size }, (_, i): Entry => [
    i % 2 ? String(i) : i,
    i,
  ])
  const snapshot = mapSnapshot(entries)
  const payloads = Array.from({ length: batch }, (_, i): Entry => [
    `new-${i}`,
    -i - 1,
  ])
  const middle = Math.floor(size / 2)
  const expected = new Map(entries)
  const deltas: Gossip<Entry>[] = []
  const states: Snapshot[] = []
  if (operation === 'apply.insert' || operation === 'merge.insert') {
    const sender = new Projection<Entry>(200, snapshot)
    const model = entries.slice()
    try {
      for (const payload of payloads) {
        deltas.push(sender.insert([payload], middle))
        if (operation === 'merge.insert') states.push(sender.sequence())
        model.splice(middle, 0, payload)
      }
      expected.clear()
      for (const [key, value] of model) expected.set(key, value)
    } finally {
      sender.destroy()
    }
  } else
    for (let i = 0; i < batch; i++) {
      switch (operation) {
        case 'set.existing':
          expected.set(entries[middle][0], payloads[i][1])
          break
        case 'set.new':
          expected.set(...payloads[i])
          break
        case 'delete.head':
          expected.delete(entries[i][0])
          break
        case 'delete.tail':
          expected.delete(entries[size - i - 1][0])
          break
        case 'clear':
          expected.clear()
          break
      }
    }
  return {
    operation,
    entries,
    snapshot,
    payloads,
    middle,
    expected: [...expected],
    deltas,
    states,
    batch,
  }
}

interface Subject {
  size(): number
  get(): number | undefined
  has(): boolean
  entries(): Entry[]
  setExisting(entry: Entry): unknown
  setNew(entry: Entry): unknown
  deleteHead(key: SerializableKey): unknown
  deleteTail(key: SerializableKey): unknown
  clear(): unknown
  apply(delta: Gossip<Entry>): unknown
  merge(snapshot: Snapshot): unknown
  snapshot(): Snapshot
  dispose(): void
}

export function createWorkload(
  fixture: ReturnType<typeof prepareFixture>,
  implementation: Implementation,
  Constructor?: typeof SequencedMap
) {
  if (implementation !== 'plain' && !Constructor)
    throw new TypeError('Map benchmarks require the real wrapper constructor')
  const snapshot = structuredClone(fixture.snapshot)
  const { operation, middle, batch, entries } = fixture
  if (operation === 'construct') {
    let replica: Projection<Entry> | MapReplica
    return {
      run() {
        replica =
          implementation === 'plain'
            ? new Projection<Entry>(1, snapshot)
            : new Constructor!<SerializableKey, number>(1, snapshot)
        if (implementation === 'wrapper+listeners') {
          const map = replica as MapReplica
          const listener = ({ detail }: CustomEvent<unknown>) => {
            eventSink = detail
          }
          map.addEventListener('change', listener)
          map.addEventListener('delta', listener)
        }
        resultSink = replica
      },
      verify() {
        deepStrictEqual(
          implementation === 'plain'
            ? (replica as Projection<Entry>).values()
            : Array.from(replica as MapReplica),
          fixture.expected
        )
      },
      dispose() {
        replica.destroy()
        resultSink = undefined
      },
    }
  }
  const payloads = fixture.payloads.map(([key, value]): Entry => [key, value])
  const deltas = structuredClone(fixture.deltas)
  const states = structuredClone(fixture.states)
  let subject: Subject
  if (implementation === 'plain') {
    const raw = new Projection<Entry>(1, snapshot)
    subject = {
      size: () => raw.length(),
      get: () => raw.value(middle)?.[1],
      has: () => raw.value(middle) !== undefined,
      entries: () => raw.values(),
      setExisting: ([, value]) =>
        raw.replace([[entries[middle][0], value]], middle, middle),
      setNew: (entry) => raw.insert([entry], raw.length()),
      deleteHead: () => raw.remove(0, 0),
      deleteTail: () => raw.remove(raw.length() - 1, raw.length() - 1),
      clear: () => raw.remove(0, raw.length() - 1),
      apply: (delta) => raw.apply(delta),
      merge: (state) => raw.merge(state),
      snapshot: () => raw.sequence(),
      dispose: () => raw.destroy(),
    }
  } else {
    const map = new Constructor!<SerializableKey, number>(1, snapshot)
    const listener = ({ detail }: CustomEvent<unknown>) => {
      eventSink = detail
    }
    if (implementation === 'wrapper+listeners') {
      map.addEventListener('change', listener)
      map.addEventListener('delta', listener)
    }
    subject = {
      size: () => map.size,
      get: () => map.get(entries[middle][0]),
      has: () => map.has(entries[middle][0]),
      entries: () => Array.from(map),
      setExisting: ([, value]) => map.set(entries[middle][0], value),
      setNew: ([key, value]) => map.set(key, value),
      deleteHead: (key) => map.delete(key),
      deleteTail: (key) => map.delete(key),
      clear: () => map.clear(),
      apply: (delta) => map.apply(delta),
      merge: (state) => map.merge(state),
      snapshot: () => map.toJSON(),
      dispose() {
        map.removeEventListener('change', listener)
        map.removeEventListener('delta', listener)
        map.destroy()
        eventSink = undefined
      },
    }
  }
  return {
    run() {
      for (let i = 0; i < batch; i++)
        switch (operation) {
          case 'size':
            resultSink = subject.size()
            break
          case 'get':
            resultSink = subject.get()
            break
          case 'has':
            resultSink = subject.has()
            break
          case 'entries':
            resultSink = subject.entries()
            break
          case 'set.existing':
            resultSink = subject.setExisting(payloads[i])
            break
          case 'set.new':
            resultSink = subject.setNew(payloads[i])
            break
          case 'delete.head':
            resultSink = subject.deleteHead(entries[i][0])
            break
          case 'delete.tail':
            resultSink = subject.deleteTail(entries[entries.length - i - 1][0])
            break
          case 'clear':
            resultSink = subject.clear()
            break
          case 'apply.insert':
            resultSink = subject.apply(deltas[i])
            break
          case 'merge.insert':
            resultSink = subject.merge(states[i])
            break
          case 'snapshot':
            resultSink = subject.snapshot()
            break
        }
    },
    verify() {
      deepStrictEqual(subject.entries(), fixture.expected)
      if (operation === 'size') deepStrictEqual(resultSink, entries.length)
      if (operation === 'get') deepStrictEqual(resultSink, entries[middle][1])
      if (operation === 'has') deepStrictEqual(resultSink, true)
      if (operation === 'entries') deepStrictEqual(resultSink, entries)
      if (operation === 'snapshot') {
        const restored = new Projection<Entry>(300, resultSink)
        try {
          deepStrictEqual(restored.values(), fixture.expected)
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
