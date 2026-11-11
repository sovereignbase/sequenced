import type { Gossip, Sequence, Change } from '@sovereignbase/sequencer'

export type SequencedTupleSnapshot<T> = Sequence<T>

export type SequencedTupleChange<T> = Readonly<T | undefined>

export type SequencedTupleEventMap<T> = {
  snapshot: SequencedTupleSnapshot<T>
  change: SequencedTupleChange<T>
  delta: Gossip<T>
}

export type SequencedTupleEventListener<
  T,
  K extends keyof SequencedTupleEventMap<T>,
> =
  | ((event: CustomEvent<SequencedTupleEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedTupleEventMap<T>[K]>): void }

export type SequencedTupleEventListenerFor<
  T,
  K extends string,
> = K extends keyof SequencedTupleEventMap<T>
  ? SequencedTupleEventListener<T, K>
  : EventListenerOrEventListenerObject
