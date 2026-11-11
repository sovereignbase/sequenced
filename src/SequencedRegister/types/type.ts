import type { Gossip, Sequence } from '@sovereignbase/sequencer'

/** Maps register event names to their detail types. */
export type SequencedRegisterEventMap<T> = {
  /** The complete replication state. */
  snapshot: Sequence<T>
  /** The current value after a visible change. */
  change: Readonly<T | undefined>
  /** Replication data to send to other replicas. */
  delta: Gossip<T>
}

/** A callback or event listener object for a register event. */
export type SequencedRegisterEventListener<
  T,
  K extends keyof SequencedRegisterEventMap<T>,
> =
  | ((event: CustomEvent<SequencedRegisterEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedRegisterEventMap<T>[K]>): void }

/** Resolves the listener type for a register event name. */
export type SequencedRegisterEventListenerFor<
  T,
  K extends string,
> = K extends keyof SequencedRegisterEventMap<T>
  ? SequencedRegisterEventListener<T, K>
  : EventListenerOrEventListenerObject
