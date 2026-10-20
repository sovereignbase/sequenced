import { Projection } from '@sovereignbase/sequencer'
import type { Change, Gossip, Result, Sequence } from '@sovereignbase/sequencer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SequencedArray } from '../../../src/SequencedArray/class.js'
import { arraySnapshot } from '../array.js'

const replicas: SequencedArray<number>[] = []
function create(values: number[] = []) {
  const replica = new SequencedArray(1, arraySnapshot(values))
  replicas.push(replica)
  return replica
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const replica of replicas.splice(0)) replica.destroy()
})

describe('SequencedArray extensions and engine boundary', () => {
  it('get/set/delete address one visible element and delete shifts the tail', () => {
    const replica = create([1, 2, 3, 4])
    expect(replica.get(1)).toBe(2)
    replica.set(1, 20)
    expect([...replica]).toEqual([1, 20, 3, 4])
    replica.delete(1)
    expect([...replica]).toEqual([1, 3, 4])
    expect(replica.get(1)).toBe(3)
  })

  it('translates Array splice ranges to inclusive Projection ranges', () => {
    const replica = create([1, 2, 3, 4])
    const insert = vi.spyOn(Projection.prototype, 'insert')
    const replace = vi.spyOn(Projection.prototype, 'replace')
    const remove = vi.spyOn(Projection.prototype, 'remove')
    replica.push(5, 6)
    expect(insert).toHaveBeenLastCalledWith([5, 6], 4)
    replica.splice(1, 2, 20)
    expect(replace).toHaveBeenLastCalledWith([20], 1, 2)
    replica.splice(2, 2)
    expect(remove).toHaveBeenLastCalledWith(2, 3)
    expect([...replica]).toEqual([1, 20, 6])
  })

  it('emits local splices that reproduce the native Array edits', () => {
    const replica = create([1, 2, 3])
    const view = [1, 2, 3]
    const native = [1, 2, 3]
    const deltas: Gossip<number>[] = []
    const insert = vi.spyOn(Projection.prototype, 'insert')
    const replace = vi.spyOn(Projection.prototype, 'replace')
    const remove = vi.spyOn(Projection.prototype, 'remove')
    replica.addEventListener('change', ({ detail }) => {
      for (const [start, end, values] of detail)
        view.splice(start, end - start, ...((values ?? []) as number[]))
    })
    replica.addEventListener('delta', ({ detail }) => deltas.push(detail))
    const edits = [
      (a: number[] | SequencedArray<number>) => a.push(4, 5),
      (a: number[] | SequencedArray<number>) => a.unshift(0),
      (a: number[] | SequencedArray<number>) => a.splice(-2, 1, 40, 41),
      (a: number[] | SequencedArray<number>) => a.pop(),
      (a: number[] | SequencedArray<number>) => a.shift(),
      (a: number[] | SequencedArray<number>) => a.reverse(),
      (a: number[] | SequencedArray<number>) => a.fill(9, 1, 2),
      (a: number[] | SequencedArray<number>) => a.copyWithin(0, 1, 2),
      (a: number[] | SequencedArray<number>) => a.sort((a, b) => a - b),
    ]
    for (const edit of edits) {
      edit(native)
      edit(replica)
      expect(view).toEqual(native)
      expect([...replica]).toEqual(native)
    }
    const returned = [insert, replace, remove].flatMap((spy) =>
      spy.mock.results.map((result) => result.value)
    )
    expect(deltas).toHaveLength(edits.length)
    for (const delta of deltas) expect(returned).toContain(delta)
  })

  // Only delegation is mocked here. Array equivalence uses the real engine.
  // These tests do not define membership, compaction or delivery policy.
  describe.each(['apply', 'merge'] as const)('%s forwarding', (method) => {
    const input: Sequence<number> = [[], []]
    it('forwards the original input once and emits exact returned payloads', () => {
      const replica = create()
      const changes: Change<number> = [[0, 0, [9]]]
      const gossip: Gossip<number> = [[1]]
      const result: Result<number> = [changes, gossip]
      const engine = vi
        .spyOn(Projection.prototype, method)
        .mockReturnValue(result)
      const change = vi.fn()
      const delta = vi.fn()
      replica.addEventListener('change', change)
      replica.addEventListener('delta', delta)
      expect(replica[method](input)).toBeUndefined()
      expect(engine).toHaveBeenCalledExactlyOnceWith(input)
      expect(engine.mock.calls[0][0]).toBe(input)
      expect(change).toHaveBeenCalledTimes(1)
      expect(delta).toHaveBeenCalledTimes(1)
      expect(change.mock.calls[0][0].detail).toBe(changes)
      expect(delta.mock.calls[0][0].detail).toBe(gossip)
      expect(change.mock.invocationCallOrder[0]).toBeLessThan(
        delta.mock.invocationCallOrder[0]
      )
    })

    it.each<Result<number> | undefined>([undefined, [[]], [[], []]])(
      'does not invent events for an empty engine result %#',
      (result) => {
        const replica = create()
        vi.spyOn(Projection.prototype, method).mockReturnValue(result)
        const listener = vi.fn()
        replica.addEventListener('change', listener)
        replica.addEventListener('delta', listener)
        replica[method](input)
        expect(listener).not.toHaveBeenCalled()
      }
    )

    it('forwards acknowledgement gossip even without visible changes', () => {
      const replica = create()
      const gossip: Gossip<number> = [[1]]
      vi.spyOn(Projection.prototype, method).mockReturnValue([[], gossip])
      const change = vi.fn()
      const delta = vi.fn()
      replica.addEventListener('change', change)
      replica.addEventListener('delta', delta)
      replica[method](input)
      expect(change).not.toHaveBeenCalled()
      expect(delta.mock.calls[0][0].detail).toBe(gossip)
    })

    it('propagates the engine error unchanged', () => {
      const replica = create()
      const error = new Error('engine failure')
      vi.spyOn(Projection.prototype, method).mockImplementation(() => {
        throw error
      })
      expect(() => replica[method](input)).toThrow(error)
    })
  })

  it.each([false, true])(
    'normalizes snapshot metadata for JSON (typed=%s)',
    (typed) => {
      const replica = create()
      const values = [4, 5]
      const words = [0, 1, 2]
      vi.spyOn(Projection.prototype, 'sequence').mockReturnValue([
        typed ? Uint32Array.from(words) : words,
        values,
      ])
      const snapshot = replica.toJSON()
      expect(snapshot).toEqual([words, values])
      expect(Array.isArray(snapshot[0])).toBe(true)
      expect(snapshot[1]).toBe(values)
    }
  )

  it('roundtrips its own JSON snapshot', () => {
    const replica = create([1, 2, 3])
    replica.splice(1, 1, 20)
    const restored = new SequencedArray<number>(
      2,
      JSON.parse(JSON.stringify(replica))
    )
    replicas.push(restored)
    expect([...restored]).toEqual([...replica])
  })
})

