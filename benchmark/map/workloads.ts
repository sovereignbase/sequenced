import { deepStrictEqual, throws } from 'node:assert'
import { Projection } from '@sovereignbase/sequencer'
import type { Gossip } from '@sovereignbase/sequencer'
import { SequencedMap } from '../../src/SequencedMap/class.js'
import type {
  SerializableKey,
  SequencedMapEntry,
  SequencedMapSnapshot,
} from '../../src/SequencedMap/types/type.js'
import { mapSnapshot } from '../../test/.shared/map.js'

export const operations = [
  'get.random',
  'has.random',
  'set.random',
  'delete.random',
  'apply.set.random',
  'apply.delete.random',
  'set.new',
  'apply.set.new',
  'size',
  'clear',
  'keys',
  'values',
  'entries',
  'iterator',
  'forEach',
  'merge.set.random',
  'merge.delete.random',
  'merge.set.new',
  'merge.identical',
  'snapshot',
  'toJSON',
  'construct',
  'destroy',
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'toStringTag',
  'inspect.node',
  'inspect.deno',
] as const
export type Operation = (typeof operations)[number]
export type Implementation = 'plain' | 'wrapper' | 'wrapper+listeners'

type Entry = SequencedMapEntry<SerializableKey, number>
type Snapshot = SequencedMapSnapshot<SerializableKey, number>
type MapReplica = SequencedMap<SerializableKey, number>
export let resultSink: unknown
let eventSink: unknown

const wrapperOnly: readonly Operation[] = [
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'toStringTag',
]
export function supports(
  operation: Operation,
  implementation: Implementation
): boolean {
  return implementation !== 'plain' || !wrapperOnly.includes(operation)
}
export function callsPerSample(operation: Operation, batch: number): number {
  return ['clear', 'construct', 'destroy'].includes(operation) ? 1 : batch
}
export function isReadOnly(operation: Operation): boolean {
  return [
    'get.random',
    'has.random',
    'size',
    'keys',
    'values',
    'entries',
    'iterator',
    'forEach',
    'snapshot',
    'toJSON',
    'toStringTag',
    'inspect.node',
    'inspect.deno',
    'dispatchEvent',
    'merge.identical',
  ].includes(operation)
}
export function isTraversal(operation: Operation): boolean {
  return [
    'keys',
    'values',
    'entries',
    'iterator',
    'forEach',
    'inspect.node',
    'inspect.deno',
  ].includes(operation)
}

function random(seed: number) {
  return () => {
    let word = (seed += 0x6d2b79f5)
    word = Math.imul(word ^ (word >>> 15), word | 1)
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61)
    return ((word ^ (word >>> 14)) >>> 0) / 0x100000000
  }
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
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new RangeError('Seed must be a uint32')
  const entries = Array.from({ length: size }, (_, i): Entry => [
    i % 2 ? String(i) : i,
    i,
  ])
  const snapshot = mapSnapshot(entries)
  const next = random(seed)
  const shuffled = Array.from({ length: size }, (_, i) => i)
  const traceLength =
    operation === 'get.random' || operation === 'has.random' ? size : batch
  const selected = new Array<number>(traceLength)
  for (let i = 0; i < traceLength; i++) {
    const other = i + Math.floor(next() * (size - i))
    selected[i] = shuffled[other]
    shuffled[other] = shuffled[i]
  }
  const keys = selected.map((at) => entries[at][0])
  const deletion = operation.includes('delete')
  const positions = selected.map((at, i) => {
    let position = at
    if (deletion)
      for (let previous = 0; previous < i; previous++)
        if (selected[previous] < at) position--
    return position
  })
  const payloads = Array.from({ length: batch }, (_, i): Entry => [
    operation.endsWith('.new') ? 'new-' + i : entries[selected[i]][0],
    -i - 1,
  ])
  const expected = new Map(entries)
  const deltas: Gossip<Entry>[] = []
  const states: Snapshot[] = []
  if (operation === 'merge.identical') {
    const identical = new Projection<Entry>(1, snapshot)
    try {
      states.push(identical.sequence())
    } finally {
      identical.destroy()
    }
  } else if (operation.startsWith('apply.') || operation.startsWith('merge.')) {
    const sender = new Projection<Entry>(200, snapshot)
    try {
      sender.apply([[1]])
      for (let i = 0; i < batch; i++) {
        if (deletion) {
          deltas.push(sender.remove(positions[i], positions[i]))
          expected.delete(keys[i])
        } else if (operation.endsWith('.new')) {
          deltas.push(sender.insert([payloads[i]], sender.length()))
          expected.set(...payloads[i])
        } else {
          deltas.push(sender.replace([payloads[i]], positions[i], positions[i]))
          expected.set(...payloads[i])
        }
        if (operation.startsWith('merge.')) states.push(sender.sequence())
      }
    } finally {
      sender.destroy()
    }
  } else
    for (let i = 0; i < batch; i++) {
      if (operation === 'set.random' || operation === 'set.new')
        expected.set(...payloads[i])
      else if (operation === 'delete.random') expected.delete(keys[i])
      else if (operation === 'clear' || operation === 'destroy')
        expected.clear()
    }
  return {
    operation,
    entries,
    snapshot,
    keys,
    selected,
    positions,
    payloads,
    expected: [...expected],
    deltas,
    states,
    batch,
    seed,
  }
}

