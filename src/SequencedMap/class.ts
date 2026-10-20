import { Projection } from '@sovereignbase/sequencer'
import type { Change, Result } from '@sovereignbase/sequencer'
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
function entryKey<K extends SerializableKey>(entry: unknown): K {
  if (!Array.isArray(entry) || entry.length !== 2)
    throw new TypeError('Map entries must be [key, value] pairs')
  return keyOf(entry[0]) as K
}

// Malformed batches can discard the engine's returned prefix patches. Only that
// path uses individual tuples; ordinary Gossip is applied once, unchanged.
function validTuple(entry: unknown): boolean {
  const insertion = Array.isArray(entry) && typeof entry[0] !== 'number'
  const words = insertion ? entry[0] : entry
  if (!(Array.isArray(words) || words instanceof Uint32Array)) return false
  if (insertion) {
    if (
      entry.length > 2 ||
      words.length !== 6 ||
      (entry[1] !== undefined && !Array.isArray(entry[1]))
    )
      return false
  } else if (!words.length || words.length % 2 !== 1) return false
  if (Array.isArray(words))
    for (let i = 0; i < words.length; i++) {
      if (
        i in words &&
        (!Number.isInteger(words[i]) || words[i] < 0 || words[i] > 0xffffffff)
      )
        return false
    }
  return true
}

function validBatch(delta: unknown[]): boolean {
  for (let i = 0; i < delta.length; i++) if (!validTuple(delta[i])) return false
  return true
}

export class SequencedMap<K extends SerializableKey, V> implements Iterable<
  [K, V]
