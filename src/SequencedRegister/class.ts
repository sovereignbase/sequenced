import { Projection, Sequence } from '@sovereignbase/sequencer'
import type {
  SequencedRegisterEventMap,
  SequencedRegisterEventListenerFor,
} from './types/type.js'
import { unknownError } from '../errors/unknown.js'

/**
 * NOTE FOR AGENTS: DISTINGUISH BETWEEN DOCUMENTATION VALUABLE TO LIBRARY CONSUMERS
 * (PUBLIC API) AND DOCUMENTATION VALUABLE TO LIBRARY DEVELOPERS...
 * INTERNAL IMPLEMENTATION DETAILS ARE PURE NOISE FOR LIBRARY USERS...
 */

/**
 * A replicated register holding a single value.
 *
 * Supports independent updates and removal across replicas,
 * with deterministic resolution of concurrent changes.
 *
 * @typeParam T The type of value stored in the register.
 */
export class SequencedRegister<T> {
  private readonly projection: Projection<T>
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
   * Creates an empty register or restores one from a trusted snapshot.
   *
   * @param actorID The unique identifier of the local actor.
   * @param trustedSnapshot An optional snapshot used to restore replication state.
   */
  constructor(actorID: number, trustedSnapshot?: unknown) {
    this.projection = new Projection(actorID, trustedSnapshot, {
      enabled: 1,
      maxLength: 1,
    })
  }

  /**
   * Returns the current register value.
   * @returns The value, or `undefined` if the register is empty.
   */
  read(): Readonly<T | undefined> {
    try {
      return this.projection.value(0)
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.read()')
    }
  }

  /**
   * Determines whether the register contains a value.
   * @returns `true` if occupied; otherwise, `false`.
   */
  occupied(): boolean {
    try {
      return this.projection.length() > 0
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.occupied()')
    }
  }

  /**
   * Assigns a value to the register, replacing any existing value.
   * @param value The new value.
   */
  write(value: T) {
    try {
      const delta = this.projection.replace([value], 0, 0)
      if (this.eventTarget) {
        void this.dispatchEvent('change', value)
        void this.dispatchEvent('delta', delta)
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.write()')
    }
  }

  /** Removes the current value, leaving the register empty. */
  delete() {
    try {
      const delta = this.projection.remove(0, 0)
      if (this.eventTarget) {
        void this.dispatchEvent('change', undefined)
        void this.dispatchEvent('delta', delta)
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.delete()')
    }
  }

  /**
   * Returns the current register value.
   * @returns The value, or `undefined` if the register is empty.
   */
  valueOf(): Readonly<T | undefined> {
    return this.read()
  }

  /**
   * Returns a string representation of the current register value.
   * @returns The value converted to a string.
   */
  toString(): string {
    return String(this.read())
  }

  /**
   * Converts the register to a primitive value.
   *
   * Preserves primitive values for default and numeric conversions.
   * Object values and string conversions use their string representation.
   *
   * @param hint The preferred primitive type.
   * @returns The converted primitive value.
   */
  [Symbol.toPrimitive](
    hint: 'default' | 'number' | 'string'
  ): string | number | bigint | boolean | symbol | null | undefined {
    const value = this.read()

    if (
      hint === 'string' ||
      (value !== null &&
        (typeof value === 'object' || typeof value === 'function'))
    ) {
      return String(value)
    }

    return value as
      string | number | bigint | boolean | symbol | null | undefined
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
   * Applies received replication data to the register.
   *
   * Emits `change` for visible changes and `delta` for any reply gossip.
   *
   * @param delta The received replication data.
   * @remarks This method does not throw.
   */
  apply(delta: unknown): void {
    try {
      const result = this.projection.apply(delta)
      if (!result) return
      if (result[0].length) void this.dispatchEvent('change', this.read())
      if (result[1]) void this.dispatchEvent('delta', result[1])
    } catch {}
  }

  /**
   * Merges another replica's snapshot into the register.
   *
   * Emits `change` for visible changes and `delta` for any reply gossip.
   *
   * @param snapshot The replication state to merge.
   * @remarks This method does not throw.
   */
  merge(snapshot: unknown): void {
    try {
      const result = this.projection.merge(snapshot)
      if (!result) return
      if (result[0].length) void this.dispatchEvent('change', this.read())
      if (result[1]) void this.dispatchEvent('delta', result[1])
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

  /** Dispatches a `snapshot` event containing the current replication state. */
  snapshot(): void {
    void this.dispatchEvent('snapshot', this.toJSON())
  }

  /**
   * Returns a snapshot of the register's complete replication state.
   *
   * Includes the history required to restore or synchronize a replica.
   * Called automatically by `JSON.stringify()`.
   *
   * @returns The register's replication snapshot.
   */
  toJSON(): Sequence<T> {
    try {
      return this.projection.sequence()
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.toJSON()')
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
      throw unknownError(cause, 'SequencedRegister.destroy()')
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
      throw unknownError(cause, 'SequencedRegister.retire()')
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

  /** Returns the current value for Node.js inspection. */
  [Symbol.for('nodejs.util.inspect.custom')](): T | undefined {
    return this.read()
  }

  /** Returns the current value for Deno inspection. */
  [Symbol.for('Deno.customInspect')](): T | undefined {
    return this.read()
  }

  /** A string identifying this object as a `SequencedRegister`. */
  get [Symbol.toStringTag](): string {
    return 'SequencedRegister'
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
   * Registers an event listener for the specified event type.
   *
   * @param type The event type.
   * @param listener The callback or listener object to register.
   * @param options An optional capture flag or event listener options.
   */
  addEventListener<K extends keyof SequencedRegisterEventMap<T>>(
    type: K,
    listener: SequencedRegisterEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    try {
      void (this.eventTarget ??= new EventTarget()).addEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.addEventListener()')
    }
  }

  /**
   * Removes a previously registered event listener.
   *
   * @param type The event type.
   * @param listener The callback or listener object to remove.
   * @param options An optional capture flag or event listener options.
   */
  removeEventListener<K extends keyof SequencedRegisterEventMap<T>>(
    type: K,
    listener: SequencedRegisterEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      void this.eventTarget?.removeEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.removeEventListener()')
    }
  }

  /**
   * Dispatches a synchronous `CustomEvent` of the specified type.
   *
   * @param type The event type.
   * @param detail The data associated with the event.
   */
  dispatchEvent<K extends keyof SequencedRegisterEventMap<T>>(
    type: K,
    detail: SequencedRegisterEventMap<T>[K]
  ): void {
    try {
      void this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
    } catch (cause) {
      throw unknownError(cause, 'SequencedRegister.dispatchEvent()')
    }
  }
}
