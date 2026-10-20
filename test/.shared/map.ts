import { Projection } from '@sovereignbase/sequencer'
import type { Sequence } from '@sovereignbase/sequencer'
import type {
  SerializableKey,
  SequencedMapEntry,
} from '../../src/SequencedMap/types/type.js'

export function mapSnapshot<K extends SerializableKey, V>(
  entries: ReadonlyArray<SequencedMapEntry<K, V>>
): Sequence<SequencedMapEntry<K, V>> {
  const projection = new Projection<SequencedMapEntry<K, V>>(100)
  try {
    if (entries.length) projection.insert(entries.slice(), 0)
    return projection.sequence()
  } finally {
    projection.destroy()
  }
}
