import { describe, expect, it } from 'vitest'
import { SequencedArray } from '../../src/SequencedArray/class.js'
import { replication } from '../.shared/replication.js'

describe('Array model convergence', () => {
  it('keeps synchronous transport and a reentrant remote edit in view order', () => {
    const peers = [1, 2].map((actor) => new SequencedArray<string>(actor))
    for (const peer of peers) peer.apply([[1], [2]])
    const views = [[], []] as string[][]
    peers.forEach((peer, i) =>
      peer.addEventListener('change', ({ detail }) => {
        for (const [start, end, values] of detail)
          views[i].splice(start, end - start, ...((values ?? []) as string[]))
      })
    )
    let replied = false
    peers[1].addEventListener('change', () => {
      if (!replied && peers[1].length) {
        replied = true
        peers[1].unshift('reply')
      }
    })
    peers[0].addEventListener('delta', ({ detail }) => peers[1].apply(detail))
    peers[1].addEventListener('delta', ({ detail }) => peers[0].apply(detail))
    try {
      peers[0].push('hello')
      expect(peers.map((peer) => peer.slice())).toEqual([
        ['reply', 'hello'],
        ['reply', 'hello'],
      ])
      expect(views).toEqual([
        ['reply', 'hello'],
        ['reply', 'hello'],
      ])
    } finally {
      peers.forEach((peer) => peer.destroy())
    }
  })

  it('converges overlapping set/delete/splice edits without assuming a concurrent winner', () => {
    const peers = [1, 2, 3].map((actor) => new SequencedArray<number>(actor))
    const transport = replication(peers, [1, 2, 3])
    try {
      peers[0].push(1, 2, 3, 4)
      transport.flush()
      peers[0].set(1, 20)
      peers[1].delete(1)
      peers[2].splice(1, 2, 200, 300)
      transport.flush(42, true)
      const expected = peers[0].slice()
      for (const peer of peers) {
        expect(peer.slice()).toEqual(expected)
        expect([...peer]).toEqual(expected)
        expect(peer.length).toBe(expected.length)
      }
    } finally {
      transport.close()
      peers.forEach((peer) => peer.destroy())
    }
  })

  it('continues editing after all peers hydrate the same completed checkpoint', () => {
    let peers = [1, 2].map((actor) => new SequencedArray<number>(actor))
    let transport = replication(peers, [1, 2])
    try {
      peers[0].push(1, 2, 3)
      transport.flush()
      peers[1].delete(1)
      transport.flush()
      const checkpoint = JSON.parse(JSON.stringify(peers[0]))
      transport.close()
      peers.forEach((peer) => peer.destroy())
      peers = [1, 2].map(
        (actor) =>
          new SequencedArray<number>(actor, structuredClone(checkpoint))
      )
      transport = replication(peers, [1, 2])
      peers[0].push(4)
      peers[1].unshift(0)
      transport.flush()
      expect(peers.map((peer) => peer.slice())).toEqual([
        [0, 1, 3, 4],
        [0, 1, 3, 4],
      ])
    } finally {
      transport.close()
      peers.forEach((peer) => peer.destroy())
    }
  })

  it.each([1, 17, 0xc0ffee, 0xffffffff])(
    'converges registered offline edits with FIFO sender prefixes (seed %s)',
    (seed) => {
      const peers = [1, 2, 3].map((actor) => new SequencedArray<string>(actor))
      const transport = replication(peers, [1, 2, 3])
      const views = peers.map(() => [] as string[])
      peers.forEach((peer, i) =>
        peer.addEventListener('change', ({ detail }) => {
          for (const [start, end, values] of detail)
            views[i].splice(start, end - start, ...((values ?? []) as string[]))
        })
      )
      try {
        peers[0].push('base-a', 'base-b', 'base-c')
        transport.flush(seed)
        for (const [i, peer] of peers.entries()) {
          const model = ['base-a', 'base-b', 'base-c']
          peer.push(`old-${i}`)
          model.push(`old-${i}`)
          peer.splice(3, 1, `kept-${i}`, `temporary-${i}`)
          model.splice(3, 1, `kept-${i}`, `temporary-${i}`)
          peer.pop()
          model.pop()
          peer.unshift(`head-${i}`)
          model.unshift(`head-${i}`)
          expect([...peer]).toEqual(model)
          expect(views[i]).toEqual(model)
        }
        // All offline history is queued before replies are forwarded; no export
        // or restart is performed while any actor still has pending history.
        transport.flush(seed, true)
        const expected = peers[0].slice()
        expect(expected.slice().sort()).toEqual(
          [
            'base-a',
            'base-b',
            'base-c',
            'head-0',
            'head-1',
            'head-2',
            'kept-0',
            'kept-1',
            'kept-2',
          ].sort()
        )
        peers.forEach((peer, i) => {
          expect(peer.length).toBe(expected.length)
          expect(peer.slice()).toEqual(expected)
          expect([...peer]).toEqual(expected)
          expect(views[i]).toEqual(expected)
        })
        const restored = new SequencedArray<string>(
          1,
          JSON.parse(JSON.stringify(peers[0]))
        )
        try {
          expect([...restored]).toEqual(expected)
        } finally {
          restored.destroy()
        }
      } finally {
        transport.close()
        peers.forEach((peer) => peer.destroy())
      }
    }
  )

  it('merges concurrent Array edits from registered participants', () => {
    const peers = [1, 2].map((actor) => new SequencedArray<string>(actor))
    const transport = replication(peers, [1, 2])
    try {
      peers[0].push('base')
      transport.flush()
      peers[0].push('tail')
      peers[1].unshift('head')
      const states = peers.map((peer) => peer.toJSON()) // No removals to compact.
      peers[0].merge(states[1])
      peers[1].merge(states[0])
      transport.flush()
      expect(peers.map((peer) => peer.slice())).toEqual([
        ['head', 'base', 'tail'],
        ['head', 'base', 'tail'],
      ])
    } finally {
      transport.close()
      peers.forEach((peer) => peer.destroy())
    }
  })
})
