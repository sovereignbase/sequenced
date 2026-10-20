import { Projection } from '@sovereignbase/sequencer'
import type { Result } from '@sovereignbase/sequencer'
import type {
  SerializableKey,
  SequencedMapEntry,
  SequencedMapSnapshot,
  SequencedMapDelta,
  SequencedMapChange,
  SequencedMapEventMap,
  SequencedMapEventListener,
} from './types/type.js'

function keyOf<K extends SerializableKey>(key: K): K {
  if (
    typeof key !== 'string' &&
    (typeof key !== 'number' || !Number.isFinite(key))
  )
    throw new TypeError('Map keys must be strings or finite numbers')
  return (key === 0 ? 0 : key) as K
}

function entryKey<K extends SerializableKey, V>(
  entry: SequencedMapEntry<K, V>
): K {
  if (!Array.isArray(entry) || entry.length !== 2)
    throw new TypeError('Map entries must be [key, value] pairs')
  return keyOf(entry[0])
}

// Keep a target prefix already present in order; deleting/reinserting only the
// remaining keys also preserves native Map iterator behavior for untouched keys.
function preservedKeys<K>(before: Iterable<K>, after: K[]): Set<K> {
  let prefix = 0
  for (const key of before) if (key === after[prefix]) prefix++
  return new Set(after.slice(0, prefix))
}

function changesFor<K extends SerializableKey, V>(
  entries: Iterable<readonly [K, V | undefined]>
): SequencedMapChange<K, V> {
  return Object.fromEntries(entries) as SequencedMapChange<K, V>
}

export class SequencedMap<K extends SerializableKey, V> implements Iterable<
  [K, V]
