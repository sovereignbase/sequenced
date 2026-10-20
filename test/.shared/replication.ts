import type { Gossip } from '@sovereignbase/sequencer'

interface Peer<T> {
  apply(delta: unknown): void
  addEventListener(
    type: 'delta',
    listener: (event: CustomEvent<Gossip<T>>) => void
  ): void
  removeEventListener(
    type: 'delta',
    listener: (event: CustomEvent<Gossip<T>>) => void
  ): void
}

/**
 * INTERNALS.md, "Actors and acknowledgements": register every active Actor
 * before removals, exchange pending history before accepting complete frontiers.
 * No fabricated Session frontiers, retirement, or replay across compacted state.
 */
export function replication<T>(peers: Peer<T>[], actors: number[]) {
  for (const peer of peers) peer.apply(actors.map((actor) => [actor]))
  const pending: Array<{ sender: number; delta: Gossip<T> }> = []
  const listeners = peers.map((peer, sender) => {
    const listener = ({ detail }: CustomEvent<Gossip<T>>) => {
      pending.push({ sender, delta: structuredClone(detail) })
    }
    peer.addEventListener('delta', listener)
    return listener
  })
  return {
    flush(seed = 1, duplicate = false) {
      let delivered = 0
      while (pending.length) {
        // Each round drains all pending history before forwarding its replies.
        // Interleave senders while preserving each sender's complete prefixes.
        const groups = peers.map((_, sender) =>
          pending.filter((packet) => packet.sender === sender)
        )
        pending.length = 0
        while (groups.some((group) => group.length)) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
          const ready = groups.filter((group) => group.length)
          const { sender, delta } = ready[(seed >>> 8) % ready.length].shift()!
          for (let receiver = 0; receiver < peers.length; receiver++) {
            if (receiver === sender) continue
            peers[receiver].apply(structuredClone(delta))
            if (duplicate) peers[receiver].apply(structuredClone(delta))
            if (++delivered > 10_000)
              throw new Error('Test transport did not drain')
          }
        }
      }
    },
    close() {
      peers.forEach((peer, index) =>
        peer.removeEventListener('delta', listeners[index])
      )
    },
  }
}