function listen(map: MapReplica) {
  const listener = ({ detail }: CustomEvent<unknown>) => {
    eventSink = detail
  }
  map.addEventListener('change', listener)
  map.addEventListener('delta', listener)
  map.addEventListener('snapshot', listener)
}

export function createWorkload(
  fixture: ReturnType<typeof prepareFixture>,
  implementation: Implementation,
  Constructor?: typeof SequencedMap
) {
  if (!supports(fixture.operation, implementation))
    throw new TypeError('Projection has no equivalent for ' + fixture.operation)
  if (implementation !== 'plain' && !Constructor)
    throw new TypeError('Map benchmarks require the real wrapper constructor')
  const {
    operation,
    batch,
    entries,
    snapshot,
    keys,
    selected,
    positions,
    payloads,
    deltas,
    states,
  } = fixture
  let raw: Projection<Entry> | undefined
  let map: MapReplica | undefined
  const create = () => {
    if (implementation === 'plain') raw = new Projection<Entry>(1, snapshot)
    else {
      map = new Constructor!<SerializableKey, number>(1, snapshot)
      if (implementation === 'wrapper+listeners') listen(map)
    }
  }
  if (operation !== 'construct') create()
  let call: (i: number) => unknown
  let eventCalls = 0
  let callbackTotal = 0
  const visit = (value: number) => {
    callbackTotal += value
  }
  const visitEntry = ([, value]: Entry) => visit(value)
  const listeners =
    operation === 'addEventListener' || operation === 'removeEventListener'
      ? Array.from({ length: batch }, () => () => {
          eventCalls++
        })
      : []
  if (operation === 'removeEventListener')
    for (const listener of listeners) map!.addEventListener('change', listener)
  if (operation === 'dispatchEvent')
    map!.addEventListener('change', () => {
      eventCalls++
    })
  const detail = Object.freeze({ benchmark: 1 })
  switch (operation) {
    case 'get.random':
      call = raw
        ? (i) => raw!.value(positions[i])?.[1]
        : (i) => map!.get(keys[i])
      break
    case 'has.random':
      call = raw
        ? (i) => raw!.value(positions[i]) !== undefined
        : (i) => map!.has(keys[i])
      break
    case 'set.random':
      call = raw
        ? (i) => raw!.replace([payloads[i]], positions[i], positions[i])
        : (i) => map!.set(...payloads[i])
      break
    case 'delete.random':
      call = raw
        ? (i) => raw!.remove(positions[i], positions[i])
        : (i) => map!.delete(keys[i])
      break
    case 'set.new':
      call = raw
        ? (i) => raw!.insert([payloads[i]], raw!.length())
        : (i) => map!.set(...payloads[i])
      break
    case 'apply.set.random':
    case 'apply.delete.random':
    case 'apply.set.new':
      call = raw ? (i) => raw!.apply(deltas[i]) : (i) => map!.apply(deltas[i])
      break
    case 'merge.set.random':
    case 'merge.delete.random':
    case 'merge.set.new':
      call = raw ? (i) => raw!.merge(states[i]) : (i) => map!.merge(states[i])
      break
    case 'merge.identical':
      call = raw ? () => raw!.merge(states[0]) : () => map!.merge(states[0])
      break
    case 'size':
      call = raw ? () => raw!.length() : () => map!.size
      break
    case 'clear':
      call = raw ? () => raw!.remove(0, raw!.length() - 1) : () => map!.clear()
      break
    case 'keys':
      call = raw
        ? () => raw!.values().map(([key]) => key)
        : () => Array.from(map!.keys())
      break
    case 'values':
      call = raw
        ? () => raw!.values().map(([, value]) => value)
        : () => Array.from(map!.values())
      break
    case 'entries':
      call = raw ? () => raw!.values() : () => Array.from(map!.entries())
      break
    case 'iterator':
      call = raw
        ? () => Array.from(raw!.values()[Symbol.iterator]())
        : () => Array.from(map![Symbol.iterator]())
      break
    case 'forEach':
      call = raw
        ? () => raw!.values().forEach(visitEntry)
        : () => map!.forEach(visit)
      break
    case 'snapshot':
      call = raw ? () => raw!.sequence() : () => map!.snapshot()
      break
    case 'toJSON':
      call = raw ? () => raw!.sequence() : () => map!.toJSON()
      break
    case 'construct':
      call = () => {
        create()
        return raw ?? map
      }
      break
    case 'destroy':
      call = raw ? () => raw!.destroy() : () => map!.destroy()
      break
    case 'addEventListener':
      call = (i) => map!.addEventListener('change', listeners[i])
      break
    case 'removeEventListener':
      call = (i) => map!.removeEventListener('change', listeners[i])
      break
    case 'dispatchEvent':
      call = () => map!.dispatchEvent('change', detail)
      break
    case 'toStringTag':
      call = () => map![Symbol.toStringTag]
      break
    case 'inspect.node':
    case 'inspect.deno': {
      const symbol = Symbol.for(
        operation === 'inspect.node'
          ? 'nodejs.util.inspect.custom'
          : 'Deno.customInspect'
      )
      call = raw
        ? () => new Map(raw!.values())
        : () => Reflect.apply(Reflect.get(map!, symbol), map, [])
      break
    }
  }
  let runs = 0
  let checksum = 0
  let cursor = 0
  let start = 0
  const pointRead = operation === 'get.random' || operation === 'has.random'
  return {
    resetListeners() {
      for (const listener of listeners) {
        if (operation === 'addEventListener')
          map!.removeEventListener('change', listener)
        else map!.addEventListener('change', listener)
      }
    },
    run() {
      callbackTotal = 0
      checksum = 0
      start = cursor
      for (let i = 0; i < batch; i++) {
        const result = call(pointRead ? cursor : i)
        if (pointRead && ++cursor === selected.length) cursor = 0
        if (operation === 'get.random') checksum += result as number
        else if (
          operation === 'has.random' ||
          (operation === 'delete.random' && map)
        )
          checksum += Number(result)
        resultSink = result
      }
      runs++
    },
    verify() {
      if (operation === 'destroy') {
        if (raw) throws(() => raw!.length())
        else deepStrictEqual(map!.size, 0)
        return
      }
      deepStrictEqual(raw ? raw.values() : Array.from(map!), fixture.expected)
      if (operation === 'get.random') {
        let expected = 0
        for (let i = 0; i < batch; i++)
          expected += entries[selected[(start + i) % selected.length]][1]
        deepStrictEqual(checksum, expected)
      }
      if (operation === 'has.random' || (operation === 'delete.random' && map))
        deepStrictEqual(checksum, batch)
      if (operation === 'size') deepStrictEqual(resultSink, entries.length)
      if (operation === 'keys')
        deepStrictEqual(
          resultSink,
          entries.map(([key]) => key)
        )
      if (operation === 'values')
        deepStrictEqual(
          resultSink,
          entries.map(([, value]) => value)
        )
      if (operation === 'entries' || operation === 'iterator')
        deepStrictEqual(resultSink, entries)
      if (operation === 'forEach')
        deepStrictEqual(
          callbackTotal,
          batch * entries.reduce((sum, [, value]) => sum + value, 0)
        )
      if (operation === 'inspect.node' || operation === 'inspect.deno')
        deepStrictEqual(resultSink, new Map(entries))
      if (operation === 'toStringTag') deepStrictEqual(resultSink, 'Map')
      if (
        operation === 'toJSON' ||
        (operation === 'snapshot' &&
          (raw || implementation === 'wrapper+listeners'))
      ) {
        const restored = new Projection<Entry>(
          300,
          raw || operation === 'toJSON' ? resultSink : eventSink
        )
        try {
          deepStrictEqual(restored.values(), fixture.expected)
        } finally {
          restored.destroy()
        }
      }
      if (
        operation === 'addEventListener' ||
        operation === 'removeEventListener'
      ) {
        map!.dispatchEvent('change', detail)
        deepStrictEqual(
          eventCalls,
          operation === 'addEventListener' ? batch : 0
        )
      }
      if (operation === 'dispatchEvent')
        deepStrictEqual(eventCalls, runs * batch)
    },
    dispose() {
      raw?.destroy()
      map?.destroy()
      resultSink = undefined
      eventSink = undefined
    },
  }
}
