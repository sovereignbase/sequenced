/**
 * Visible replica projections.
 */

/**
 * Represents visible key-value changes from a local operation or merge.
 */
export type SequencedArrayChange<K extends string, V> = Record<K, V | undefined>

/**
 * Partial serialized state exchanged between replicas.
 */

/**
 * Represents a serialized snapshot of the full replica state.
 */

/**
 * Represents a partial serialized replica projection exchanged between replicas.
 */
export type SequencedArrayDelta<K extends string, V> = []

/**
 * Acknowledgement frontier.
 */

/**
 * Represents the current acknowledgement frontier emitted by a replica.
 */
export type SequencedArrayAck = string

/**
 * Maps event names to their payload shapes.
 */
export type SequencedArrayEventMap<K extends string, V> = {
  /** STATE / PROJECTION */
  snapshot: SequencedArraySnapshot<K, V>
  change: SequencedArrayChange<K, V>

  /** GOSSIP / PROTOCOL */
  delta: SequencedArrayDelta<K, V>
  ack: SequencedArrayAck
}

/**
 * Represents a strongly typed CR-Map event listener.
 */
export type SequencedArrayEventListener<
  T,
  K extends keyof SequencedArrayEventMap<string, T>,
> =
  | ((event: CustomEvent<SequencedArrayEventMap<string, T>[K]>) => void)
  | {
      handleEvent(
        event: CustomEvent<SequencedArrayEventMap<string, T>[K]>
      ): void
    }

/**
 * Resolves an event name to its corresponding listener type.
 */
export type SequencedArrayEventListenerFor<
  T,
  K extends string,
> = K extends keyof SequencedArrayEventMap<string, T>
  ? SequencedArrayEventListener<T, K>
  : EventListenerOrEventListenerObject
