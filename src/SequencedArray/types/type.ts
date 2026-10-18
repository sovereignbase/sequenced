import type { Change, Gossip, Sequence } from '@sovereignbase/sequencer'

/** Ordered visible edits with exclusive removal ends. */
export type SequencedArrayChange<T> = Change<T>
/** Sequencer insertions and acknowledgements exchanged between replicas. */
export type SequencedArrayDelta<T> = Gossip<T>
/** Full replication state, including retained history and acknowledgements. */
export type SequencedArraySnapshot<T> = Sequence<T>

export type SequencedArrayEventMap<T> = {
  change: SequencedArrayChange<T>
  delta: SequencedArrayDelta<T>
  snapshot: SequencedArraySnapshot<T>
}

export type SequencedArrayEventListener<
  T,
  K extends keyof SequencedArrayEventMap<T>,
> =
  | ((event: CustomEvent<SequencedArrayEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedArrayEventMap<T>[K]>): void }

export type SequencedArrayEventListenerFor<
  T,
  K extends string,
> = K extends keyof SequencedArrayEventMap<T>
  ? SequencedArrayEventListener<T, K>
  : EventListenerOrEventListenerObject
