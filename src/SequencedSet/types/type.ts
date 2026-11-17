import type { Gossip, Sequence } from '@sovereignbase/sequencer'
import { CanonicalData } from '../../.types/type.js'

/**
 * Maps text event names to their `CustomEvent.detail` payloads.
 */
export type SequencedSetEventMap = {
  /**
   * Full replication state emitted by `snapshot()`.
   */
  snapshot: Sequence<CanonicalData>

  /**
   * Dispatched with ordered edits to the visible text. The list may be empty
   * when applied or merged state leaves the visible text unchanged.
   */
  change: number

  /**
   * Dispatched with gossip produced by a local edit or as a reply to applied
   * or merged state. Inserted content is represented as UTF-16 code units.
   */
  delta: Gossip<CanonicalData>
}

/**
 * A callback or listener object for a text event.
 *
 * @typeParam K The event name that determines the event's `detail` type.
 */
export type SequencedSetEventListener<K extends keyof SequencedSetEventMap> =
  | ((event: CustomEvent<SequencedSetEventMap[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedSetEventMap[K]>): void }

/**
 * Resolves a document event name to its typed listener, or uses a DOM event
 * listener for an unrecognized event name.
 *
 * @typeParam K The event name to resolve.
 */
export type SequencedSetEventListenerFor<K extends string> =
  K extends keyof SequencedSetEventMap
    ? SequencedSetEventListener<K>
    : EventListenerOrEventListenerObject
