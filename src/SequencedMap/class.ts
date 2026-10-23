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

/** Requires a string or finite number key and normalizes negative zero to zero. */
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
/** Reads the validated key of a two-element entry restored from a snapshot. */
function entryKey<K extends SerializableKey>(entry: unknown): K {
  if (!Array.isArray(entry) || entry.length !== 2)
    throw new SequencedError(
      'INVALID_MAP_ENTRY',
      'Map entries must be [key, value] pairs'
    )
  return keyOf(entry[0]) as K
}

/**
 * A replicated map with native Map-style access and iteration.
 *
 * String and numeric keys remain distinct. Keys must be strings or finite numbers.
 * Concurrent duplicate entries resolve to the first entry in projection order.
 * Values retain shallow JavaScript references; use `set()` to replicate a changed value.
 *
 * @typeParam K The key type.
 * @typeParam V The value type.
 */
export class SequencedMap<K extends SerializableKey, V> implements Iterable<
  [K, V]
> {
  /** The sequencer projection that owns the replicated entries. */
  private readonly projection: Projection<SequencedMapEntry<K, V>>
  /** The first physical position of each visible key. */
  private readonly index = new Map<K, number>()
  /** Physical entry keys, retained so removal patches need no old-value snapshot. */
  private readonly positions: K[] = []
  /** The event target, allocated when the first listener is registered. */
  private eventTarget?: EventTarget

  /** Reads a projection entry and scopes unexpected failures to this library. */
  #value(at: number): SequencedMapEntry<K, V> {
    try {
      return this.projection.value(at)!
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.#value()')
    }
  }

  /**
   * Creates an empty map or restores a replication snapshot, keeping the first duplicate key.
   * @param actorID The identifier of the local editing actor.
   * @param snapshot Optional replication state to restore.
   * @throws {SequencedError} If initialization fails or a restored entry or key is invalid.
   */
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

  /** Returns the number of visible, distinct keys. */
  get size(): number {
    return this.index.size
  }
  /** The built-in object tag, `Map`. */
  get [Symbol.toStringTag](): string {
    return 'Map'
  }
  /**
   * Returns the value associated with a key.
   * @param key The key to read.
   * @returns The stored value, or `undefined` if the key is absent.
   * @throws {SequencedError} With code `INVALID_MAP_KEY` if the key is invalid.
   */
  get(key: K): V | undefined {
    const position = this.index.get(keyOf(key))
    return position === undefined ? undefined : this.#value(position)![1]
  }
  /**
   * Tests whether the map contains a key, including keys whose value is `undefined`.
   * @param key The key to test.
   * @throws {SequencedError} With code `INVALID_MAP_KEY` if the key is invalid.
   */
  has(key: K): boolean {
    return this.index.has(keyOf(key))
  }

  /**
   * Adds or replaces a value and emits `change` and `delta` events.
   * Existing keys retain their local iteration position; new keys are appended.
   * @param key The key to add or update.
   * @param value The value to store.
   * @returns This map.
   * @throws {SequencedError} With code `INVALID_MAP_KEY` if the key is invalid.
   */
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

  /**
   * Removes a key and its retained duplicate entries, emitting the resulting edit.
   * @param key The key to remove.
   * @returns Whether the key existed before deletion.
   * @throws {SequencedError} With code `INVALID_MAP_KEY` if the key is invalid.
   */
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

  /** Removes all entries and emits their deletions; an empty map produces no edit. */
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

  /** Returns a live iterator over visible keys in map iteration order. */
  keys(): MapIterator<K> {
    return this.index.keys()
  }
  /** Returns a live iterator over visible values in map iteration order. */
  *values(): MapIterator<V> {
    for (const at of this.index.values()) yield this.#value(at)![1]
  }
  /** Returns a live iterator of visible `[key, value]` pairs in map iteration order. */
  *entries(): MapIterator<[K, V]> {
    for (const [key, at] of this.index) yield [key, this.#value(at)![1]]
  }
  /** Returns the same live entry iterator as `entries()`. */
  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries()
  }
  /**
   * Calls a function for each visible entry in map iteration order.
   * @param callback Receives the value, key and this map.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the callback is not callable.
   */
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

  /**
   * Applies incoming gossip and emits visible changes and any reply gossip.
   * @param delta The received replication data. Sequencer handles transport validation.
   * @remarks This method does not throw.
   */
  apply(delta: unknown): void {
    try {
      this.received(this.projection.apply(delta))
    } catch {}
  }
  /**
   * Merges another replica's complete sequence and emits the resulting events.
   * @param snapshot The received replication state. Sequencer handles transport validation.
   * @remarks This method does not throw.
   */
  merge(snapshot: unknown): void {
    try {
      this.received(this.projection.merge(snapshot))
    } catch {}
  }

  /** Synchronously emits a `snapshot` event containing the current replication state. */
  snapshot(): void {
    this.dispatchEvent('snapshot', this.toJSON())
  }
  /**
   * Returns the complete replication state, including retained entry history.
   * Used automatically by `JSON.stringify()`.
   * @returns Structural metadata as a numeric array and the retained entry data.
   */
  toJSON(): SequencedMapSnapshot<K, V> {
    try {
      const [words, values] = this.projection.sequence()
      return [Array.isArray(words) ? words : Array.from(words), values]
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.toJSON()')
    }
  }
  /** Releases the native sequence state and clears the local key index. */
  destroy(): void {
    try {
      this.projection.destroy()
      this.index.clear()
      this.positions.length = 0
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.destroy()')
    }
  }
  /** Returns a native Map of visible entries for Node.js console inspection. */
  [Symbol.for('nodejs.util.inspect.custom')](): Map<K, V> {
    return new Map(this)
  }
  /** Returns a native Map of visible entries for Deno console inspection. */
  [Symbol.for('Deno.customInspect')](): Map<K, V> {
    return new Map(this)
  }
  /**
   * Registers a callback or listener object for a typed collection event.
   * @param type The event name.
   * @param listener The listener to register; `null` is ignored.
   * @param options A capture flag or options such as `once` and `signal`.
   */
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
  /**
   * Removes a listener with the matching event name, identity and capture flag.
   * @param type The event name.
   * @param listener The previously registered listener.
   * @param options The capture flag, directly or within listener options.
   */
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
  /**
   * Synchronously dispatches a typed `CustomEvent` to registered listeners.
   * @param type The event name.
   * @param detail The value exposed as `event.detail`.
   */
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

  /** Updates the key index from projection splices and emits the visible changes and reply. */
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

  /**
   * Applies one visible splice to the physical key positions and first-entry index.
   * @returns The first position whose iteration order needs updating, or `Infinity`.
   */
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
