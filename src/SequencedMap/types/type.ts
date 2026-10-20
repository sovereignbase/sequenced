import type { Gossip, Sequence } from '@sovereignbase/sequencer'

export type SerializableKey = string | number
export type SequencedMapEntry<K extends SerializableKey, V> = readonly [K, V]
export type SequencedMapSnapshot<K extends SerializableKey, V> = Sequence<
  SequencedMapEntry<K, V>
>
export type SequencedMapDelta<K extends SerializableKey, V> = Gossip<
  SequencedMapEntry<K, V>
>
export type SequencedMapChange<K extends SerializableKey, V> = Readonly<
  Record<K, Readonly<V> | undefined>
>
export type SequencedMapEventMap<K extends SerializableKey, V> = {
  change: SequencedMapChange<K, V>
  delta: SequencedMapDelta<K, V>
  snapshot: SequencedMapSnapshot<K, V>
}
export type SequencedMapEventListener<
  K extends SerializableKey,
  V,
  E extends keyof SequencedMapEventMap<K, V>,
> =
  | ((event: CustomEvent<SequencedMapEventMap<K, V>[E]>) => void)
  | { handleEvent(event: CustomEvent<SequencedMapEventMap<K, V>[E]>): void }