> {
  private readonly projection: Projection<SequencedMapEntry<K, V>>
  private readonly index = new Map<K, number>()
  private duplicates = new Set<K>()
  private eventTarget?: EventTarget

  constructor(actorID: number, snapshot?: SequencedMapSnapshot<K, V>) {
    this.projection = new Projection(actorID, snapshot)
    try {
      const seen = new Set<K>()
      const duplicates: number[] = []
      this.projection.values().forEach((entry, position) => {
        const key = entryKey(entry)
        if (seen.has(key)) duplicates.push(position)
        else seen.add(key)
      })
      for (const position of duplicates.reverse())
        this.projection.remove(position, position)
      this.refresh()
    } catch (error) {
      this.projection.destroy()
      throw error
    }
  }

  get size(): number {
    return this.index.size
  }
  get [Symbol.toStringTag](): string {
    return 'Map'
  }

  get(key: K): V | undefined {
    const position = this.index.get(keyOf(key))
    return position === undefined
      ? undefined
      : this.projection.value(position)![1]
  }

  has(key: K): boolean {
    return this.index.has(keyOf(key))
  }

  set(key: K, value: V): this {
    key = keyOf(key)
    const position = this.index.get(key)
    const entry: SequencedMapEntry<K, V> = [key, value]
    let delta: SequencedMapDelta<K, V>
    if (position === undefined) {
      const at = this.projection.length()
      delta = this.projection.insert([entry], at)
      this.index.set(key, at)
    } else delta = this.projection.replace([entry], position, position)
    this.dispatchEvent('change', changesFor([[key, value]]))
    this.dispatchEvent('delta', delta)
    return this
  }

  delete(key: K): boolean {
    key = keyOf(key)
    const position = this.index.get(key)
    if (position === undefined) return false
    const deltas: SequencedMapDelta<K, V>[] = []
    if (this.duplicates.has(key)) {
      const positions: number[] = []
      this.projection.values().forEach((entry, at) => {
        if (entryKey(entry) === key) positions.push(at)
      })
      for (const at of positions.reverse())
        deltas.push(this.projection.remove(at, at))
      this.refresh()
    } else {
      deltas.push(this.projection.remove(position, position))
      this.index.delete(key)
      if (position < this.projection.length())
        for (const [other, at] of this.index)
          if (at > position) this.index.set(other, at - 1)
    }
    this.dispatchEvent('change', changesFor([[key, undefined]]))
    for (const delta of deltas) this.dispatchEvent('delta', delta)
    return true
  }

  clear(): void {
    if (!this.size) return
    const changes = changesFor<K, V>(
      Array.from(this.index.keys(), (key) => [key, undefined] as const)
    )
    const delta = this.projection.remove(0, this.projection.length() - 1)
    this.index.clear()
    this.duplicates.clear()
    this.dispatchEvent('change', changes)
    this.dispatchEvent('delta', delta)
  }

  keys(): MapIterator<K> {
    return this.index.keys()
  }

  *values(): MapIterator<V> {
    for (const position of this.index.values())
      yield this.projection.value(position)![1]
  }

  *entries(): MapIterator<[K, V]> {
    for (const [key, position] of this.index)
      yield [key, this.projection.value(position)![1]]
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries()
  }

  forEach(
    callback: (value: V, key: K, map: this) => void,
    thisArg?: unknown
  ): void {
    if (typeof callback !== 'function')
      throw new TypeError('Callback must be a function')
    for (const [key, value] of this)
      Reflect.apply(callback, thisArg, [value, key, this])
  }

  apply(delta: unknown): void {
    const before = this.eventTarget ? new Map(this) : undefined
    this.received(this.projection.apply(delta), before)
  }

  merge(snapshot: SequencedMapSnapshot<K, V>): void {
    const before = this.eventTarget ? new Map(this) : undefined
    this.received(this.projection.merge(snapshot), before)
  }

  private received(
    result: Result<SequencedMapEntry<K, V>> | undefined,
    before?: Map<K, V>
  ): void {
    // Invalid batches can have a valid applied prefix; refresh even if the engine
    // returns undefined, without interpreting or inventing replication metadata.
    if (!result || result[0].length) {
      this.refresh()
      if (before) {
        const after = new Map(this)
        const keep = preservedKeys(before.keys(), [...after.keys()])
        const changes = new Map<K, V | undefined>()
        for (const key of before.keys())
          if (!keep.has(key)) changes.set(key, undefined)
        for (const [key, value] of after)
          if (!keep.has(key) || !Object.is(before.get(key), value))
            changes.set(key, value)
        if (changes.size) this.dispatchEvent('change', changesFor(changes))
      }
    }
    if (result?.[1]?.length) this.dispatchEvent('delta', result[1])
  }

  private refresh(): void {
    const next = new Map<K, number>()
    this.duplicates.clear()
    this.projection.values().forEach((entry, position) => {
      const key = entryKey(entry)
      if (next.has(key)) this.duplicates.add(key)
      else next.set(key, position)
    })
    const keep = preservedKeys(this.index.keys(), [...next.keys()])
    for (const key of this.index.keys())
      if (!keep.has(key)) this.index.delete(key)
    for (const [key, position] of next) this.index.set(key, position)
  }

  snapshot(): void {
    this.dispatchEvent('snapshot', this.toJSON())
  }

  toJSON(): SequencedMapSnapshot<K, V> {
    const [words, values] = this.projection.sequence()
    return [Array.isArray(words) ? words : Array.from(words), values]
  }

  destroy(): void {
    this.projection.destroy()
    this.index.clear()
    this.duplicates.clear()
  }

  [Symbol.for('nodejs.util.inspect.custom')](): Map<K, V> {
    return new Map(this)
  }
  [Symbol.for('Deno.customInspect')](): Map<K, V> {
    return new Map(this)
  }

  addEventListener<E extends keyof SequencedMapEventMap<K, V>>(
    type: E,
    listener: SequencedMapEventListener<K, V, E> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    ;(this.eventTarget ??= new EventTarget()).addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  removeEventListener<E extends keyof SequencedMapEventMap<K, V>>(
    type: E,
    listener: SequencedMapEventListener<K, V, E> | null,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget?.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  dispatchEvent<E extends keyof SequencedMapEventMap<K, V>>(
    type: E,
    detail: SequencedMapEventMap<K, V>[E]
  ): void {
    this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
  }
}
