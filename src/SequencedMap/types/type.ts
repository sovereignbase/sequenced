/**
 * Visible replica projections.
 */

/**
 * Represents visible key-value changes from a local operation or merge.
 */
export type SequencedMapChange<K extends string, V> = Record<K, V | undefined>

/**
 * Partial serialized state exchanged between replicas.
 */

/**
 * Represents a serialized snapshot of the full replica state.
 */

/**
 * Represents a partial serialized replica projection exchanged between replicas.
 */
export type SequencedMapDelta<K extends string, V> = []

/**
 * Acknowledgement frontier.
 */

/**
 * Represents the current acknowledgement frontier emitted by a replica.
 */
export type SequencedMapAck = string

/**
 * Maps event names to their payload shapes.
 */
export type SequencedMapEventMap<K extends string, V> = {
  /** STATE / PROJECTION */
  snapshot: SequencedMapSnapshot<K, V>
  change: SequencedMapChange<K, V>

  /** GOSSIP / PROTOCOL */
  delta: SequencedMapDelta<K, V>
  ack: SequencedMapAck
}

/**
 * Represents a strongly typed CR-Map event listener.
 */
export type SequencedMapEventListener<
  T,
  K extends keyof SequencedMapEventMap<string, T>,
> =
  | ((event: CustomEvent<SequencedMapEventMap<string, T>[K]>) => void)
  | {
      handleEvent(event: CustomEvent<SequencedMapEventMap<string, T>[K]>): void
    }

/**
 * Resolves an event name to its corresponding listener type.
 */
export type SequencedMapEventListenerFor<
  T,
  K extends string,
> = K extends keyof SequencedMapEventMap<string, T>
  ? SequencedMapEventListener<T, K>
  : EventListenerOrEventListenerObject
