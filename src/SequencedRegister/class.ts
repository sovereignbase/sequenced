import { Projection } from '@sovereignbase/sequencer'
import type {
  SequencedRegisterEventMap,
  SequencedRegisterEventListenerFor,
} from './types/type.js'
import { unknownError } from '../errors/unknown.js'

export class SequencedRegister<T> {
  private readonly projection: Projection<T>
  private eventTarget?: EventTarget
  constructor(actorID: number, trustedSnapshot?: unknown) {
    this.projection = new Projection(actorID, trustedSnapshot)
  }
  read(): Readonly<T | undefined> {
    try {
      return this.projection.value(0)
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.read()')
    }
  }
  write(value: T) {
    try {
      const delta = this.projection.replace([value])
      if (this.eventTarget) {
        void this.dispatchEvent('change', value)
        void this.dispatchEvent('delta', delta)
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.write()')
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
      throw unknownError(cause, 'SequencedRegister.delete()')
    }
  }

  /**
   * Registers a callback or listener object for a typed document event.
   * @param type The event name.
   * @param listener The listener to register; `null` is ignored.
   * @param options A capture flag or options such as `once` and `signal`.
   */
  addEventListener<K extends keyof SequencedRegisterEventMap<T>>(
    type: K,
    listener: SequencedRegisterEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    try {
      ;(this.eventTarget ??= new EventTarget()).addEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.addEventListener()')
    }
  }

  /**
   * Removes a listener with the matching event name, identity and capture flag.
   * @param type The event name.
   * @param listener The previously registered listener.
   * @param options The capture flag, directly or within listener options.
   */
  removeEventListener<K extends keyof SequencedRegisterEventMap<T>>(
    type: K,
    listener: SequencedRegisterEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      this.eventTarget?.removeEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.removeEventListener()')
    }
  }

  /**
   * Synchronously dispatches a typed `CustomEvent` to registered listeners.
   * @param type The event name.
   * @param detail The value exposed as `event.detail`.
   */
  dispatchEvent<K extends keyof SequencedRegisterEventMap<T>>(
    type: K,
    detail: SequencedRegisterEventMap<T>[K]
  ): void {
    try {
      this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.dispatchEvent()')
    }
  }
}
