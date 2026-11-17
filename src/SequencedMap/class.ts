import { unknownError } from '../.errors/unknown.js'
import { Projection } from '@sovereignbase/sequencer'
import { SequencedError } from '../.errors/class.js'
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

/**
 * NOTE FOR AGENTS: DISTINGUISH BETWEEN DOCUMENTATION VALUABLE TO LIBRARY CONSUMERS
 * (PUBLIC API) AND DOCUMENTATION VALUABLE TO LIBRARY DEVELOPERS...
 * INTERNAL IMPLEMENTATION DETAILS ARE PURE NOISE FOR LIBRARY USERS...
 */

/** A physical entry slot, null represents a deleted key. */
export type Slot<K extends SerializableKey, V> = SequencedMapEntry<K, V> | null

/**
 * A replicated map with JavaScript Map-style access and iteration.
 *
 * Keys must be strings or finite numbers. `1` and `"1"` are distinct keys.
 * Object values are stored by reference. Mutating them does not replicate
 * changes, use `set()` to replicate an updated object.
 *
 * @typeParam K The key type.
 * @typeParam V The value type.
 */
export class SequencedMap<K extends SerializableKey, V> implements Iterable<
  [K, V]
> {
  /** The sequencer projection that owns the replicated entries. */
  private readonly projection: Projection<Slot<K, V>>
  /** Physical entry keys, retained so removal patches need no old-value snapshot. */
  private readonly positions: (K | null)[] = []
  /** The first physical position of each visible key. */
  private readonly index = new Map<K, number>()
  /** The number of null slots excluded from the visible key index. */
  private holes = 0
  /** The event target, allocated when the first listener is registered. */
  private eventTarget?: EventTarget

  /**
   *  ██████╗██████╗ ██╗   ██╗██████╗
   * ██╔════╝██╔══██╗██║   ██║██╔══██╗
   * ██║     ██████╔╝██║   ██║██║  ██║
   * ██║     ██╔══██╗██║   ██║██║  ██║
   * ╚██████╗██║  ██║╚██████╔╝██████╔╝
   *  ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝
   */

  /**
   * Creates an empty map or restores a snapshot.
   * @param actorID The identifier of the local editing actor.
   * @param trustedSnaphot Optional replication state to restore.
   * @throws {SequencedError} If initialization fails.
   */
  constructor(actorID: number, trustedSnaphot?: unknown) {
    try {
      this.projection = new Projection<Slot<K, V>>(actorID, trustedSnaphot)
      try {
        for (const entry of this.projection.values()) {
          const key = entry === null ? null : entry[0]
          const at = this.positions.length
          if (key === null || this.index.has(key))
            void this.projection.remove(at, at)
          else {
            void this.index.set(key, at)
            void this.positions.push(key)
          }
        }
      } catch (error) {
        void this.projection.destroy()
        throw error
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.constructor()')
    }
  }

  /** Returns the number entries. */
  get size(): number {
    return this.index.size
  }

  /**
   * Returns the value associated with a key.
   * @param key The key to read.
   * @returns The stored value, or `undefined` if the key is absent.
   */
  get(key: K): V | undefined {
    const position = this.index.get(key)
    return position === undefined ? undefined : this.value(position)![1]
  }

  /**
   * Tests whether the map contains a key, including keys whose value is `undefined`.
   * @param key The key to test.
   * @throws {SequencedError} With code `INVALID_MAP_KEY` if the key is invalid.
   */
  has(key: K): boolean {
    return this.index.has(this.keyOf(key))
  }

  /**
   * Adds or replaces a value and emits `change` and `delta` events.
   * @param key The key to add or update.
   * @param value The value to store.
   * @returns This map.
   * @throws {SequencedError} With code `INVALID_MAP_KEY` if the key is invalid.
   */
  set(key: K, value: V): this {
    try {
      key = this.keyOf(key)
      const position = this.index.get(key)
      const entry: SequencedMapEntry<K, V> = [key, value]
      let delta: SequencedMapDelta<K, V>
      if (position === undefined) {
        const at = this.positions.length
        delta = this.projection.insert([entry], at)
        void this.positions.push(key)
        void this.index.set(key, at)
      } else delta = this.projection.replace([entry], position, position)
      if (this.eventTarget)
        void this.dispatchEvent('change', {
          [key]: value,
        } as SequencedMapChange<K, V>)
      void this.dispatchEvent('delta', delta)
      return this
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.set()')
    }
  }

  /**
   * Deletes an entry.
   * @param key The key to remove.
   * @returns Whether the key existed before deletion.
   * @throws {SequencedError} With code `INVALID_MAP_KEY` if the key is invalid.
   */
  delete(key: K): boolean {
    try {
      key = this.keyOf(key)
      const position = this.index.get(key)
      if (position === undefined) return false
      const positions = this.positions
      const hasDuplicates = positions.length - this.holes > this.index.size
      const delta = this.projection.replace([null], position, position)
      positions[position] = null
      this.holes++
      let combined: Array<SequencedMapDelta<K, V>[number]> | undefined
      if (hasDuplicates)
        for (
          let at = positions.indexOf(key, position + 1);
          at !== -1;
          at = positions.indexOf(key, at + 1)
        ) {
          combined ??= Array.from(delta)
          for (const tuple of this.projection.replace([null], at, at))
            void combined.push(tuple)
          positions[at] = null
          this.holes++
        }
      void this.index.delete(key)
      if (this.eventTarget)
        void this.dispatchEvent('change', {
          [key]: undefined,
        } as SequencedMapChange<K, V>)
      void this.dispatchEvent('delta', combined ?? delta)
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
      this.holes = 0
      void this.index.clear()
      if (changes) void this.dispatchEvent('change', changes)
      void this.dispatchEvent('delta', delta)
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.clear()')
    }
  }

  /** Returns an iterator over the keys. */
  keys(): MapIterator<K> {
    return this.index.keys()
  }

  /** Returns an iterator over the values. */
  *values(): MapIterator<V> {
    for (const at of this.index.values()) yield this.value(at)![1]
  }

  /** Returns an iterator over the entries. */
  *entries(): MapIterator<[K, V]> {
    for (const [key, at] of this.index) yield [key, this.value(at)![1]]
  }

  /** Alias for `entries()`. */
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
      void Reflect.apply(callback, thisArg, [value, key, this])
  }

  /**
   * ██████╗ ███████╗██████╗ ██╗     ██╗ ██████╗ █████╗ ████████╗██╗ ██████╗ ███╗   ██╗
   * ██╔══██╗██╔════╝██╔══██╗██║     ██║██╔════╝██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
   * ██████╔╝█████╗  ██████╔╝██║     ██║██║     ███████║   ██║   ██║██║   ██║██╔██╗ ██║
   * ██╔══██╗██╔══╝  ██╔═══╝ ██║     ██║██║     ██╔══██║   ██║   ██║██║   ██║██║╚██╗██║
   * ██║  ██║███████╗██║     ███████╗██║╚██████╗██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║
   * ╚═╝  ╚═╝╚══════╝╚═╝     ╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
   */

  /**
   * Applies incoming gossip and emits visible changes and any reply gossip.
   * @param delta The received replication data. Sequencer handles transport validation.
   * @remarks This method does not throw.
   */
  apply(delta: unknown): void {
    try {
      void this.received(this.projection.apply(delta))
    } catch {}
  }
  /**
   * Merges another replica's complete sequence and emits the resulting events.
   * @param snapshot The received replication state. Sequencer handles transport validation.
   * @remarks This method does not throw.
   */
  merge(snapshot: unknown): void {
    try {
      void this.received(this.projection.merge(snapshot))
    } catch {}
  }

  /**
   * ██████╗ ███████╗██████╗ ███████╗██╗███████╗████████╗███████╗███╗   ██╗ ██████╗███████╗
   * ██╔══██╗██╔════╝██╔══██╗██╔════╝██║██╔════╝╚══██╔══╝██╔════╝████╗  ██║██╔════╝██╔════╝
   * ██████╔╝█████╗  ██████╔╝███████╗██║███████╗   ██║   █████╗  ██╔██╗ ██║██║     █████╗
   * ██╔═══╝ ██╔══╝  ██╔══██╗╚════██║██║╚════██║   ██║   ██╔══╝  ██║╚██╗██║██║     ██╔══╝
   * ██║     ███████╗██║  ██║███████║██║███████║   ██║   ███████╗██║ ╚████║╚██████╗███████╗
   * ╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝
   */

  /** Synchronously emits a `snapshot` event containing the current replication state. */
  snapshot(): void {
    void this.dispatchEvent('snapshot', this.toJSON())
  }
  /**
   * Used automatically by `JSON.stringify()`.
   * @returns A serializable snapshot of the replication state.
   */
  toJSON(): SequencedMapSnapshot<K, V> {
    try {
      const [words, values] = this.projection.sequence()
      return [Array.isArray(words) ? words : Array.from(words), values]
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.toJSON()')
    }
  }

  /**
   * ██╗     ██╗███████╗███████╗ ██████╗██╗   ██╗ ██████╗██╗     ███████╗
   * ██║     ██║██╔════╝██╔════╝██╔════╝╚██╗ ██╔╝██╔════╝██║     ██╔════╝
   * ██║     ██║█████╗  █████╗  ██║      ╚████╔╝ ██║     ██║     █████╗
   * ██║     ██║██╔══╝  ██╔══╝  ██║       ╚██╔╝  ██║     ██║     ██╔══╝
   * ███████╗██║██║     ███████╗╚██████╗   ██║   ╚██████╗███████╗███████╗
   * ╚══════╝╚═╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝    ╚═════╝╚══════╝╚══════╝
   */

  /** Releases resources held by the map. */
  destroy(): void {
    try {
      void this.projection.destroy()
      this.positions.length = 0
      void this.index.clear()
      this.holes = 0
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.destroy()')
    }
  }

  /**
   * Retires an actor so its acknowledgements are no longer required for compaction.
   * The retirement decision must be applied separately to each replica.
   * @param actorID The actor to retire.
   * @throws {SequencedError} If retirement fails.
   */
  retire(actorID: number): void {
    try {
      void this.projection.retire(actorID)
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.retire()')
    }
  }

  /**
   * ██╗   ██╗████████╗██╗██╗     ██╗████████╗██╗███████╗███████╗
   * ██║   ██║╚══██╔══╝██║██║     ██║╚══██╔══╝██║██╔════╝██╔════╝
   * ██║   ██║   ██║   ██║██║     ██║   ██║   ██║█████╗  ███████╗
   * ██║   ██║   ██║   ██║██║     ██║   ██║   ██║██╔══╝  ╚════██║
   * ╚██████╔╝   ██║   ██║███████╗██║   ██║   ██║███████╗███████║
   *  ╚═════╝    ╚═╝   ╚═╝╚══════╝╚═╝   ╚═╝   ╚═╝╚══════╝╚══════╝
   */

  /** Returns a JavaScript Map of visible entries for Node.js console inspection. */
  [Symbol.for('nodejs.util.inspect.custom')](): Map<K, V> {
    return new Map(this)
  }
  /** Returns a JavaScript Map of visible entries for Deno console inspection. */
  [Symbol.for('Deno.customInspect')](): Map<K, V> {
    return new Map(this)
  }
  /** The built-in object tag, `SequencedMap`. */
  get [Symbol.toStringTag](): string {
    return 'SequencedMap'
  }

  /*
   * ███████╗██╗   ██╗███████╗███╗   ██╗████████╗    ████████╗ █████╗ ██████╗  ██████╗ ███████╗████████╗
   * ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝    ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝ ██╔════╝╚══██╔══╝
   * █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║          ██║   ███████║██████╔╝██║  ███╗█████╗     ██║
   * ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║          ██║   ██╔══██║██╔══██╗██║   ██║██╔══╝     ██║
   * ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║          ██║   ██║  ██║██║  ██║╚██████╔╝███████╗   ██║
   * ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝          ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝
   */

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
      void (this.eventTarget ??= new EventTarget()).addEventListener(
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
      void this.eventTarget?.removeEventListener(
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
      void this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.dispatchEvent()')
    }
  }

  /**
   * ██╗  ██╗███████╗██╗     ██████╗ ███████╗██████╗ ███████╗
   * ██║  ██║██╔════╝██║     ██╔══██╗██╔════╝██╔══██╗██╔════╝
   * ███████║█████╗  ██║     ██████╔╝█████╗  ██████╔╝███████╗
   * ██╔══██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗╚════██║
   * ██║  ██║███████╗███████╗██║     ███████╗██║  ██║███████║
   * ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝
   */

  /** Updates the key index from projection splices and emits the visible changes and reply. */
  private received(result: Result<Slot<K, V>> | undefined): void {
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
    // Rotate only the affected suffix into Projection order, no sort or rebuild.
    for (let at = orderFrom; at < this.positions.length; at++) {
      const key = this.positions[at]
      if (key !== null && this.index.get(key) === at) {
        void this.index.delete(key)
        void this.index.set(key, at)
      }
    }
    if (changed?.size) {
      const detail: Record<K, V | undefined> = Object.create(null)
      for (const key of changed) detail[key] = this.get(key)
      void this.dispatchEvent('change', detail)
    }
    if (result[1]?.length) void this.dispatchEvent('delta', result[1])
  }

  /**
   * Applies one visible splice to the physical key positions and first-entry index.
   * @returns The first position whose iteration order needs updating, or `Infinity`.
   */
  private patch(
    start: number,
    end: number,
    values: Change<Slot<K, V>>[number][2],
    changed?: Set<K>
  ): number {
    const added = values?.length ?? 0
    if (end === start + 1 && added === 1) {
      const entry = values![0]!
      const key = this.positions[start]
      if (entry === null) {
        if (key === null) return Infinity
        const hasDuplicates =
          this.positions.length - this.holes > this.index.size
        this.positions[start] = null
        this.holes++
        if (this.index.get(key) !== start) return Infinity
        void changed?.add(key)
        const next = hasDuplicates ? this.positions.indexOf(key, start + 1) : -1
        if (next === -1) void this.index.delete(key)
        else {
          void this.index.set(key, next)
          return start
        }
        return Infinity
      }
      if (key === entry[0]) {
        if (this.index.get(key) === start) void changed?.add(key)
        return Infinity
      }
    }
    const oldLength = this.positions.length
    const hasDuplicates = oldLength - this.holes > this.index.size
    const shift = added - (end - start)
    let pending = 0
    let orderFrom = Infinity
    for (let at = start; at < end; at++) {
      const key = this.positions[at]
      if (key === null) {
        this.holes--
        continue
      }
      const first = this.index.get(key)
      if (first === at) {
        void changed?.add(key)
        if (hasDuplicates) {
          void this.index.set(key, -1)
          pending++
        } else void this.index.delete(key)
      }
    }
    if (shift) {
      const step = shift > 0 ? -1 : 1
      const stop = shift > 0 ? end - 1 : oldLength
      for (let at = shift > 0 ? oldLength - 1 : end; at !== stop; at += step) {
        const key = this.positions[at]
        if (key === null) continue
        const first = this.index.get(key)!
        const next = at + shift
        if (first !== at) {
          if (first !== -1 && next >= first) continue
          if (first === -1) pending--
          orderFrom = start
        }
        void this.index.set(key, next)
      }
    } else if (pending) {
      for (let at = end; pending && at < oldLength; at++) {
        const key = this.positions[at]
        if (key !== null && this.index.get(key) === -1) {
          void this.index.set(key, at)
          orderFrom = start
          pending--
        }
      }
    }
    for (let at = start; pending && at < end; at++) {
      const key = this.positions[at]
      if (key !== null && this.index.get(key) === -1) {
        void this.index.delete(key)
        pending--
      }
    }
    if (shift > 0) this.positions.length = oldLength + shift
    if (shift !== 0)
      void this.positions.copyWithin(start + added, end, oldLength)
    if (shift < 0) this.positions.length = oldLength + shift
    for (let i = 0; i < added; i++) {
      const at = start + i
      const entry = values![i]!
      if (entry === null) {
        this.positions[at] = null
        this.holes++
        continue
      }
      const key = entry[0]
      this.positions[at] = key
      const first = this.index.get(key)
      if (first === undefined) {
        void this.index.set(key, at)
        void changed?.add(key)
        if (end < oldLength) orderFrom = Math.min(orderFrom, at)
      } else {
        if (at < first) {
          void this.index.set(key, at)
          void changed?.add(key)
          orderFrom = Math.min(orderFrom, at)
        }
      }
    }
    return orderFrom
  }

  /** Reads a projection entry and scopes unexpected failures to this library. */
  private value(at: number): SequencedMapEntry<K, V> {
    try {
      return this.projection.value(at)!
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.value()')
    }
  }

  /** Requires a string or finite number key and normalizes negative zero to zero. */
  private keyOf<K extends SerializableKey>(key: K): K {
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
}
