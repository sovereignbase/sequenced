import { SequencedMap } from '../SequencedMap/class.js'
import type {
  SequencedMapEventMap,
  SequencedMapEventListener,
  SequencedMapSnapshot,
} from '../SequencedMap/types/type.js'
import { unknownError } from '../errors/unknown.js'

type StructKey<T> = keyof T & string
type StructValue<T extends Record<string, unknown>> = T[StructKey<T>]

/**
 * A replicated object with independently mutable, typed properties.
 *
 * Each property retains its declared value type. Changes can be
 * synchronized between replicas without affecting other properties.
 *
 * @typeParam T The object's property types.
 */
export class SequencedStruct<T extends Record<string, unknown>> {
  private readonly projection: SequencedMap<StructKey<T>, StructValue<T>>

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
   * @param defaults The initial properties, determining their names and types.
   * @param trustedSnapshot An optional snapshot used to restore replication state.
   */
  constructor(actorID: number, defaults: T, trustedSnapshot?: unknown) {
    this.projection = new SequencedMap(actorID, trustedSnapshot)

    if (!trustedSnapshot) {
      for (const [key, value] of Object.entries(defaults)) {
        void this.projection.set(key as StructKey<T>, value as StructValue<T>)
      }
    }
  }

  /**
   * Returns the value associated with the specified property.
   * @param key The property key to read.
   * @returns The value, or `undefined` if the property is absent.
   */
  get<K extends StructKey<T>>(key: K): Readonly<T[K]> | undefined {
    try {
      return this.projection.get(key) as Readonly<T[K]> | undefined
    } catch (cause) {
      throw unknownError(cause, 'SequencedStruct.get()')
    }
  }

  /**
   * Assigns a value to the specified property.
   * @param key The property key to update.
   * @param value The new value.
   */
  set<K extends StructKey<T>>(key: K, value: T[K]): void {
    try {
      void this.projection.set(key, value)
    } catch (cause) {
      throw unknownError(cause, 'SequencedStruct.set()')
    }
  }

  /**
   * Removes the property associated with the specified key.
   * @param key The property key to remove.
   */
  delete<K extends StructKey<T>>(key: K): void {
    try {
      void this.projection.delete(key)
    } catch (cause) {
      throw unknownError(cause, 'SequencedStruct.delete()')
    }
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
  toJSON(): SequencedMapSnapshot<StructKey<T>, StructValue<T>> {
    try {
      return this.projection.toJSON()
    } catch (cause) {
      throw unknownError(cause, 'SequencedStruct.toJSON()')
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
      throw unknownError(cause, 'SequencedStruct.destroy()')
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
      throw unknownError(cause, 'SequencedStruct.retire()')
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

  /** A string identifying this object as a `SequencedStruct`. */
  get [Symbol.toStringTag](): string {
    return 'SequencedStruct'
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
  addEventListener<
    K extends keyof SequencedMapEventMap<StructKey<T>, StructValue<T>>,
  >(
    type: K,
    listener: SequencedMapEventListener<StructKey<T>, StructValue<T>, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    try {
      void this.projection.addEventListener(type, listener, options)
    } catch (cause) {
      throw unknownError(cause, 'SequencedStruct.addEventListener()')
    }
  }

  /**
   * Removes a previously registered event listener.
   *
   * @param type The event type.
   * @param listener The callback or listener object to remove.
   * @param options An optional capture flag or event listener options.
   */
  removeEventListener<
    K extends keyof SequencedMapEventMap<StructKey<T>, StructValue<T>>,
  >(
    type: K,
    listener: SequencedMapEventListener<StructKey<T>, StructValue<T>, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      void this.projection.removeEventListener(type, listener, options)
    } catch (cause) {
      throw unknownError(cause, 'SequencedStruct.removeEventListener()')
    }
  }

  /**
   * Dispatches a synchronous `CustomEvent` of the specified type.
   *
   * @param type The event type.
   * @param detail The data associated with the event.
   */
  dispatchEvent<
    K extends keyof SequencedMapEventMap<StructKey<T>, StructValue<T>>,
  >(
    type: K,
    detail: SequencedMapEventMap<StructKey<T>, StructValue<T>>[K]
  ): void {
    try {
      void this.projection.dispatchEvent(type, detail)
    } catch (cause) {
      throw unknownError(cause, 'SequencedStruct.dispatchEvent()')
    }
  }
}
