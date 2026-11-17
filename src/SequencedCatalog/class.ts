import { SequencedArray } from '../SequencedArray/class.js'
import type {
  SequencedArrayEventMap,
  SequencedArrayEventListener,
  SequencedArraySnapshot,
} from '../SequencedArray/types/type.js'
import { unknownError } from '../.errors/unknown.js'

/**
 * A replicated catalog unique by configured key, sorted binary search.
 *
 *
 * @typeParam T The object's property types.
 */
export class SequencedCatalog<T extends Record<string, unknown>> {
  private readonly projection: SequencedArray<T>

  /**
   *  ██████╗██████╗ ██╗   ██╗██████╗
   * ██╔════╝██╔══██╗██║   ██║██╔══██╗
   * ██║     ██████╔╝██║   ██║██║  ██║
   * ██║     ██╔══██╗██║   ██║██║  ██║
   * ╚██████╗██║  ██║╚██████╔╝██████╔╝
   *  ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝
   */

  /**
   * Creates a replicated struct from initial properties or a trusted snapshot.
   *
   * @param actorID The unique identifier of the local actor.
   * @param trustedSnapshot An optional snapshot used to restore replication state.
   */
  constructor(actorID: number, uniqueBy: keyof T, trustedSnapshot?: unknown) {
    this.projection = new SequencedArray(actorID, trustedSnapshot)
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
   * Applies received replication data to the struct.
   *
   * Emits `change` for visible changes and `delta` for any reply gossip.
   *
   * @param delta The received replication data.
   * @remarks This method does not throw.
   */
  apply(delta: unknown): void {
    try {
      void this.projection.apply(delta)
    } catch {}
  }

  /**
   * Merges another replica's snapshot into the struct.
   *
   * Emits `change` for visible changes and `delta` for any reply gossip.
   *
   * @param snapshot The replication state to merge.
   * @remarks This method does not throw.
   */
  merge(snapshot: unknown): void {
    try {
      void this.projection.merge(snapshot)
    } catch {}
  }

  /**
   * ██████╗ ███████╗██████╗ ███████╗██╗███████╗████████╗███████╗███╗   ██╗ ██████╗███████╗
   * ██╔══██╗██╔════╝██╔══██╗██╔════╝██║██╔════╝╚══██╔══╝██║██╔════╝██╔════╝████╗  ██║██╔════╝██╔════╝
   * ██████╔╝█████╗  ██████╔╝███████╗██║███████╗   ██║   █████╗  ██╔██╗ ██║██║   ██║██╔██╗ ██║██║     █████╗
   * ██╔═══╝ ██╔══╝  ██╔══██╗╚════██║██║╚════██║   ██║   ██╔══╝  ██║╚██╗██║██║   ██║██║╚██╗██║██║     ██╔══╝
   * ██║     ███████╗██║  ██║███████║██║███████║   ██║   ███████╗██║ ╚████║╚██████╔╝██║ ╚████║╚██████╗███████╗
   * ╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚══════╝
   */

  /** Dispatches a `snapshot` event containing the current replication state. */
  snapshot(): void {
    this.projection.snapshot()
  }

  /**
   * Returns a snapshot of the struct's complete replication state.
   *
   * Includes the history required to restore or synchronize a replica.
   * Called automatically by `JSON.stringify()`.
   *
   * @returns The struct's replication snapshot.
   */
  toJSON(): SequencedArraySnapshot<T> {
    try {
      return this.projection.toJSON()
    } catch (cause) {
      throw unknownError(cause, 'SequencedCatalog.toJSON()')
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

  /** Releases the resources associated with this struct. */
  destroy(): void {
    try {
      void this.projection.destroy()
    } catch (cause) {
      throw unknownError(cause, 'SequencedCatalog.destroy()')
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
      throw unknownError(cause, 'SequencedCatalog.retire()')
    }
  }

  /**
   * ██╗   ██╗████████╗██╗██╗     ██╗████████╗██╗███████╗███████╗
   * ██║   ██║╚══██╔══╝██║██║     ██║╚══██╔══╝██║██╔════╝██╔════╝
   * ██║   ██║   ██║   ██║██║     ██║   ██║   ██║█████╗  ███████╗
   * ██╔══██║██╔══╝  ██║   ██║██║     ██║   ██║   ██║██╔══╝  ╚════██║
   * ╚██████╔╝   ██║   ██║███████╗██║   ██║   ██║███████╗███████║
   *  ╚═════╝    ╚═╝   ╚═╝╚══════╝╚═╝   ╚═╝   ╚═╝╚══════╝╚══════╝
   */

  /** Returns the struct's visible properties for Node.js inspection. */
  [Symbol.for('nodejs.util.inspect.custom')](): Partial<T> {
    return Object.fromEntries(this.projection.entries()) as Partial<T>
  }

  /** Returns the struct's visible properties for Deno inspection. */
  [Symbol.for('Deno.customInspect')](): Partial<T> {
    return Object.fromEntries(this.projection.entries()) as Partial<T>
  }

  /** A string identifying this object as a `SequencedCatalog`. */
  get [Symbol.toStringTag](): string {
    return 'SequencedCatalog'
  }

  /**
   * ███████╗██╗   ██╗███████╗███╗   ██╗████████╗    ████████╗ █████╗ ██████╗  ██████╗ ███████╗████████╗
   * ██╔════╝██║   ██║██╔════╝████╗  ██║╚══██╔══╝    ╚══██╔══╝██╔══██╗██╔══██╗██╔════╝ ██╔════╝╚══██╔══╝
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
  addEventListener<K extends keyof SequencedArrayEventMap<T>>(
    type: K,
    listener: SequencedArrayEventListener<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    try {
      void this.projection.addEventListener(type, listener, options)
    } catch (cause) {
      throw unknownError(cause, 'SequencedCatalog.addEventListener()')
    }
  }

  /**
   * Removes a previously registered event listener.
   *
   * @param type The event type.
   * @param listener The callback or listener object to remove.
   * @param options An optional capture flag or event listener options.
   */
  removeEventListener<K extends keyof SequencedArrayEventMap<T>>(
    type: K,
    listener: SequencedArrayEventListener<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      void this.projection.removeEventListener(type, listener, options)
    } catch (cause) {
      throw unknownError(cause, 'SequencedCatalog.removeEventListener()')
    }
  }

  /**
   * Dispatches a synchronous `CustomEvent` of the specified type.
   *
   * @param type The event type.
   * @param detail The data associated with the event.
   */
  dispatchEvent<K extends keyof SequencedArrayEventMap<T>>(
    type: K,
    detail: SequencedArrayEventMap<T>[K]
  ): void {
    try {
      void this.projection.dispatchEvent(type, detail)
    } catch (cause) {
      throw unknownError(cause, 'SequencedCatalog.dispatchEvent()')
    }
  }
}
