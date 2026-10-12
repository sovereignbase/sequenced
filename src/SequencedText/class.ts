import { Projection } from '@sovereignbase/sequencer'

import type {
  SequencedTextSnapshot,
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
  constructor(actorID: number, snapshot?: SequencedTextSnapshot) {
    void Object.defineProperties(this, {
      projection: {
        value: new Projection<string>(
          actorID,
          snapshot && [snapshot[0], snapshot[1].split('')]
        ),
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
    if (result?.[0])
      void this.dispatchEvent(
        'change',
        result[0].map(([start, end, values]) =>
          values ? [start, end, values.join('')] : [start, end]
        )
      )
    if (result?.[1]) void this.dispatchEvent('delta', result[1])
  }

  insert(at: number, characters: string): void {
    if (characters.length === 0) return
    const delta = this.projection.insert(characters.split(''), at)
    void this.dispatchEvent('delta', delta)
    void this.dispatchEvent('change', [[at, at, characters]])
  }

  get length(): number {
    return this.projection.length()
  }

  merge(snapshot: SequencedTextSnapshot): void {
    const result = this.projection.merge([snapshot[0], snapshot[1].split('')])
    if (!result) return

    const [change, delta] = result

    if (delta) void this.dispatchEvent('delta', delta)

    if (change)
      void this.dispatchEvent(
        'change',
        change.map(([start, end, values]) =>
          values ? [start, end, values.join('')] : [start, end]
        )
      )
  }

  remove(
    selectionStart: number = 0,
    selecectionEnd: number = this.length
  ): void {
    if (selectionStart === selecectionEnd) return
    const delta = this.projection.remove(selectionStart, selecectionEnd - 1)
    void this.dispatchEvent('delta', delta)
    void this.dispatchEvent('change', [
      [selectionStart ?? 0, selecectionEnd ?? this.length],
    ])
  }

  replace(
    selectionStart: number = 0,
    selecectionEnd: number = this.length,
    characters: string = ''
  ) {
    if (selectionStart === selecectionEnd)
      return this.insert(selectionStart, characters)
    const delta = this.projection.replace(
      characters.split(''),
      selectionStart,
      selecectionEnd - 1
    )
    void this.dispatchEvent('delta', delta)
    void this.dispatchEvent('change', [
      [selectionStart, selecectionEnd, characters],
    ])
  }

  /**
   * Dispatches a detached snapshot of the current state.
   */
  snapshot(): void {
    const snapshot = this.toJSON()
    if (snapshot) void this.dispatchEvent('snapshot', snapshot)
  }
  /**
   * Returns a detached structured-clone-compatible snapshot of this list.
   *
   * Called automatically by `JSON.stringify`.
   */
  toJSON(): SequencedTextSnapshot {
    const [meta, values] = this.projection.sequence()
    return [Array.isArray(meta) ? meta : Array.from(meta), values.join('')]
  }

  /**
   * Returns this snapshot as a JSON string.
   */
  toString(): string {
    return this.valueOf()
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
    return this.valueOf()
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
   * Registers an event listener.
   *
   * @param type The event type to listen for.
   * @param listener The listener to register.
   * @param options Listener registration options.
   */
  public addEventListener<K extends keyof SequencedTextEventMap>(
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
  public removeEventListener<K extends keyof SequencedTextEventMap>(
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

  public dispatchEvent<K extends keyof SequencedTextEventMap>(
    type: K,
    detail: SequencedTextEventMap[K]
  ) {
    void this.eventTarget.dispatchEvent(
      new CustomEvent<SequencedTextEventMap[K]>(type, { detail })
    )
  }
}