> {
  private readonly projection: Projection<SequencedMapEntry<K, V>>
  private readonly index = new Map<K, number>()
  // Only keys are mirrored, so removal patches need no old-value snapshot.
  private readonly positions: K[] = []
  private duplicates?: Map<K, number>
  private eventTarget?: EventTarget

  constructor(actorID: number, snapshot?: SequencedMapSnapshot<K, V>) {
    this.projection = new Projection(actorID, snapshot)
    try {
      let duplicates: number[] | undefined
      const entries = this.projection.values()
      for (let at = 0; at < entries.length; at++) {
        const key = entryKey<K>(entries[at])
        if (this.index.has(key)) (duplicates ??= []).push(at)
        else {
          this.index.set(key, this.positions.length)
          this.positions.push(key)
        }
      }
      if (duplicates)
        for (let i = duplicates.length - 1; i >= 0; i--)
          this.projection.remove(duplicates[i], duplicates[i])
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
      const at = this.positions.length
      delta = this.projection.insert([entry], at)
      this.positions.push(key)
      this.index.set(key, at)
    } else delta = this.projection.replace([entry], position, position)
    if (this.eventTarget)
      this.dispatchEvent('change', { [key]: value } as SequencedMapChange<K, V>)
    this.dispatchEvent('delta', delta)
    return this
  }

  delete(key: K): boolean {
    key = keyOf(key)
    const position = this.index.get(key)
    if (position === undefined) return false
    let delta: SequencedMapDelta<K, V>
    if (this.duplicates?.has(key)) {
      const replies: Array<SequencedMapDelta<K, V>[number]> = []
      for (let at = this.positions.length - 1; at >= position; at--)
        if (this.positions[at] === key)
          for (const tuple of this.projection.remove(at, at))
            replies.push(tuple)
      delta = replies
      this.duplicates.delete(key)
    } else delta = this.projection.remove(position, position)
    this.index.delete(key)
    let write = position
    for (let read = position + 1; read < this.positions.length; read++) {
      const other = this.positions[read]
      if (other === key) continue
      this.positions[write] = other
      if (this.index.get(other) === read) this.index.set(other, write)
      write++
    }
    this.positions.length = write
    if (this.eventTarget)
      this.dispatchEvent('change', { [key]: undefined } as SequencedMapChange<
        K,
        V
      >)
    this.dispatchEvent('delta', delta)
    return true
  }

  clear(): void {
    if (!this.size) return
    let changes: Record<K, V | undefined> | undefined
    if (this.eventTarget) {
      changes = Object.create(null)
      for (const key of this.index.keys()) changes![key] = undefined
    }
    const delta = this.projection.remove(0, this.positions.length - 1)
    this.positions.length = 0
    this.index.clear()
    this.duplicates?.clear()
    if (changes) this.dispatchEvent('change', changes)
    this.dispatchEvent('delta', delta)
  }

  keys(): MapIterator<K> {
    return this.index.keys()
  }
  *values(): MapIterator<V> {
    for (const at of this.index.values()) yield this.projection.value(at)![1]
  }
  *entries(): MapIterator<[K, V]> {
    for (const [key, at] of this.index)
      yield [key, this.projection.value(at)![1]]
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
    if (!Array.isArray(delta) || delta.length < 2 || validBatch(delta)) {
      this.received(this.projection.apply(delta))
      return
    }
    const lane = [delta[0]]
    for (let i = 0; i < delta.length; i++) {
      lane[0] = delta[i]
      const result = this.projection.apply(lane)
      this.received(result)
      if (!result) break
    }
  }
  merge(snapshot: SequencedMapSnapshot<K, V>): void {
    this.received(this.projection.merge(snapshot))
  }

  private received(result: Result<SequencedMapEntry<K, V>> | undefined): void {
    if (!result) return
    const patches = result[0]
    const changed =
      this.eventTarget && patches.length ? new Set<K>() : undefined
    let orderFrom = Infinity
    for (let i = 0; i < patches.length; i++) {
      const [start, end, values] = patches[i]
      const next = patches[i + 1]
      let removeEnd = end
      let inserted = values
      // Replacement splices can arrive in either remove/insert order.
      if (next) {
        if (
          end > start &&
          !values?.length &&
          next[0] === start &&
          next[1] === start
        ) {
          inserted = next[2]
          i++
        } else if (
          end === start &&
          values?.length &&
          !next[2]?.length &&
          next[0] === start + values.length
        ) {
          removeEnd = start + next[1] - next[0]
          i++
        }
      }
      orderFrom = Math.min(
        orderFrom,
        this.patch(start, removeEnd, inserted, changed)
      )
    }
    // Rotate only the affected suffix into Projection order; no sort or rebuild.
    for (let at = orderFrom; at < this.positions.length; at++) {
      const key = this.positions[at]
      if (this.index.get(key) === at) {
        this.index.delete(key)
        this.index.set(key, at)
      }
    }
    if (changed?.size) {
      const detail: Record<K, V | undefined> = Object.create(null)
      for (const key of changed) detail[key] = this.get(key)
      this.dispatchEvent('change', detail)
    }
    if (result[1]?.length) this.dispatchEvent('delta', result[1])
  }

  private patch(
    start: number,
    end: number,
    values: Change<SequencedMapEntry<K, V>>[number][2],
    changed?: Set<K>
  ): number {
    const added = values?.length ?? 0
    if (
      end === start + 1 &&
      added === 1 &&
      this.positions[start] === entryKey<K>(values![0])
    ) {
      const key = this.positions[start]
      if (this.index.get(key) === start) changed?.add(key)
      return Infinity
    }
    const oldLength = this.positions.length
    const shift = added - (end - start)
    let pending = 0
    let orderFrom = Infinity
    for (let at = start; at < end; at++) {
      const key = this.positions[at]
      const first = this.index.get(key)!
      const count = this.duplicates?.get(key) ?? 1
      if (first === at) changed?.add(key)
      if (count === 1) {
        this.index.delete(key)
        if (first === -1) pending--
      } else {
        if (count === 2) this.duplicates!.delete(key)
        else this.duplicates!.set(key, count - 1)
        if (first === at) {
          this.index.set(key, -1)
          pending++
          orderFrom = start
        }
      }
    }
    // Move integer positions in the direction that cannot mistake a shifted
    // winner for a later duplicate of the same key.
    if (shift > 0)
      for (let at = oldLength - 1; at >= end; at--) {
        const key = this.positions[at]
        if (this.index.get(key) === at) this.index.set(key, at + shift)
      }
    else if (shift < 0)
      for (let at = end; at < oldLength; at++) {
        const key = this.positions[at]
        if (this.index.get(key) === at) this.index.set(key, at + shift)
      }
    if (shift > 0) this.positions.length = oldLength + shift
    if (shift !== 0) this.positions.copyWithin(start + added, end, oldLength)
    if (shift < 0) this.positions.length = oldLength + shift
    for (let at = start + added; pending && at < this.positions.length; at++) {
      const key = this.positions[at]
      if (this.index.get(key) === -1) {
        this.index.set(key, at)
        pending--
      }
    }
    for (let i = 0; i < added; i++) {
      const at = start + i
      const key = entryKey<K>(values![i])
      this.positions[at] = key
      const first = this.index.get(key)
      if (first === undefined) {
        this.index.set(key, at)
        changed?.add(key)
        if (end < oldLength) orderFrom = Math.min(orderFrom, at)
      } else {
        ;(this.duplicates ??= new Map()).set(
          key,
          (this.duplicates?.get(key) ?? 1) + 1
        )
        if (at < first) {
          this.index.set(key, at)
          changed?.add(key)
          orderFrom = Math.min(orderFrom, at)
        }
      }
    }
    return orderFrom
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
    this.positions.length = 0
    this.duplicates?.clear()
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
