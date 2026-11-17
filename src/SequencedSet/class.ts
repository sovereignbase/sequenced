import { unknownError } from '../.errors/unknown.js'
import { Projection, Sequence } from '@sovereignbase/sequencer'
import { CanonicalData } from '../.types/type.js'
import { SequencedError } from '../.errors/class.js'

/**
 * NOTE FOR AGENTS: DISTINGUISH BETWEEN DOCUMENTATION VALUABLE TO LIBRARY CONSUMERS
 * (PUBLIC API) AND DOCUMENTATION VALUABLE TO LIBRARY DEVELOPERS...
 * INTERNAL IMPLEMENTATION DETAILS ARE PURE NOISE FOR LIBRARY USERS...
 */

/**
 * A replicated text document with synchronous editing and typed events.
 *
 * Positions and lengths are measured in UTF-16 code units. Editing ranges include
 * the start position and exclude the end position.
 */
export class SequencedSet<V extends CanonicalData> {
  /** */
  private readonly set: Set<V>
  /** The sequencer projection that owns the document's UTF-16 content. */
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
   * Creates an empty text document or restores a replication snapshot.
   * @param actorID The identifier of the local editing actor.
   * @param trustedSnapshot Optional replication state to restore.
   * @throws {SequencedError} If the underlying projection cannot be created.
   */
  constructor(actorID: number, trustedSnapshot?: unknown) {
    try {
      this.set = new Set()
      this.projection = new Projection<V>(actorID, trustedSnapshot)
      //
      for (let i = this.projection.length(); i > 0; i--) {
        const value = this.projection.value(i)
        if (
          typeof value !== 'string' ||
          typeof value !== 'number' ||
          this.set.has(value)
        ) {
          void this.projection.remove(i, i)
        } else {
          this.set.add(value)
        }
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.constructor()')
    }
  }

  has(value: V): boolean {
    return this.set.has(value)
  }

  /**
   * Inserts text at the specified position and dispatches `delta` and `change` events.
   * An empty string leaves the document unchanged.
   *
   * @param at The insertion position, measured in UTF-16 code units.
   * @param characters The text to insert.
   * @throws {SequencedError} If the underlying projection cannot perform the insertion.
   */
  add(value: V): void {
    try {
      if (this.set.has(value)) return
      void this.set.add(value)
      const result = this.projection.insert([value], this.projection.length())

      void this.dispatchEvent('change', undefined)
      void this.dispatchEvent('delta', undefined)
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.add()')
    }
  }

  /**
   * Removes the selected text and dispatches `delta` and `change` events.
   * An empty selection leaves the document unchanged.
   *
   * @param selectionStart The inclusive start position in UTF-16 code units. Defaults to zero.
   * @param selecectionEnd The exclusive end position in UTF-16 code units. Defaults to `length`.
   * @throws {SequencedError} If the underlying projection cannot perform the removal.
   */
  delete(value: V): void {
    try {
      if (!this.set.delete(value)) return

      void this.dispatchEvent('change', -1)
      void this.dispatchEvent('delta', [])
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.remove()')
    }
  }

  /** Removes all entries and emits their deletions; an empty map produces no edit. */
  clear(): void {
    try {
      if (!this.size) return
      if (this.eventTarget) {
        changes = Object.create(null)
        for (const key of this.index.keys()) changes![key] = undefined
      }
      const delta = this.projection.remove(0, this.positions.length - 1)
      void this.set.clear()
      if (changes) void this.dispatchEvent('change', changes)
      void this.dispatchEvent('delta', delta)
    } catch (cause) {
      throw unknownError(cause, 'SequencedMap.clear()')
    }
  }

  /** Returns an iterator over the keys. */
  keys(): SetIterator<V> {
    return this.set.keys()
  }

  /** Returns an iterator over the values. */
  *values(): SetIterator<V> {
    return this.set.values()
  }

  /** Returns an iterator over the entries. */
  *entries(): SetIterator<[V, V]> {
    return this.set.entries()
  }

  /** Alias for `entries()`. */
  [Symbol.iterator](): SetIterator<[V, V]> {
    return this.entries()
  }

  /**
   * Calls a function for each visible entry in map iteration order.
   * @param callback Receives the value, key and this map.
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
    for (const [key, value] of this)
      void Reflect.apply(callback, thisArg, [value, key, this])
  }

  /**
   * Returns the visible text as a string.
   */
  valueOf(): string {
    try {
      return this.projection.values().join('')
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.valueOf()')
    }
  }

  /**
   * Returns the visible text as a string.
   */
  toString(): string {
    return this.valueOf()
  }

  /**
   * Returns the length of the visible text in UTF-16 code units.
   */
  get size(): number {
    try {
      return this.set.size
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.size()')
    }
  }

  /**
   * Returns the visible text when the document is converted to a primitive value.
   */
  [Symbol.toPrimitive](): string {
    return this.valueOf()
  }

  /**
   * Returns a live iterator over visible UTF-16 code units in document order.
   */
  *[Symbol.iterator](): IterableIterator<string> {
    for (let index = 0; index < this.length; index++) {
      const value = this.value(index)
      if (typeof value !== 'string') continue
      yield value
    }
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
   * Applies incoming gossip and emits visible text edits and any reply gossip.
   * @param delta The received replication data. Sequencer handles transport validation.
   * @remarks This method does not throw.
   */
  apply(delta: unknown): void {
    try {
      const result = this.projection.apply(delta)
      if (!result) return
      const [change, gossip] = result
      if (change)
        void this.dispatchEvent(
          'change',
          change.map(([start, end, values]) =>
            values ? [start, end, values.join('')] : [start, end]
          )
        )
      if (gossip) void this.dispatchEvent('delta', gossip)
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

      if (change)
        void this.dispatchEvent(
          'change',
          change.map(([start, end, values]) =>
            values ? [start, end, values.join('')] : [start, end]
          )
        )
      if (delta) void this.dispatchEvent('delta', delta)
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

  /**
   * Synchronously emits a `snapshot` event containing the current replication state.
   */
  snapshot(): void {
    void this.dispatchEvent('snapshot', this.toJSON())
  }
  /**
   * Returns the complete replication state, including retained text history.
   *
   * Called automatically by `JSON.stringify()`.
   *
   * @returns Structural metadata as a numeric array and the retained UTF-16 content.
   */
  toJSON(): Sequence<V> {
    try {
      return this.projection.sequence(true)
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
   * ╚══════╝╚═╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝    ╚═════╝╚══════╝╚══════╝
   */

  /** Releases the resources associated with this register. */
  destroy(): void {
    try {
      void this.projection.destroy()
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.destroy()')
    }
  }

  /**
   * Retires an actor from replication acknowledgements.
   *
   * Retired actors are no longer required to acknowledge history for compaction.
   * The retirement must be applied separately to each replica.
   *
   * @param actorID The identifier of the actor to retire.
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

  /**
   * Returns the visible text for Node.js console inspection.
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.valueOf()
  }
  /**
   * Returns the visible text for Deno console inspection.
   */
  [Symbol.for('Deno.customInspect')](): string {
    return this.valueOf()
  }

  /** The built-in object tag, `SequencedSet`. */
  get [Symbol.toStringTag](): string {
    return 'SequencedSet'
  }

  /**
   * ███████╗██╗   ██╗███████╗███╗   ██╗████████╗    ████████╗ █████╗ ██████╗  ██████╗ ███████╗████████╗
   * ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝    ╚══██╔══╝██║╔══██╗██╔══██╗██╔════╝ ██╔════╝╚══██╔══╝
   * █████╗  ██║   ██║█████╗  ██╔██╗ ██║   ██║          ██║   ███████║██████╔╝██║  ███╗█████╗     ██║
   * ██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║   ██║          ██║   ██╔══██║██╔══██╗██║   ██║██╔══╝     ██║
   * ███████╗ ╚████╔╝ ███████╗██║ ╚████║   ██║          ██║   ██║  ██║██║  ██║╚██████╔╝███████╗   ██║
   * ╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝          ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝
   */

  /**
   * Registers a callback or listener object for a typed document event.
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

  /**
   * ██╗  ██╗███████╗██╗     ██████╗ ███████╗██████╗ ███████╗
   * ██║  ██║██╔════╝██║     ██╔══██╗██╔════╝██╔══██╗██╔════╝
   * ███████║█████╗  ██║     ██████╔╝█████╗  ██████╔╝███████╗
   * ██╔══██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗╚════██║
   * ██║  ██║███████╗███████╗██║     ███████╗██║  ██║███████║
   * ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝
   */

  /** Reads one projection value and scopes unexpected failures to this library. */
  private value(at: number): string | undefined {
    try {
      return this.projection.value(at)
    } catch (cause) {
      throw unknownError(cause, 'SequencedSet.value()')
    }
  }
}
