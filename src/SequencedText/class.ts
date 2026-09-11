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
  __create,
  __read,
  __update,
  __delete,
  __merge,
  __acknowledge,
  __garbageCollect,
  __snapshot,
} from '@sovereignbase/convergent-replicated-list'
import { CRTextError } from '../.errors/class.js'
import {
  dispatchCRTextEvent,
  transformStringToGraphemeArray,
} from '../.helpers/index.js'
import type {
  CRTextEventMap,
  CRTextEventListenerFor,
  CRTextState,
  CRTextSnapshot,
  CRTextDelta,
  CRTextAck,
} from '../.types/type.js'

/**
 * Represents a convergent replicated text document backed by CR-List state.
 */
export class CRText {
  declare private readonly state: CRTextState
  declare private readonly eventTarget: EventTarget

  /**
   * Creates a new `CRText` instance.
   *
   * @param snapshot An optional detached snapshot used to hydrate the initial state.
   */
  constructor(snapshot?: CRTextSnapshot) {
    void Object.defineProperties(this, {
      state: {
        value: __create<string>(snapshot),
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
   * Returns the current number of grapheme clusters in the text projection.
   */
  get size(): number {
    return this.state.size
  }

  /**
   * Inserts characters immediately after the specified index.
   *
   * Pass `-1` to insert at the beginning of the document.
   *
   * @param index The anchor index after which the characters are inserted.
   * @param characters The text to insert.
   * @throws {CRTextError} Thrown when the arguments are not a number and string pair.
   */
  insertAfter(index: number, characters: string): void {
    if (typeof index !== 'number' || typeof characters !== 'string')
      throw new CRTextError(
        'BAD_PARAMS',
        '`index` must be typeof number and `characters` must be typeof string.'
      )
    let mode: 'after' | 'before' = 'after'

    if (index === -1) {
      index = 0
      if (this.size > 0) mode = 'before'
    }
    const result = __update<string>(
      index,
      transformStringToGraphemeArray(characters),
      this.state,
      mode
    )
    if (!result) return
    const { delta, change } = result
    if (delta) void dispatchCRTextEvent(this.eventTarget, 'delta', delta)
    if (change) void dispatchCRTextEvent(this.eventTarget, 'change', change)
  }

  /**
   * Removes characters starting at the specified index.
   *
   * @param index The inclusive start index to remove from.
   * @param removeCount The number of characters to remove.
   * @throws {CRTextError} Thrown when the arguments are not numeric.
   */
  removeAfter(index: number, removeCount: number): void {
    if (typeof index !== 'number' || typeof removeCount !== 'number')
      throw new CRTextError(
        'BAD_PARAMS',
        '`index` must be typeof number and `removeCount` must be typeof number.'
      )
    const result = __delete<string>(this.state, index, index + removeCount)
    if (!result) return
    const { delta, change } = result
    if (delta) void dispatchCRTextEvent(this.eventTarget, 'delta', delta)
    if (change) void dispatchCRTextEvent(this.eventTarget, 'change', change)
  }

  /**
   * Merges a remote delta into this replica.
   *
   * Dispatches a `change` event when the merge updates the current projection.
   *
   * @param delta The remote delta to merge.
   */
  merge(delta: CRTextDelta): void {
    const change = __merge(this.state, delta)
    if (change) void dispatchCRTextEvent(this.eventTarget, 'change', change)
  }

  /**
   * Emits an acknowledgement frontier for the current replica state.
   *
   * Dispatches an `ack` event when an acknowledgement is produced.
   */
  acknowledge(): void {
    const ack = __acknowledge(this.state)
    if (ack) void dispatchCRTextEvent(this.eventTarget, 'ack', ack)
  }

  /**
   * Removes tombstoned history acknowledged by every provided frontier.
   *
   * @param frontiers The acknowledgement frontiers that permit garbage collection.
   */
  garbageCollect(frontiers: Array<CRTextAck>): void {
    void __garbageCollect(frontiers, this.state)
  }

  /**
   * Dispatches a detached snapshot of the current state.
   */
  snapshot(): void {
    const snapshot = __snapshot<string>(this.state)
    if (snapshot)
      void dispatchCRTextEvent(this.eventTarget, 'snapshot', snapshot)
  }
  /**
   * Returns a detached structured-clone-compatible snapshot of this list.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON(): CRTextSnapshot {
    return __snapshot<string>(this.state)
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
    for (let index = 0; index < this.size; index++) {
      const value = __read<string>(index, this.state)
      if (typeof value !== 'string') continue
      yield value
    }
  }

  /**
   * Returns the current text projection as a string.
   */
  valueOf(): string {
    return [...this].join('')
  }

  /**
   * Returns the current text projection when coerced to a primitive.
   */
  [Symbol.toPrimitive](): string {
    return [...this].join('')
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
  addEventListener<K extends keyof CRTextEventMap>(
    type: K,
    listener: CRTextEventListenerFor<K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventTarget.addEventListener(
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
  removeEventListener<K extends keyof CRTextEventMap>(
    type: K,
    listener: CRTextEventListenerFor<K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }
}
