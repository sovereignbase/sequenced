import type { Gossip, Sequence } from '@sovereignbase/sequencer'

export type SequencedVariableSnapshot<T> = Sequence<T>

export type SequencedVariableChange<T> = Readonly<T | undefined>

export type SequencedVariableEventMap<T> = {
  snapshot: SequencedVariableSnapshot<T>
  change: SequencedVariableChange<T>
  delta: Gossip<T>
}

export type SequencedVariableEventListener<
  T,
  K extends keyof SequencedVariableEventMap<T>,
> =
  | ((event: CustomEvent<SequencedVariableEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedVariableEventMap<T>[K]>): void }

export type SequencedVariableEventListenerFor<
  T,
  K extends string,
> = K extends keyof SequencedVariableEventMap<T>
  ? SequencedVariableEventListener<T, K>
  : EventListenerOrEventListenerObject
