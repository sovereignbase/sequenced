import { Projection } from '@sovereignbase/sequencer'
import { SequencedError, unknownError } from '../.errors/class.js'
import type { Gossip, Sequence } from '@sovereignbase/sequencer'
import type { CanonicalData } from '../.types/type.js'
import type {
  SequencedSetEventMap,
  SequencedSetEventListenerFor,
} from './types/type.js'
import { WritableArray } from '@sovereignbase/utils'

/**
 * NOTE FOR AGENTS: DISTINGUISH BETWEEN DOCUMENTATION VALUABLE TO LIBRARY CONSUMERS
 * (PUBLIC API) AND DOCUMENTATION VALUABLE TO LIBRARY DEVELOPERS...
 * INTERNAL IMPLEMENTATION DETAILS ARE PURE NOISE FOR LIBRARY USERS...
 */

/**
 * A replicated set of unique string or number values with synchronous editing
 * and typed events.
 */
export class SequencedSet<V extends CanonicalData> implements Iterable<V> {
  /** The visible set of unique values. */
  private readonly set: Set<V>
  /** The sequencer projection that owns the replicated values. */
  private readonly projection: Projection<V>
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
   * Creates an empty set or restores a replication snapshot.
   * @param actorID The identifier of the local editing actor.
   * @param trustedSnapshot Optional replication state to restore.
   * @throws {SequencedError} If the underlying projection cannot be created.
   */
  constructor(
    actorID: number,
    public readonly regex?: RegExp,
    trustedSnapshot?: unknown
  ) {
    try {
      this.set = new Set<V>()
      this.projection = new Projection<V>(actorID, trustedSnapshot)
      try {
        for (let i = this.projection.length() - 1; i >= 0; i--) {
          const value = this.projection.value(i)
          if (
            (typeof value !== 'string' && typeof value !== 'number') ||
            (regex && !regex.test(String(value)))
          )
            void this.projection.remove(i, i)
          else if (this.set.has(value)) continue
          else void this.set.add(value)
        }
      } catch (error) {
        void this.projection.destroy()
        void this.set.clear()
        throw error
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.constructor()')
    }
  }

  /** Returns the number of unique values. */
  get size(): number {
    return this.set.size
  }

  /** Returns whether the set contains the specified value. */
  has(value: V): boolean {
    return this.set.has(value)
  }

  /**
   * Adds a value if it is not already present and dispatches `delta` and
   * `change` events.
   * @param value The value to add.
   * @throws {SequencedError} If the underlying projection cannot perform the insertion.
   */
  add(value: V): void {
    try {
      if (typeof value !== 'string' && typeof value !== 'number')
        throw new SequencedError(
          'INVALID_SET_VALUE',
          'Set values must be strings or numbers'
        )

      if (this.regex && !this.regex.test(String(value)))
        throw new SequencedError(
          'INVALID_SET_VALUE',
          'Set values must be strings or numbers'
        )

      if (this.set.has(value)) return

      const delta = this.projection.insert([value], this.projection.length())
      void this.set.add(value)

      void this.dispatchEvent('change', 1)
      void this.dispatchEvent('delta', delta)
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.add()')
    }
  }

  /**
   * Removes a value if present and dispatches `delta` and `change` events.
   * @param value The value to remove.
   * @throws {SequencedError} If the underlying projection cannot perform the removal.
   */
  delete(value: V): void {
    try {
      if (!this.set.delete(value)) return

      const deltas: WritableArray<Gossip<V>> = []

      for (let i = this.projection.length() - 1; i >= 0; i--)
        if (this.projection.value(i) === value)
          void deltas.push(...this.projection.remove(i, i))

      void this.dispatchEvent('change', -1)
      void this.dispatchEvent('delta', deltas)
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.delete()')
    }
  }

  /** Removes all values and emits their deletions; an empty set produces no edit. */
  clear(): void {
    try {
      if (!this.size) return

      const size = this.size
      const delta = this.projection.remove()
      void this.set.clear()

      void this.dispatchEvent('change', -size)
      void this.dispatchEvent('delta', delta)
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.clear()')
    }
  }

  /** Returns an iterator over the values. */
  keys(): SetIterator<V> {
    return this.set.keys()
  }

  /** Returns an iterator over the values. */
  values(): SetIterator<V> {
    return this.set.values()
  }

  /** Returns an iterator over the entries. */
  entries(): SetIterator<[V, V]> {
    return this.set.entries()
  }

  /** Alias for `values()`. */
  [Symbol.iterator](): SetIterator<V> {
    return this.values()
  }

  /**
   * Calls a function for each visible entry in set iteration order.
   * @param callback Receives the value, key and this set.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the callback is not callable.
   */
  forEach(
    callback: (value: V, key: V, set: this) => void,
    thisArg?: unknown
  ): void {
    if (typeof callback !== 'function')
      throw new SequencedError(
        'INVALID_CALLBACK',
        'Callback must be a function'
      )
    for (const value of this)
      void Reflect.apply(callback, thisArg, [value, value, this])
  }

  /**
   * ██████╗ ███████╗██████╗ ██╗     ██╗ ██████╗ █████╗ ████████╗██╗ ██████╗ ███╗   ██╗
   * ██╔══██╗██╔════╝██╔══██╗██║     ██║██╔════╝██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
   * ██████╔╝█████╗  ██████╔╝██║     ██║██║     ███████║   ██║   ██║██║   ██║██╔██╗ ██║
   * ██╔══██╗██╔══╝  ██╔═══╝ ██║     ██║██║     ██╔══██║   ██║   ██║██║   ██║██║╚██╗██║
   * ██║  ██║███████╗██║     ███████╗██║╚██████╗██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║
   * ╚═╝  ╚═╝╚══════╝╚═╝     ╚══════╝╚═╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═════╝
   */

  /**
   * Applies incoming gossip and emits visible set changes and any reply gossip.
   * @param delta The received replication data. Sequencer handles transport validation.
   * @remarks This method does not throw.
   */
  apply(delta: unknown): void {
    try {
      const result = this.projection.apply(delta)
      if (!result) return

      const [change, gossip] = result
      if (change?.length) {
        const previousSize = this.size

        if (change.some(([start, end]) => end > start)) {
          void this.set.clear()
          for (const value of this.projection.values())
            if (typeof value === 'string' || typeof value === 'number')
              void this.set.add(value)
        } else {
          for (const [, , values] of change)
            if (values)
              for (const value of values)
                if (typeof value === 'string' || typeof value === 'number')
                  void this.set.add(value)
        }

        void this.dispatchEvent('change', this.size - previousSize)
      }
      if (gossip?.length) void this.dispatchEvent('delta', gossip)
    } catch {}
  }

  /**
   * Merges another replica's complete sequence and emits the resulting events.
   * @param snapshot The received replication state. Sequencer handles transport validation.
   * @remarks This method does not throw.
   */
  merge(snapshot: unknown): void {
    try {
      const result = this.projection.merge(snapshot)
      if (!result) return

      const [change, delta] = result
      if (change?.length) {
        const previousSize = this.size

        if (change.some(([start, end]) => end > start)) {
          void this.set.clear()
          for (const value of this.projection.values())
            if (typeof value === 'string' || typeof value === 'number')
              void this.set.add(value)
        } else {
          for (const [, , values] of change)
            if (values)
              for (const value of values)
                if (typeof value === 'string' || typeof value === 'number')
                  void this.set.add(value)
        }

        void this.dispatchEvent('change', this.size - previousSize)
      }
      if (delta?.length) void this.dispatchEvent('delta', delta)
    } catch {}
  }

  /**
   * ██████╗ ███████╗██████╗ ███████╗██╗███████╗████████╗███████╗███╗   ██╗ ██████╗███████╗
   * ██╔══██╗██╔════╝██╔══██╗██╔════╝██║██╔════╝╚══██╔══╝██╔════╝████╗  ██║██╔════╝██╔════╝
   * ██████╔╝█████╗  ██████╔╝███████╗██║███████╗   ██║   █████╗  ██╔██╗ ██║██║     █████╗
   * ██╔═══╝ ██╔══╝  ██╔══██╗╚════██║██║╚════██║   ██║   ██╔══╝  ██╔██╗ ██║██║     ██╔══╝
   * ██║     ███████╗██║  ██║███████║██║███████║   ██║   ███████╗██║ ╚████║╚██████╗███████╗
   * ╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝
   */

  /**
   * Synchronously emits a `snapshot` event containing the current replication state.
   */
  snapshot(): void {
    void this.dispatchEvent('snapshot', this.toJSON())
  }

  /**
   * Used automatically by `JSON.stringify()`.
   * @returns A serializable snapshot of the replication state.
   */
  toJSON(): Sequence<V> {
    try {
      return this.projection.sequence()
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.toJSON()')
    }
  }

  /**
   * ██╗     ██╗███████╗███████╗ ██████╗██╗   ██╗ ██████╗██╗     ███████╗
   * ██║     ██║██╔════╝██╔════╝██╔════╝╚██╗ ██╔╝██╔════╝██║     ██╔════╝
   * ██║     ██║█████╗  █████╗  ██║      ╚████╔╝ ██║     ██║     █████╗
   * ██║     ██║██╔══╝  ██╔══╝  ██║       ╚██╔╝  ██║     ██║     ██╔══╝
   * ███████╗██║██║     ███████╗╚██████╗   ██║   ╚██████╗███████╗███████╗
   * ╚══════╝╚═╝╚══════╝╚═╝     ╚══════╝   ╚═╝    ╚════╝╚══════╝╚══════╝
   */

  /** Releases resources held by the set. */
  destroy(): void {
    try {
      void this.projection.destroy()
      void this.set.clear()
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.destroy()')
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
      throw unknownError(cause, 'SequencedSet.retire()')
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

  /** Returns a JavaScript Set of visible values for Node.js console inspection. */
  [Symbol.for('nodejs.util.inspect.custom')](): Set<V> {
    return new Set(this)
  }

  /** Returns a JavaScript Set of visible values for Deno console inspection. */
  [Symbol.for('Deno.customInspect')](): Set<V> {
    return new Set(this)
  }

  /** The built-in object tag, `SequencedSet`. */
  get [Symbol.toStringTag](): string {
    return 'SequencedSet'
  }

  /**
   * ███████╗██╗   ██╗███████╗███╗   ██╗████████╗    ████████╗ █████╗ ██████╗  ██████╗ ███████╗████████╗
   * ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝    ╚══██╔══╝██║╔══██╗██╔══██╗██╔════╝ ██╔════╝╚══██╔══╝
   * █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║          ██║   ███████║██████╔╝██║  ███╗█████╗     ██║
   * ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║          ██║   ███████║██╔══██╗██║   ██║██╔══╝     ██║
   * ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║          ██║   ██║  ██║██║  ██║╚██████╔╝███████╗   ██║
   * ╚══════╝  ╚═══╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝          ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝
   */

  /**
   * Registers a callback or listener object for a typed set event.
   * @param type The event name.
   * @param listener The listener to register; `null` is ignored.
   * @param options A capture flag or options such as `once` and `signal`.
   */
  addEventListener<K extends keyof SequencedSetEventMap>(
    type: K,
    listener: SequencedSetEventListenerFor<K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    try {
      void (this.eventTarget ??= new EventTarget()).addEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.addEventListener()')
    }
  }

  /**
   * Removes a listener with the matching event name, identity and capture flag.
   * @param type The event name.
   * @param listener The previously registered listener.
   * @param options The capture flag, directly or within listener options.
   */
  removeEventListener<K extends keyof SequencedSetEventMap>(
    type: K,
    listener: SequencedSetEventListenerFor<K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      void this.eventTarget?.removeEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.removeEventListener()')
    }
  }

  /**
   * Synchronously dispatches a typed `CustomEvent` to registered listeners.
   * @param type The event name.
   * @param detail The value exposed as `event.detail`.
   */
  dispatchEvent<K extends keyof SequencedSetEventMap>(
    type: K,
    detail: SequencedSetEventMap[K]
  ): void {
    try {
      void this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.dispatchEvent()')
    }
  }
}
