import { Projection } from '@sovereignbase/sequencer'
import type {
  SequencedArrayAck,
  SequencedArrayDelta,
  SequencedArrayEventMap,
} from './types/type.js'

export class SequencedArray<T> {
  declare private readonly projection: Projection<T>
  declare private readonly eventTarget: EventTarget

  /**
   * Creates a replicated map from an optional serializable snapshot.
   *
   * @param snapshot - A previously emitted SequencedArray snapshot.
   */
  constructor(actorID: number, snapshot?: unknown) {
    Object.defineProperties(this, {
      state: {
        value: new Projection<T>(actorID, snapshot),
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

  get length(): number {
    return this.projection.length()
  }

  set length(value) {
    this.projection.remove(value)
  }

  get(index: number): T | undefined {
    return this.projection.value(index)
  }

  /**
   * Overwrites the visible value for a key.
   *
   * @param key - Key to write.
   * @param value - Next visible value for the key.
   * @throws {SequencedArrayError} Thrown when the key is not a non-empty string.
   * @throws {SequencedArrayError} Thrown when the value is not supported by `structuredClone`.
   */
  set(index: number, value: T): void {
    const result = this.projection.replace([value], index, index)

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
   * @throws {SequencedArrayError} Thrown when the key is not a non-empty string.
   */
  delete(index: number): void {
    const result = this.projection.remove(index)
    if (!result) return
    void this.eventTarget.dispatchEvent(
      new CustomEvent('delta', { detail: result.delta })
    )
    void this.eventTarget.dispatchEvent(
      new CustomEvent('change', { detail: result.change })
    )
  }

  push(...items: T[]) {
    const delta = this.projection.insert(items, this.length)
  }

  splice(start: number, deleteCount: number, ...items: T[]) {
    const delta = this.projection.replace(items, start, deleteCount - 1)
  }

  /**
   * Applies a remote or local delta to the replica state.
   *
   * @param delta - The partial serialized map state to merge.
   */
  merge(delta: SequencedArrayDelta<string, T>): void {
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
   * Emits the current serializable map snapshot.
   */
  snapshot(): void {
    const snapshot = __snapshot<T>(this.state)
    void this.eventTarget.dispatchEvent(
      new CustomEvent('snapshot', { detail: snapshot })
    )
  }

  /**
   * Returns a serializable snapshot representation of this map.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON(): SequencedArraySnapshot<string, T> {
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
  [Symbol.for('nodejs.util.inspect.custom')](): SequencedArraySnapshot<
    string,
    T
  > {
    return this.toJSON()
  }

  /**
   * Returns the Deno console inspection representation.
   */
  [Symbol.for('Deno.customInspect')](): SequencedArraySnapshot<string, T> {
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

  /**
   * Registers a listener for the specified document event.
   *
   * @param type The event type to listen for.
   * @param listener The listener to register.
   * @param options Listener options, or a boolean specifying whether to use capture.
   */
  public addEventListener<K extends keyof SequencedArrayEventMap>(
    type: K,
    listener: SequencedArrayEventListenerFor<K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    void this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  /**
   * Removes a previously registered listener for the specified document event.
   *
   * @param type The event type to stop listening for.
   * @param listener The listener to remove.
   * @param options Listener options, or a boolean specifying whether to use capture.
   */
  public removeEventListener<K extends keyof SequencedArrayEventMap>(
    type: K,
    listener: SequencedArrayEventListenerFor<K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    void this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  /**
   * Synchronously dispatches a `CustomEvent` to the document's registered listeners.
   *
   * @param type The event type to dispatch.
   * @param detail The payload exposed as the event's `detail` property.
   */
  public dispatchEvent<K extends keyof SequencedArrayEventMap>(
    type: K,
    detail: SequencedArrayEventMap[K]
  ) {
    void this.eventTarget.dispatchEvent(
      new CustomEvent<SequencedArrayEventMap[K]>(type, { detail })
    )
  }
}
