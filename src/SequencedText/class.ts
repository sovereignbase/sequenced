import { unknownError } from '../errors/unknown.js'
import { Projection } from '@sovereignbase/sequencer'

import type {
  SequencedTextSnapshot,
  SequencedTextEventMap,
  SequencedTextEventListenerFor,
} from './types/type.js'

/**
 * Represents a replicated text document with synchronous editing and change events.
 *
 * Positions and lengths are measured in UTF-16 code units. Editing ranges include
 * the start position and exclude the end position.
 */
export class SequencedText {
  declare private readonly projection: Projection<string>
  declare private eventTarget: EventTarget

  #value(at: number): string | undefined {
    try {
      return this.projection.value(at)
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.#value()')
    }
  }

  /**
   * Creates a text document from an optional replication snapshot.
   *
   * @param actorID The identifier of the local replica's actor.
   * @param snapshot The replication state to restore. If omitted, the document is empty.
   */
  constructor(actorID: number, snapshot?: SequencedTextSnapshot) {
    try {
      this.projection = new Projection<string>(actorID, snapshot)
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.constructor()')
    }
  }
  /**
   * Applies sequencer gossip to the document's replication state.
   *
   * Dispatches a `change` event with the resulting text edits and a `delta` event
   * if the sequencer produces reply gossip.
   *
   * @param delta The gossip received from another replica.
   */
  apply(delta: unknown): void {
    try {
      const result = this.projection.apply(delta)
      if (result?.[0])
        void this.dispatchEvent(
          'change',
          result[0].map(([start, end, values]) =>
            values ? [start, end, values.join('')] : [start, end]
          )
        )
      if (result?.[1]) void this.dispatchEvent('delta', result[1])
    } catch {}
  }

  /**
   * Inserts text at the specified position and dispatches `delta` and `change` events.
   * An empty string leaves the document unchanged.
   *
   * @param at The insertion position, measured in UTF-16 code units.
   * @param characters The text to insert.
   */
  insert(at: number, characters: string): void {
    try {
      if (characters.length === 0) return
      const delta = this.projection.insert(characters.split(''), at)
      void this.dispatchEvent('change', [[at, at, characters]])
      void this.dispatchEvent('delta', delta)
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.insert()')
    }
  }

  /**
   * Returns the length of the visible text in UTF-16 code units.
   */
  get length(): number {
    try {
      return this.projection.length()
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.length()')
    }
  }

  /**
   * Merges a replication snapshot into the document's current state.
   *
   * Dispatches `delta` and `change` events for any reply gossip and text edits
   * produced by the sequencer.
   *
   * @param snapshot The replication state to merge.
   */
  merge(snapshot: SequencedTextSnapshot): void {
    try {
      const result = this.projection.merge(snapshot)
      if (!result) return

      const [change, delta] = result

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
   * Removes the selected text and dispatches `delta` and `change` events.
   * An empty selection leaves the document unchanged.
   *
   * @param selectionStart The inclusive start position in UTF-16 code units. Defaults to zero.
   * @param selecectionEnd The exclusive end position in UTF-16 code units. Defaults to `length`.
   */
  remove(
    selectionStart: number = 0,
    selecectionEnd: number = this.length
  ): void {
    try {
      if (selectionStart === selecectionEnd) return
      const delta = this.projection.remove(selectionStart, selecectionEnd - 1)
      void this.dispatchEvent('change', [[selectionStart, selecectionEnd]])
      void this.dispatchEvent('delta', delta)
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.remove()')
    }
  }

  /**
   * Replaces the selected text and dispatches `delta` and `change` events.
   * An empty selection inserts the replacement text at the selection position.
   *
   * @param selectionStart The inclusive start position in UTF-16 code units. Defaults to zero.
   * @param selecectionEnd The exclusive end position in UTF-16 code units. Defaults to `length`.
   * @param characters The replacement text. Defaults to an empty string.
   */
  replace(
    selectionStart: number = 0,
    selecectionEnd: number = this.length,
    characters: string = ''
  ) {
    try {
      if (selectionStart === selecectionEnd)
        return this.insert(selectionStart, characters)
      const delta = this.projection.replace(
        characters.split(''),
        selectionStart,
        selecectionEnd - 1
      )
      void this.dispatchEvent('change', [
        [selectionStart, selecectionEnd, characters],
      ])
      void this.dispatchEvent('delta', delta)
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.replace()')
    }
  }

  /**
   * Dispatches a `snapshot` event containing the document's replication state.
   */
  snapshot(): void {
    void this.dispatchEvent('snapshot', this.toJSON())
  }
  /**
   * Returns a JSON-compatible snapshot of the document's replication state.
   *
   * Called automatically by `JSON.stringify()`.
   *
   * @returns The structural metadata as a numeric array and the retained text content.
   */
  toJSON(): SequencedTextSnapshot {
    try {
      const [meta, values] = this.projection.sequence(true)
      return [Array.isArray(meta) ? meta : Array.from(meta), values]
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.toJSON()')
    }
  }

  /**
   * Returns the visible text as a string.
   */
  toString(): string {
    return this.valueOf()
  }

  /**
   * Returns the visible text as a string.
   */
  valueOf(): string {
    try {
      return this.projection.values().join('')
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.valueOf()')
    }
  }

  /**
   * Returns the visible text when the document is converted to a primitive value.
   */
  [Symbol.toPrimitive](): string {
    return this.valueOf()
  }

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

  /**
   * Returns an iterator over the visible UTF-16 code units in document order.
   */
  *[Symbol.iterator](): IterableIterator<string> {
    for (let index = 0; index < this.length; index++) {
      const value = this.#value(index)
      if (typeof value !== 'string') continue
      yield value
    }
  }

  addEventListener<K extends keyof SequencedTextEventMap>(
    type: K,
    listener: SequencedTextEventListenerFor<K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    try {
      ;(this.eventTarget ??= new EventTarget()).addEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.addEventListener()')
    }
  }

  removeEventListener<K extends keyof SequencedTextEventMap>(
    type: K,
    listener: SequencedTextEventListenerFor<K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      this.eventTarget?.removeEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.removeEventListener()')
    }
  }

  dispatchEvent<K extends keyof SequencedTextEventMap>(
    type: K,
    detail: SequencedTextEventMap[K]
  ): void {
    try {
      this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
    } catch (cause) {
      throw unknownError(cause, 'SequencedText.dispatchEvent()')
    }
  }
}
