import { Projection } from '@sovereignbase/sequencer'
import type {
  SequencedVariableEventMap,
  SequencedVariableEventListenerFor,
} from './types/type.js'
import { unknownError } from '../errors/unknown.js'

export class SequencedVariable<T> {
  private readonly projection: Projection<T>
  private eventTarget?: EventTarget
  constructor(actorID: number, trustedSnapshot?: unknown) {
    this.projection = new Projection(actorID, trustedSnapshot)
  }
  get(): Readonly<T | undefined> {
    try {
      return this.projection.value(0)
    } catch (cause) {
      throw unknownError(cause, 'SequencedVariable.get()')
    }
  }
  set(value: T) {
    try {
      const delta = this.projection.replace([value])
      if (this.eventTarget) {
        void this.dispatchEvent('change', value)
        void this.dispatchEvent('delta', delta)
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedVariable.set()')
    }
  }
  delete() {
    try {
      const delta = this.projection.remove()
      if (this.eventTarget) {
        void this.dispatchEvent('change', undefined)
        void this.dispatchEvent('delta', delta)
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedVariable.delete()')
    }
  }

  /**
   * Registers a callback or listener object for a typed document event.
   * @param type The event name.
   * @param listener The listener to register; `null` is ignored.
   * @param options A capture flag or options such as `once` and `signal`.
   */
  addEventListener<K extends keyof SequencedVariableEventMap<T>>(
    type: K,
    listener: SequencedVariableEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    try {
      ;(this.eventTarget ??= new EventTarget()).addEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedVariable.addEventListener()')
    }
  }

  /**
   * Removes a listener with the matching event name, identity and capture flag.
   * @param type The event name.
   * @param listener The previously registered listener.
   * @param options The capture flag, directly or within listener options.
   */
  removeEventListener<K extends keyof SequencedVariableEventMap<T>>(
    type: K,
    listener: SequencedVariableEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      this.eventTarget?.removeEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedVariable.removeEventListener()')
    }
  }

  /**
   * Synchronously dispatches a typed `CustomEvent` to registered listeners.
   * @param type The event name.
   * @param detail The value exposed as `event.detail`.
   */
  dispatchEvent<K extends keyof SequencedVariableEventMap<T>>(
    type: K,
    detail: SequencedVariableEventMap<T>[K]
  ): void {
    try {
      this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
    } catch (cause) {
      throw unknownError(cause, 'SequencedVariable.dispatchEvent()')
    }
  }
}
