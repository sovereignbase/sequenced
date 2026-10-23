import type { Gossip, Sequence } from '@sovereignbase/sequencer'

/** A map key; numeric keys must be finite at runtime, and negative zero becomes zero. */
export type SerializableKey = string | number
/** A key/value pair stored in the replicated sequence. */
export type SequencedMapEntry<K extends SerializableKey, V> = readonly [K, V]
/** Full map replication state, including retained entries and acknowledgement metadata. */
export type SequencedMapSnapshot<K extends SerializableKey, V> = Sequence<
  SequencedMapEntry<K, V>
>
/** Sequencer insertions and acknowledgements to send to another map replica. */
export type SequencedMapDelta<K extends SerializableKey, V> = Gossip<
  SequencedMapEntry<K, V>
>
/**
 * Changed keys mapped to their current values; deletions have the value `undefined`.
 * Numeric keys use JavaScript object property names. Readonly types do not freeze values.
 */
export type SequencedMapChange<K extends SerializableKey, V> = Readonly<
  Record<K, Readonly<V> | undefined>
>
/** Maps map event names to their `CustomEvent.detail` payloads. */
export type SequencedMapEventMap<K extends SerializableKey, V> = {
  /** Current values for changed keys, with `undefined` for deleted keys. */
  change: SequencedMapChange<K, V>
  /** Gossip produced by a local edit or a reply to incoming replication data. */
  delta: SequencedMapDelta<K, V>
  /** Full replication state emitted by `snapshot()`. */
  snapshot: SequencedMapSnapshot<K, V>
}
/**
 * A callback or listener object for a map event.
 * @typeParam K The map key type.
 * @typeParam V The map value type.
 * @typeParam E The event name that determines the detail type.
 */
export type SequencedMapEventListener<
  K extends SerializableKey,
  V,
  E extends keyof SequencedMapEventMap<K, V>,
> =
  | ((event: CustomEvent<SequencedMapEventMap<K, V>[E]>) => void)
  | { handleEvent(event: CustomEvent<SequencedMapEventMap<K, V>[E]>): void }
