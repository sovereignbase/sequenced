import { Projection } from '@sovereignbase/sequencer'
import { SerializableKey } from '../SequencedMap/types/type.js'

export class SequencedSet {
  private readonly projection: Projection<SerializableKey>
  private readonly dedup: Set<SerializableKey>

  constructor(actorID: number, trustedSnapshot?: unknown) {
    this.projection = new Projection<SerializableKey>(actorID, trustedSnapshot)
    this.dedup = new Set(this.projection.values())
  }
  add(member: SerializableKey) {
    if (this.dedup.has(member)) return
    const delta = this.projection.insert([member], this.projection.length())
    void this.dedup.add(member)
  }
  has(member: SerializableKey) {
    return this.dedup.has(member)
  }

  delete(member: SerializableKey) {
    for (let i = 0; i < this.projection.length(); i++) {
      if (this.projection.value(i) === member) this.projection.remove(i)
    }
  }

  values(): SetIterator<SerializableKey> {
    return this.dedup.values()
  }
}
