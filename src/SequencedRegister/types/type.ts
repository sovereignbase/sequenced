import type { Gossip, Sequence, Change } from '@sovereignbase/sequencer'

export type SequencedRegisterSnapshot<T> = Sequence<T>

export type SequencedRegisterChange<T> = Readonly<T | undefined>

export type SequencedRegisterEventMap<T> = {
  snapshot: SequencedRegisterSnapshot<T>
  change: SequencedRegisterChange<T>
  delta: Gossip<T>
}

export type SequencedRegisterEventListener<
  T,
  K extends keyof SequencedRegisterEventMap<T>,
> =
  | ((event: CustomEvent<SequencedRegisterEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedRegisterEventMap<T>[K]>): void }

export type SequencedRegisterEventListenerFor<
  T,
  K extends string,
> = K extends keyof SequencedRegisterEventMap<T>
  ? SequencedRegisterEventListener<T, K>
  : EventListenerOrEventListenerObject
