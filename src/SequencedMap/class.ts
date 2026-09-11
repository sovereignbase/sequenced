import type {
  SequencedMapAck,
  SequencedMapDelta,
  SequencedMapEventMap,
} from './types/type.js'

/**
 * A convergent replicated map for string-keyed state.
 *
 * Reads, iteration, and collection views expose detached copies of the current
 * live projection. Local mutations emit `delta` and `change` events. Merges may
 * emit `change`, `delta`, or both depending on whether the incoming state
 * changes the visible projection or requires a reply delta.
 *
 * @typeParam T - The value type stored in the map.
 */
export class SequencedMap<T> {
  declare private readonly state: SequencedMapState<string, T>
  declare private readonly eventTarget: EventTarget

  /**
   * Creates a replicated map from an optional serializable snapshot.
   *
   * @param snapshot - A previously emitted SequencedMap snapshot.
   */
  constructor(snapshot?: SequencedMapSnapshot<string, T>) {
    Object.defineProperties(this, {
      state: {
        value: __create<T>(snapshot),
        enumerable: false,
        configurable: false,
        writable: false,
      },
      eventTarget: {
        value: new EventTarget(),
        enumerable: false,
        configurable: false,
        writable: false,
      },
    })
  }

  /**
   * The current number of live keys.
   */
  get size(): number {
    return this.state.values.size
  }

  /**
   * Reads the current visible value for a key.
   *
   * @param key - Target key in the live map.
   * @returns A detached copy of the value, or `undefined` when the key is absent.
   */
  get(key: string): T | undefined {
    return __read<T>(key, this.state)
  }

  /**
   * Checks whether a key currently exists in the live projection.
   *
   * @param key - Key to check.
   * @returns `true` when the key is currently visible.
   */
  has(key: string): boolean {
    return this.state.values.has(key)
  }

  /**
   * Overwrites the visible value for a key.
   *
   * @param key - Key to write.
   * @param value - Next visible value for the key.
   * @throws {SequencedMapError} Thrown when the key is not a non-empty string.
   * @throws {SequencedMapError} Thrown when the value is not supported by `structuredClone`.
   */
  set(key: string, value: T): void {
    const result = __update<T>(key, value, this.state)
    /* c8 ignore next -- __update either throws or returns a result object. */
    if (!result) return
    void this.eventTarget.dispatchEvent(
      new CustomEvent('delta', { detail: result.delta })
    )
    void this.eventTarget.dispatchEvent(
      new CustomEvent('change', { detail: result.change })
    )
  }

  /**
   * Deletes one visible key.
   *
   * @param key - Key to remove.
   * @throws {SequencedMapError} Thrown when the key is not a non-empty string.
   */
  delete(key: string): void {
    const result = __delete(this.state, key)
    if (!result) return
    void this.eventTarget.dispatchEvent(
      new CustomEvent('delta', { detail: result.delta })
    )
    void this.eventTarget.dispatchEvent(
      new CustomEvent('change', { detail: result.change })
    )
  }

  /**
   * Deletes every visible key.
   */
  clear(): void {
    const result = __delete(this.state)
    if (!result) return
    void this.eventTarget.dispatchEvent(
      new CustomEvent('delta', { detail: result.delta })
    )
    void this.eventTarget.dispatchEvent(
      new CustomEvent('change', { detail: result.change })
    )
  }

  /**
   * Returns the current live keys.
   *
   * @returns The current keys in map iteration order.
   */
  keys(): Array<string> {
    return Array.from(this.state.values.keys())
  }

  /**
   * Returns detached copies of the current live values.
   *
   * @returns The current values in map iteration order.
   */
  values(): Array<T> {
    return Array.from(this.state.values.values(), (entry) =>
      structuredClone(entry.value.value)
    )
  }

  /**
   * Returns detached key-value entries for the current live projection.
   *
   * @returns The current entries in map iteration order.
   */
  entries(): Array<[string, T]> {
    return Array.from(this.state.values.values(), (entry) => [
      entry.value.key,
      structuredClone(entry.value.value),
    ])
  }

  /**
   * Applies a remote or local delta to the replica state.
   *
   * @param delta - The partial serialized map state to merge.
   */
  merge(delta: SequencedMapDelta<string, T>): void {
    const result = __merge<T>(delta, this.state)
    if (!result) return
    if (
      (result.delta.values?.length ?? 0) +
        (result.delta.tombstones?.length ?? 0) >
      0
    ) {
      void this.eventTarget.dispatchEvent(
        new CustomEvent('delta', { detail: result.delta })
      )
    }
    if (Object.keys(result.change).length > 0) {
      void this.eventTarget.dispatchEvent(
        new CustomEvent('change', { detail: result.change })
      )
    }
  }

  /**
   * Emits the current acknowledgement frontier.
   */
  acknowledge(): void {
    const ack = __acknowledge<T>(this.state)
    if (!ack) return
    void this.eventTarget.dispatchEvent(new CustomEvent('ack', { detail: ack }))
  }

  /**
   * Removes tombstones that every provided frontier has acknowledged.
   *
   * @param frontiers - Replica acknowledgement frontiers.
   */
  garbageCollect(frontiers: Array<SequencedMapAck>): void {
    void __garbageCollect<T>(frontiers, this.state)
  }

  /**
   * Emits the current serializable map snapshot.
   */
  snapshot(): void {
    const snapshot = __snapshot<T>(this.state)
    void this.eventTarget.dispatchEvent(
      new CustomEvent('snapshot', { detail: snapshot })
    )
  }

  /**
   * Registers an event listener.
   *
   * @param type - The event type to listen for.
   * @param listener - The listener to register.
   * @param options - Listener registration options.
   */
  addEventListener<K extends keyof SequencedMapEventMap<string, T>>(
    type: K,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventTarget.addEventListener(type, listener, options)
  }

  /**
   * Removes an event listener.
   *
   * @param type - The event type to stop listening for.
   * @param listener - The listener to remove.
   * @param options - Listener removal options.
   */
  removeEventListener<K extends keyof SequencedMapEventMap<string, T>>(
    type: K,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget.removeEventListener(type, listener, options)
  }

  /**
   * Returns a serializable snapshot representation of this map.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON(): SequencedMapSnapshot<string, T> {
    return __snapshot<T>(this.state)
  }

  /**
   * Attempts to return this map as a JSON string.
   */
  toString(): string {
    return JSON.stringify(this)
  }

  /**
   * Returns the Node.js console inspection representation.
   */
  [Symbol.for('nodejs.util.inspect.custom')](): SequencedMapSnapshot<
    string,
    T
  > {
    return this.toJSON()
  }

  /**
   * Returns the Deno console inspection representation.
   */
  [Symbol.for('Deno.customInspect')](): SequencedMapSnapshot<string, T> {
    return this.toJSON()
  }

  /**
   * Iterates over detached copies of the current live entries.
   */
  *[Symbol.iterator](): IterableIterator<[string, T]> {
    for (const entry of this.state.values.values()) {
      yield [entry.value.key, structuredClone(entry.value.value)]
    }
  }

  /**
   * Calls a function once for each live entry copy in map iteration order.
   *
   * Callback values are detached copies, so mutating them does not mutate the
   * replica.
   *
   * @param callback - Function to call for each key-value entry.
   * @param thisArg - Optional `this` value for the callback.
   */
  forEach(
    callback: (value: T, key: string, map: this) => void,
    thisArg?: unknown
  ): void {
    for (const [key, value] of this) {
      callback.call(thisArg, value, key, this)
    }
  }
}
