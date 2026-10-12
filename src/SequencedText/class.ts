const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/**
 * Splits a string into user-perceived characters using grapheme segmentation.
 *
 * @param value The text to segment.
 * @returns An array of grapheme clusters in source order.
 */
export function transformStringToGraphemeArray(value: string): string[] {
  return Array.from(segmenter.segment(value), (x) => x.segment)
}

import {
  Projection,
  type Sequence,
  type Gossip,
  type Splice,
} from '@sovereignbase/sequencer'

import type {
  SequencedTextEventMap,
  SequencedTextEventListenerFor,
} from './types/type.js'

/**
 * Represents a convergent replicated text document backed by CR-List state.
 */
export class SequencedText {
  declare private readonly projection: Projection<string>
  declare private readonly eventTarget: EventTarget

  /**
   * Creates a new `SequencedText` instance.
   *
   * @param snapshot An optional detached snapshot used to hydrate the initial state.
   */
  constructor(actorID: number, snapshot?: unknown) {
    void Object.defineProperties(this, {
      state: {
        value: new Projection(actorID, snapshot),
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

  apply(delta: unknown): void {
    const result = this.projection.apply(delta)
    if (result?.[0]) void this.dispatchEvent('change', result[0])
    if (result?.[1]) void this.dispatchEvent('delta', result[1])
  }

  get length(): number {
    return this.projection.length()
  }

  insert(at: number, characters: string): void {
    const delta = this.projection.insert(
      transformStringToGraphemeArray(characters),
      at
    )
    void this.dispatchEvent('delta', delta)
    void this.dispatchEvent('change', [
      [at, at + characters.length, characters],
    ])
  }

  remove(
    selectionStart: number = 0,
    selecectionEnd: number = this.length
  ): void {
    const delta = this.projection.remove(selectionStart, selecectionEnd - 1)
    void this.dispatchEvent('delta', delta)
    void this.dispatchEvent('change', [
      [selectionStart ?? 0, selecectionEnd ?? this.length],
    ])
  }

  merge(snapshot: unknown): void {
    const result = this.projection.merge(snapshot)
    if (!result) return

    const [change, delta] = result

        if (delta) void this.dispatchEvent('delta', delta)

    if (change) void this.dispatchEvent('change', [[change[0], change[1], change.?[2].join("")]])
  }

  /**
   * Dispatches a detached snapshot of the current state.
   */
  snapshot(): void {
    const snapshot = this.projection.sequence()
    if (snapshot) void this.dispatchEvent('snapshot', snapshot)
  }
  /**
   * Returns a detached structured-clone-compatible snapshot of this list.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON(): Sequence<string> {
    return this.projection.sequence()
  }
  /**
   * Returns this snapshot as a JSON string.
   */
  toString(): string {
    return JSON.stringify(this)
  }
  /**
   * Iterates over detached copies of the current live values in index order.
   */
  *[Symbol.iterator](): IterableIterator<string> {
    for (let index = 0; index < this.length; index++) {
      const value = this.projection.value(index)
      if (typeof value !== 'string') continue
      yield value
    }
  }

  /**
   * Returns the current text projection as a string.
   */
  valueOf(): string {
    return this.projection.values().join('')
  }

  /**
   * Returns the current text projection when coerced to a primitive.
   */
  [Symbol.toPrimitive](): string {
    return this.projection.values().join('')
  }

  /**
   * Returns the Node.js console inspection representation.
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.valueOf()
  }
  /**
   * Returns the Deno console inspection representation.
   */
  [Symbol.for('Deno.customInspect')](): string {
    return this.valueOf()
  }

  /**
   * Registers an event listener.
   *
   * @param type The event type to listen for.
   * @param listener The listener to register.
   * @param options Listener registration options.
   */
  addEventListener<K extends keyof SequencedTextEventMap>(
    type: K,
    listener: SequencedTextEventListenerFor<K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    void this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  /**
   * Removes an event listener.
   *
   * @param type The event type to stop listening for.
   * @param listener The listener to remove.
   * @param options Listener removal options.
   */
  removeEventListener<K extends keyof SequencedTextEventMap>(
    type: K,
    listener: SequencedTextEventListenerFor<K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    void this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  dispatchEvent<K extends keyof SequencedTextEventMap>(
    type: K,
    detail: SequencedTextEventMap[K]
  ) {
    void this.eventTarget.dispatchEvent(
      new CustomEvent<SequencedTextEventMap[K]>(type, { detail })
    )
  }
}
