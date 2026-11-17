import type { Gossip, Sequence } from '@sovereignbase/sequencer'
import type { CanonicalData } from '../../.types/type.js'

/**
 * Maps set event names to their `CustomEvent.detail` payloads.
 */
export type SequencedSetEventMap = {
  /**
   * Full replication state emitted by `snapshot()`.
   */
  snapshot: Sequence<CanonicalData>

  /**
   * The signed change in the number of visible values.
   */
  change: number

  /**
   * Gossip produced by a local edit or as a reply to applied or merged state.
   */
  delta: Gossip<CanonicalData>
}

/**
 * A callback or listener object for a set event.
 *
 * @typeParam K The event name that determines the event's `detail` type.
 */
export type SequencedSetEventListener<K extends keyof SequencedSetEventMap> =
  | ((event: CustomEvent<SequencedSetEventMap[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedSetEventMap[K]>): void }

/**
 * Resolves a set event name to its typed listener, or uses a DOM event
 * listener for an unrecognized event name.
 *
 * @typeParam K The event name to resolve.
 */
export type SequencedSetEventListenerFor<K extends string> =
  K extends keyof SequencedSetEventMap
    ? SequencedSetEventListener<K>
    : EventListenerOrEventListenerObject
