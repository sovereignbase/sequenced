import { unknownError } from '../errors/unknown.js'
import { Projection } from '@sovereignbase/sequencer'
import { SequencedError } from '../errors/class.js'
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
    throw new SequencedError(
      'INVALID_MAP_KEY',
      'Map keys must be strings or finite numbers'
    )
  return (key === 0 ? 0 : key) as K
}
function entryKey<K extends SerializableKey>(entry: unknown): K {
  if (!Array.isArray(entry) || entry.length !== 2)
    throw new SequencedError(
      'INVALID_MAP_ENTRY',
      'Map entries must be [key, value] pairs'
    )
  return keyOf(entry[0]) as K
}

export class SequencedMap<K extends SerializableKey, V> implements Iterable<
  [K, V]
> {
  private readonly projection: Projection<SequencedMapEntry<K, V>>
  private readonly index = new Map<K, number>()
  // Only keys are mirrored, so removal patches need no old-value snapshot.
  private readonly positions: K[] = []
  private eventTarget?: EventTarget

  #value(at: number): SequencedMapEntry<K, V> {
    try {
      return this.projection.value(at)!
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.#value()')
    }
  }

  constructor(actorID: number, snapshot?: unknown) {
    try {
      this.projection = new Projection<SequencedMapEntry<K, V>>(
        actorID,
        snapshot
      )
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
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.constructor()')
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
    return position === undefined ? undefined : this.#value(position)![1]
  }
  has(key: K): boolean {
    return this.index.has(keyOf(key))
  }

  set(key: K, value: V): this {
    try {
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
        this.dispatchEvent('change', { [key]: value } as SequencedMapChange<
          K,
          V
        >)
      this.dispatchEvent('delta', delta)
      return this
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.set()')
    }
  }

  delete(key: K): boolean {
    try {
      key = keyOf(key)
      const position = this.index.get(key)
      if (position === undefined) return false
      const positions = this.positions
      const index = this.index
      const length = positions.length
      const hasDuplicates = length > index.size
      const delta = this.projection.remove(position, position)
      let combined: Array<SequencedMapDelta<K, V>[number]> | undefined
      if (hasDuplicates) {
        let removed = 1
        for (
          let at = positions.indexOf(key, position + 1);
          at !== -1;
          at = positions.indexOf(key, at + 1)
        ) {
          combined ??= Array.from(delta)
          for (const tuple of this.projection.remove(
            at - removed,
            at - removed
          ))
            combined.push(tuple)
          removed++
        }
      }
      index.delete(key)
      let write = position
      for (let read = position + 1; read < length; read++) {
        const other = positions[read]
        if (other === key) continue
        positions[write] = other
        if (index.get(other) === read) index.set(other, write)
        write++
      }
      positions.length = write
      if (this.eventTarget)
        this.dispatchEvent('change', { [key]: undefined } as SequencedMapChange<
          K,
          V
        >)
      this.dispatchEvent('delta', combined ?? delta)
      return true
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.delete()')
    }
  }

  clear(): void {
    try {
      if (!this.size) return
      let changes: Record<K, V | undefined> | undefined
      if (this.eventTarget) {
        changes = Object.create(null)
        for (const key of this.index.keys()) changes![key] = undefined
      }
      const delta = this.projection.remove(0, this.positions.length - 1)
      this.positions.length = 0
      this.index.clear()
      if (changes) this.dispatchEvent('change', changes)
      this.dispatchEvent('delta', delta)
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.clear()')
    }
  }

  keys(): MapIterator<K> {
    return this.index.keys()
  }
  *values(): MapIterator<V> {
    for (const at of this.index.values()) yield this.#value(at)![1]
  }
  *entries(): MapIterator<[K, V]> {
    for (const [key, at] of this.index) yield [key, this.#value(at)![1]]
  }
  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries()
  }
  forEach(
    callback: (value: V, key: K, map: this) => void,
    thisArg?: unknown
  ): void {
    if (typeof callback !== 'function')
      throw new SequencedError(
        'INVALID_CALLBACK',
        'Callback must be a function'
      )
    for (const [key, value] of this)
      Reflect.apply(callback, thisArg, [value, key, this])
  }

  apply(delta: unknown): void {
    try {
      this.received(this.projection.apply(delta))
    } catch {}
  }
  merge(snapshot: unknown): void {
    try {
      this.received(this.projection.merge(snapshot))
    } catch {}
  }

  snapshot(): void {
    this.dispatchEvent('snapshot', this.toJSON())
  }
  toJSON(): SequencedMapSnapshot<K, V> {
    try {
      const [words, values] = this.projection.sequence()
      return [Array.isArray(words) ? words : Array.from(words), values]
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.toJSON()')
    }
  }
  destroy(): void {
    try {
      this.projection.destroy()
      this.index.clear()
      this.positions.length = 0
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.destroy()')
    }
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
    try {
      ;(this.eventTarget ??= new EventTarget()).addEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.addEventListener()')
    }
  }
  removeEventListener<E extends keyof SequencedMapEventMap<K, V>>(
    type: E,
    listener: SequencedMapEventListener<K, V, E> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      this.eventTarget?.removeEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.removeEventListener()')
    }
  }
  dispatchEvent<E extends keyof SequencedMapEventMap<K, V>>(
    type: E,
    detail: SequencedMapEventMap<K, V>[E]
  ): void {
    try {
      this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.dispatchEvent()')
    }
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

  // HELPERS

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
      this.positions[start] === values![0]![0]
    ) {
      const key = this.positions[start]
      if (this.index.get(key) === start) changed?.add(key)
      return Infinity
    }
    const oldLength = this.positions.length
    const hasDuplicates = oldLength > this.index.size
    const shift = added - (end - start)
    let pending = 0
    let orderFrom = Infinity
    for (let at = start; at < end; at++) {
      const key = this.positions[at]
      const first = this.index.get(key)
      if (first === at) {
        changed?.add(key)
        if (hasDuplicates) {
          this.index.set(key, -1)
          pending++
        } else this.index.delete(key)
      }
    }
    if (shift) {
      const step = shift > 0 ? -1 : 1
      const stop = shift > 0 ? end - 1 : oldLength
      for (let at = shift > 0 ? oldLength - 1 : end; at !== stop; at += step) {
        const key = this.positions[at]
        const first = this.index.get(key)!
        const next = at + shift
        if (first !== at) {
          if (first !== -1 && next >= first) continue
          if (first === -1) pending--
          orderFrom = start
        }
        this.index.set(key, next)
      }
    } else if (pending) {
      for (let at = end; pending && at < oldLength; at++) {
        const key = this.positions[at]
        if (this.index.get(key) === -1) {
          this.index.set(key, at)
          orderFrom = start
          pending--
        }
      }
    }
    for (let at = start; pending && at < end; at++) {
      const key = this.positions[at]
      if (this.index.get(key) === -1) {
        this.index.delete(key)
        pending--
      }
    }
    if (shift > 0) this.positions.length = oldLength + shift
    if (shift !== 0) this.positions.copyWithin(start + added, end, oldLength)
    if (shift < 0) this.positions.length = oldLength + shift
    for (let i = 0; i < added; i++) {
      const at = start + i
      const key = values![i]![0]
      this.positions[at] = key
      const first = this.index.get(key)
      if (first === undefined) {
        this.index.set(key, at)
        changed?.add(key)
        if (end < oldLength) orderFrom = Math.min(orderFrom, at)
      } else {
        if (at < first) {
          this.index.set(key, at)
          changed?.add(key)
          orderFrom = Math.min(orderFrom, at)
        }
      }
    }
    return orderFrom
  }
}
