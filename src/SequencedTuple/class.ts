import { Projection } from '@sovereignbase/sequencer'
import type {
  SequencedTupleEventMap,
  SequencedTupleEventListenerFor,
  SequencedTupleSnapshot,
  TupleIndex,
} from './types/type.js'
import { unknownError } from '../errors/unknown.js'

/**
 * A replicated tuple with fixed indices and independently mutable values.
 *
 * Each index retains its declared value type. Changes can be synchronized
 * between replicas without shifting other indices.
 *
 * @typeParam T The tuple's value types.
 */
export class SequencedTuple<T extends unknown[]> {
  private readonly projection: Projection<T[number]>
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
   * Creates a replicated tuple from initial values or a trusted snapshot.
   *
   * @param actorID The unique identifier of the local actor.
   * @param defaults The initial values, determining the tuple's length and types.
   * @param trustedSnapshot An optional snapshot used to restore replication state.
   */
  constructor(actorID: number, defaults: [...T], trustedSnapshot?: unknown) {
    this.projection = new Projection(actorID, trustedSnapshot, {
      enabled: 1,
      maxLength: defaults.length,
    })

    if (!trustedSnapshot) {
      void this.projection.insert(defaults, 0)
    }
  }

  /**
   * Returns the value at the specified index.
   * @param index The index to read.
   * @returns The value, or `undefined` if the index is empty.
   */
  get<I extends TupleIndex<T>>(index: I): Readonly<T[I]> | undefined {
    try {
      return this.projection.value(index) as Readonly<T[I]> | undefined
    } catch (cause) {
      throw unknownError(cause, 'SequencedTuple.get()')
    }
  }

  /**
   * Assigns a value to the specified index.
   * @param index The index to update.
   * @param value The new value.
   */
  set<I extends TupleIndex<T>>(index: I, value: T[I]): void {
    try {
      const delta = this.projection.replace([value], index, index)
      if (this.eventTarget) {
        void this.dispatchEvent('change', [[index, index + 1, [value]]])
        void this.dispatchEvent('delta', delta)
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedTuple.set()')
    }
  }

  /**
   * Removes the value at the specified index without shifting other indices.
   * @param index The index to clear.
   */
  delete<I extends TupleIndex<T>>(index: I): void {
    try {
      const delta = this.projection.remove(index, index)
      if (this.eventTarget) {
        void this.dispatchEvent('change', [[index, index + 1, [undefined]]])
        void this.dispatchEvent('delta', delta)
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedTuple.delete()')
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
   * Applies received replication data to the tuple.
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
      if (result[0]) void this.dispatchEvent('change', result[0])
      if (result[1]) void this.dispatchEvent('delta', result[1])
    } catch {}
  }

  /**
   * Merges another replica's snapshot into the tuple.
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
      if (result[0]) void this.dispatchEvent('change', result[0])
      if (result[1]) void this.dispatchEvent('delta', result[1])
    } catch {}
  }

  /**
   * ██████╗ ███████╗██████╗ ███████╗██╗███████╗████████╗███████╗███╗   ██╗ ██████╗███████╗
   * ██╔══██╗██╔════╝██╔══██╗██╔════╝██║██╔════╝╚══██╔══╝██╔════╝████╗  ██║██╔════╝██╔════╝
   * ██████╔╝█████╗  ██████╔╝███████╗██║███████╗   ██║   █████╗  ██╔██╗ ██║██║     █████╗
   * ██╔═══╝ ██╔══╝  ██╔══██╗╚════██║██║╚════██║   ██║   ██╔══╝  ██║╚██╗██║██║     ██╔══╝
   * ██║     ███████╗██║  ██║███████║██║███████║   ██║   ███████╗██║ ╚████║╚██████╗███████╗
   * ╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝╚═════╝   ╚═╝   ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝
   */

  /** Dispatches a `snapshot` event containing the current replication state. */
  snapshot(): void {
    void this.dispatchEvent('snapshot', this.toJSON())
  }

  /**
   * Returns a snapshot of the tuple's complete replication state.
   *
   * Includes the history required to restore or synchronize a replica.
   * Called automatically by `JSON.stringify()`.
   *
   * @returns The tuple's replication snapshot.
   */
  toJSON(): SequencedTupleSnapshot<T> {
    try {
      return this.projection.sequence()
    } catch (cause) {
      throw unknownError(cause, 'SequencedTuple.toJSON()')
    }
  }

  /**
   * ██╗     ██╗███████╗███████╗ ██████╗██╗   ██╗ ██████╗██╗     ███████╗
   * ██║     ██║██╔════╝██╔════╝██╔════╝╚██╗ ██╔╝██╔════╝██║     ██╔════╝
   * ██║     ██║█████╗  █████╗  ██║      ╚████╔╝ ██║     ██║     █████╗
   * ██║     ██║██╔══╝  ██╔══╝  ██║       ╚██╔╝  ██║     ██║     ██╔══╝
   * ███████╗██║██║     ███████╗╚██████╗   ██║   ╚██████╗███████╗███████╗
   * ╚══════╝╚═╝╚══════╝╚═════╝╚═════╝    ╚════╝╚═════╝╚══════╝╚══════╝
   */

  /** Releases the resources associated with this tuple. */
  destroy(): void {
    try {
      void this.projection.destroy()
    } catch (cause) {
      throw unknownError(cause, 'SequencedTuple.destroy()')
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
      throw unknownError(cause, 'SequencedTuple.retire()')
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

  /** Returns the tuple's visible values for Node.js inspection. */
  [Symbol.for('nodejs.util.inspect.custom')](): Array<T[number] | undefined> {
    return this.projection.values()
  }

  /** Returns the tuple's visible values for Deno inspection. */
  [Symbol.for('Deno.customInspect')](): Array<T[number] | undefined> {
    return this.projection.values()
  }

  /** A string identifying this object as a `SequencedTuple`. */
  get [Symbol.toStringTag](): string {
    return 'SequencedTuple'
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
  addEventListener<K extends keyof SequencedTupleEventMap<T>>(
    type: K,
    listener: SequencedTupleEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    try {
      void (this.eventTarget ??= new EventTarget()).addEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedTuple.addEventListener()')
    }
  }

  /**
   * Removes a previously registered event listener.
   *
   * @param type The event type.
   * @param listener The callback or listener object to remove.
   * @param options An optional capture flag or event listener options.
   */
  removeEventListener<K extends keyof SequencedTupleEventMap<T>>(
    type: K,
    listener: SequencedTupleEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      void this.eventTarget?.removeEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedTuple.removeEventListener()')
    }
  }

  /**
   * Dispatches a synchronous `CustomEvent` of the specified type.
   *
   * @param type The event type.
   * @param detail The data associated with the event.
   */
  dispatchEvent<K extends keyof SequencedTupleEventMap<T>>(
    type: K,
    detail: SequencedTupleEventMap<T>[K]
  ): void {
    try {
      void this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
    } catch (cause) {
      throw unknownError(cause, 'SequencedTuple.dispatchEvent()')
    }
  }
}
