import type { Gossip, Sequence, Change } from '@sovereignbase/sequencer'

/** Valid numeric indices for a tuple or array. */
export type TupleIndex<T extends unknown[]> = number extends T['length']
  ? number
  : Extract<keyof T, `${number}`> extends `${infer I extends number}`
    ? I
    : never

/** A snapshot containing the tuple's replication state. */
export type SequencedTupleSnapshot<T extends unknown[]> = Sequence<T[number]>

/** Maps tuple event names to their detail types. */
export type SequencedTupleEventMap<T extends unknown[]> = {
  /** The complete replication state. */
  snapshot: SequencedTupleSnapshot<T>
  /** Changes to visible tuple values. */
  change: Change<T[number]>
  /** Replication data to send to other replicas. */
  delta: Gossip<T[number]>
}

/** A callback or event listener object for a tuple event. */
export type SequencedTupleEventListener<
  T extends unknown[],
  K extends keyof SequencedTupleEventMap<T>,
> =
  | ((event: CustomEvent<SequencedTupleEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedTupleEventMap<T>[K]>): void }

/** Resolves the listener type for a tuple event name. */
export type SequencedTupleEventListenerFor<
  T extends unknown[],
  K extends string,
> = K extends keyof SequencedTupleEventMap<T>
  ? SequencedTupleEventListener<T, K>
  : EventListenerOrEventListenerObject
