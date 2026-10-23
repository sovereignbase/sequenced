import type { Change, Gossip, Sequence } from '@sovereignbase/sequencer'

/** Ordered visible splices with inclusive start and exclusive end positions. */
export type SequencedArrayChange<T> = Change<T>
/** Sequencer insertions and acknowledgements to send to another replica. */
export type SequencedArrayDelta<T> = Gossip<T>
/** Full replication state, including retained history and acknowledgement metadata. */
export type SequencedArraySnapshot<T> = Sequence<T>

/** Maps array event names to their `CustomEvent.detail` payloads. */
export type SequencedArrayEventMap<T> = {
  /** Ordered edits to apply to the current visible array. */
  change: SequencedArrayChange<T>
  /** Gossip produced by a local edit or a reply to incoming replication data. */
  delta: SequencedArrayDelta<T>
  /** Full replication state emitted by `snapshot()`. */
  snapshot: SequencedArraySnapshot<T>
}

/**
 * A callback or listener object for an array event.
 * @typeParam T The array element type.
 * @typeParam K The event name that determines the detail type.
 */
export type SequencedArrayEventListener<
  T,
  K extends keyof SequencedArrayEventMap<T>,
> =
  | ((event: CustomEvent<SequencedArrayEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedArrayEventMap<T>[K]>): void }

/** Resolves a known array event to its typed listener, with a DOM listener fallback. */
export type SequencedArrayEventListenerFor<
  T,
  K extends string,
> = K extends keyof SequencedArrayEventMap<T>
  ? SequencedArrayEventListener<T, K>
  : EventListenerOrEventListenerObject