describe('SequencedArray events', () => {
  it('snapshot emits a CustomEvent carrying the exported state', () => {
    const replica = create([1, 2, 3])
    const listener = vi.fn()
    replica.addEventListener('snapshot', listener)
    replica.snapshot()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0]).toBeInstanceOf(CustomEvent)
    expect(listener.mock.calls[0][0].detail).toEqual(replica.toJSON())
  })

  it('supports removal, listener objects, once and AbortSignal', () => {
    const replica = create()
    const removed = vi.fn()
    const once = vi.fn()
    const aborted = vi.fn()
    const object = { handleEvent: vi.fn() }
    const controller = new AbortController()
    replica.removeEventListener('snapshot', removed)
    replica.dispatchEvent('snapshot', [[], []])
    replica.addEventListener('snapshot', removed)
    replica.removeEventListener('snapshot', removed)
    replica.addEventListener('snapshot', once, { once: true })
    replica.addEventListener('snapshot', aborted, { signal: controller.signal })
    replica.addEventListener('snapshot', object)
    controller.abort()
    replica.snapshot()
    replica.snapshot()
    expect(removed).not.toHaveBeenCalled()
    expect(aborted).not.toHaveBeenCalled()
    expect(once).toHaveBeenCalledTimes(1)
    expect(object.handleEvent).toHaveBeenCalledTimes(2)
    replica.removeEventListener('snapshot', object)
    replica.snapshot()
    expect(object.handleEvent).toHaveBeenCalledTimes(2)
  })

  it('dispatches synchronously with the supplied detail', () => {
    const replica = create()
    const detail: Sequence<number> = [[], []]
    const listener = vi.fn()
    replica.addEventListener('snapshot', listener)
    replica.dispatchEvent('snapshot', detail)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].detail).toBe(detail)
  })

  it('read methods do not emit edit events', () => {
    const replica = create([1, 2, 3])
    const listener = vi.fn()
    replica.addEventListener('change', listener)
    replica.addEventListener('delta', listener)
    replica.at(0)
    replica.get(0)
    replica.map((x) => x + 1)
    replica.slice()
    replica.toJSON()
    replica.toString()
    expect(listener).not.toHaveBeenCalled()
  })
})
