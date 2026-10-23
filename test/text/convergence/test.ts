import { describe, expect, it } from 'vitest'
import { replication } from '../../.shared/replication.js'
import { SequencedText, editText, releaseText } from '../text.js'

describe('Text model convergence', () => {
  it('converges overlapping selection edits without assuming a concurrent winner', () => {
    const peers = [1, 2, 3].map((actor) => new SequencedText(actor))
    const transport = replication(peers, [1, 2, 3])
    try {
      peers[0].insert(0, 'Hello world')
      transport.flush()
      peers[0].replace(0, 5, 'Hei')
      peers[1].remove(0, 5)
      peers[2].replace(0, 5, 'Hola')
      transport.flush(42, true)
      const expected = peers[0].toString()
      for (const peer of peers) {
        expect(peer.toString()).toBe(expected)
        expect(peer.length).toBe(expected.length)
      }
    } finally {
      transport.close()
      peers.forEach(releaseText)
    }
  })

  it('continues editing after all peers hydrate the same completed checkpoint', () => {
    let peers = [1, 2].map((actor) => new SequencedText(actor))
    let transport = replication(peers, [1, 2])
    try {
      peers[0].insert(0, 'Hello old world')
      transport.flush()
      peers[1].remove(6, 10)
      transport.flush()
      const checkpoint = JSON.parse(JSON.stringify(peers[0]))
      transport.close()
      peers.forEach(releaseText)
      peers = [1, 2].map(
        (actor) => new SequencedText(actor, structuredClone(checkpoint))
      )
      transport = replication(peers, [1, 2])
      peers[0].insert(0, '>')
      peers[1].insert(peers[1].length, '!')
      transport.flush()
      expect(peers.map(String)).toEqual(['>Hello world!', '>Hello world!'])
    } finally {
      transport.close()
      peers.forEach(releaseText)
    }
  })

  it.each([1, 17, 0xc0ffee, 0xffffffff])(
    'renders registered offline editing histories (seed %s)',
    (seed) => {
      const peers = [1, 2, 3].map((actor) => new SequencedText(actor))
      const transport = replication(peers, [1, 2, 3])
      const views = peers.map(() => '')
      peers.forEach((peer, i) =>
        peer.addEventListener('change', ({ detail }) => {
          for (const [start, end, inserted] of detail)
            views[i] = editText(views[i], start, end, inserted)
        })
      )
      try {
        peers[0].insert(0, 'Hello 😀\n')
        transport.flush(seed)
        for (const [i, peer] of peers.entries()) {
          peer.insert(peer.length, `old${i}`)
          peer.replace(peer.length - 4, peer.length, `kept${i}`)
          peer.insert(peer.length, 'trash')
          peer.remove(peer.length - 5, peer.length)
          expect(peer.toString()).toBe(`Hello 😀\nkept${i}`)
          expect(views[i]).toBe(peer.toString())
        }
        transport.flush(seed, true)
        const expected = peers[0].toString()
        expect(expected.startsWith('Hello 😀\n')).toBe(true)
        for (const i of [0, 1, 2])
          expect(expected.match(new RegExp(`kept${i}`, 'g'))).toHaveLength(1)
        expect(expected.length).toBe(
          'Hello 😀\n'.length + 'kept0kept1kept2'.length
        )
        peers.forEach((peer, i) => {
          expect(peer.toString()).toBe(expected)
          expect(peer.length).toBe(expected.length)
          expect(views[i]).toBe(expected)
        })
        // A completed checkpoint is hydrated for a read check; no stale gossip
        // from the old coordinate space is delivered to the restored document.
        const restored = new SequencedText(
          1,
          JSON.parse(JSON.stringify(peers[0]))
        )
        try {
          expect(restored.toString()).toBe(expected)
        } finally {
          releaseText(restored)
        }
      } finally {
        transport.close()
        peers.forEach(releaseText)
      }
    }
  )

  it('merges concurrent text insertions from registered participants', () => {
    const peers = [1, 2].map((actor) => new SequencedText(actor))
    const transport = replication(peers, [1, 2])
    try {
      peers[0].insert(0, 'world')
      transport.flush()
      peers[0].insert(0, 'Hello ')
      peers[1].insert(peers[1].length, '!')
      const states = peers.map((peer) => peer.toJSON())
      peers[0].merge(states[1])
      peers[1].merge(states[0])
      transport.flush()
      expect(peers.map(String)).toEqual(['Hello world!', 'Hello world!'])
    } finally {
      transport.close()
      peers.forEach(releaseText)
    }
  })

  it('keeps synchronous transport and a reentrant remote edit in render order', () => {
    const alice = new SequencedText(1)
    const bob = new SequencedText(2)
    const views = ['', '']
    const peers = [alice, bob]
    peers.forEach((peer, i) =>
      peer.addEventListener('change', ({ detail }) => {
        for (const [start, end, inserted] of detail)
          views[i] = editText(views[i], start, end, inserted)
      })
    )
    let replied = false
    bob.addEventListener('change', () => {
      if (!replied && bob.length) {
        replied = true
        bob.insert(0, '>')
      }
    })
    alice.addEventListener('delta', ({ detail }) => bob.apply(detail))
    bob.addEventListener('delta', ({ detail }) => alice.apply(detail))
    try {
      alice.insert(0, 'hello')
      expect(peers.map(String)).toEqual(['>hello', '>hello'])
      expect(views).toEqual(['>hello', '>hello'])
    } finally {
      peers.forEach(releaseText)
    }
  })
})
