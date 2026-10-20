import { Projection } from '@sovereignbase/sequencer'
import type { Gossip, Result } from '@sovereignbase/sequencer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SequencedText, releaseText, textSnapshot } from '../text.js'
import type { SequencedTextSnapshot } from '../../../src/SequencedText/types/type.js'

const documents: SequencedText[] = []
function create(value = '') {
  const text = new SequencedText(1, textSnapshot(value))
  documents.push(text)
  return text
}
afterEach(() => {
  vi.restoreAllMocks()
  documents.splice(0).forEach(releaseText)
})

describe('Text wrapper events and engine boundary', () => {
  it('splits inserted UTF-16 text and translates half-open edit ranges', () => {
    const text = create('hello')
    const insert = vi.spyOn(Projection.prototype, 'insert')
    const remove = vi.spyOn(Projection.prototype, 'remove')
    const replace = vi.spyOn(Projection.prototype, 'replace')
    const change = vi.fn()
    const delta = vi.fn()
    text.addEventListener('change', change)
    text.addEventListener('delta', delta)
    text.insert(5, '😀')
    expect(insert).toHaveBeenLastCalledWith('😀'.split(''), 5)
    expect(change.mock.calls.at(-1)![0].detail).toEqual([[5, 5, '😀']])
    expect(delta.mock.calls.at(-1)![0].detail).toBe(
      insert.mock.results[0].value
    )
    text.remove(1, 3)
    expect(remove).toHaveBeenLastCalledWith(1, 2)
    expect(change.mock.calls.at(-1)![0].detail).toEqual([[1, 3]])
    expect(delta.mock.calls.at(-1)![0].detail).toBe(
      remove.mock.results[0].value
    )
    text.replace(0, 2, 'Moi')
    expect(replace).toHaveBeenLastCalledWith(['M', 'o', 'i'], 0, 1)
    expect(change.mock.calls.at(-1)![0].detail).toEqual([[0, 2, 'Moi']])
    expect(delta.mock.calls.at(-1)![0].detail).toBe(
      replace.mock.results[0].value
    )
    expect(change.mock.invocationCallOrder[0]).toBeLessThan(
      delta.mock.invocationCallOrder[0]
    )
  })

  describe.each(['apply', 'merge'] as const)('%s', (method) => {
    const input: SequencedTextSnapshot = [[], '😀']
    it('delegates input and converts engine splices to ordered text edits', () => {
      const text = create()
      const gossip: Gossip<string> = [[1]]
      const result: Result<string> = [
        [
          [0, 0, ['\ud83d', '\ude00']],
          [2, 4],
        ],
        gossip,
      ]
      const engine = vi
        .spyOn(Projection.prototype, method)
        .mockReturnValue(result)
      const change = vi.fn()
      const delta = vi.fn()
      text.addEventListener('change', change)
      text.addEventListener('delta', delta)
      text[method](input)
      expect(engine).toHaveBeenCalledTimes(1)
      if (method === 'apply') expect(engine.mock.calls[0][0]).toBe(input)
      else {
        expect(engine.mock.calls[0][0]).toEqual([input[0], input[1].split('')])
        expect((engine.mock.calls[0][0] as unknown[])[0]).toBe(input[0])
      }
      expect(change).toHaveBeenCalledTimes(1)
      expect(change.mock.calls[0][0].detail).toEqual([
        [0, 0, '😀'],
        [2, 4],
      ])
      expect(delta.mock.calls[0][0].detail).toBe(gossip)
      expect(change.mock.invocationCallOrder[0]).toBeLessThan(
        delta.mock.invocationCallOrder[0]
      )
    })

    it('does not emit events when the engine returns undefined', () => {
      const text = create()
      vi.spyOn(Projection.prototype, method).mockReturnValue(undefined)
      const listener = vi.fn()
      text.addEventListener('change', listener)
      text.addEventListener('delta', listener)
      text[method](input)
      expect(listener).not.toHaveBeenCalled()
    })

    it('preserves the documented empty change event without a reply', () => {
      const text = create()
      vi.spyOn(Projection.prototype, method).mockReturnValue([[]])
      const change = vi.fn()
      const delta = vi.fn()
      text.addEventListener('change', change)
      text.addEventListener('delta', delta)
      text[method](input)
      expect(change).toHaveBeenCalledTimes(1)
      expect(change.mock.calls[0][0].detail).toEqual([])
      expect(delta).not.toHaveBeenCalled()
    })

    it('propagates the engine error unchanged', () => {
      const text = create()
      const error = new Error('engine failure')
      vi.spyOn(Projection.prototype, method).mockImplementation(() => {
        throw error
      })
      expect(() => text[method](input)).toThrow(error)
    })
  })

  it.each([false, true])(
    'exports JSON-compatible UTF-16 state (typed metadata=%s)',
    (typed) => {
      const text = create()
      const words = [0, 1, 2]
      vi.spyOn(Projection.prototype, 'sequence').mockReturnValue([
        typed ? Uint32Array.from(words) : words,
        ['a', '\ud83d', '\ude00'],
      ])
      expect(text.toJSON()).toEqual([words, 'a😀'])
      expect(JSON.parse(JSON.stringify(text))).toEqual([words, 'a😀'])
    }
  )

  it('roundtrips an edited document through a JSON snapshot', () => {
    const text = create('Hei 😀\n')
    text.replace(0, 3, 'Hello')
    const snapshot = vi.fn()
    text.addEventListener('snapshot', snapshot)
    text.snapshot()
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(snapshot.mock.calls[0][0]).toBeInstanceOf(CustomEvent)
    expect(snapshot.mock.calls[0][0].detail).toEqual(text.toJSON())
    const restored = new SequencedText(2, JSON.parse(JSON.stringify(text)))
    documents.push(restored)
    expect(restored.toString()).toBe('Hello 😀\n')
  })

  it('honors listener removal, objects, once and AbortSignal', () => {
    const text = create()
    const removed = vi.fn()
    const once = vi.fn()
    const aborted = vi.fn()
    const object = { handleEvent: vi.fn() }
    const controller = new AbortController()
    text.addEventListener('snapshot', removed)
    text.removeEventListener('snapshot', removed)
    text.addEventListener('snapshot', once, { once: true })
    text.addEventListener('snapshot', aborted, { signal: controller.signal })
    text.addEventListener('snapshot', object)
    controller.abort()
    text.snapshot()
    text.snapshot()
    expect(removed).not.toHaveBeenCalled()
    expect(aborted).not.toHaveBeenCalled()
    expect(once).toHaveBeenCalledTimes(1)
    expect(object.handleEvent).toHaveBeenCalledTimes(2)
    text.removeEventListener('snapshot', object)
    text.snapshot()
    expect(object.handleEvent).toHaveBeenCalledTimes(2)
  })

  it('dispatches synchronously with the original detail', () => {
    const text = create()
    const detail: SequencedTextSnapshot = [[], 'abc']
    const listener = vi.fn()
    text.addEventListener('snapshot', listener)
    text.dispatchEvent('snapshot', detail)
    expect(listener).toHaveBeenCalledExactlyOnceWith(expect.any(CustomEvent))
    expect(listener.mock.calls[0][0].detail).toBe(detail)
  })

  it('reads do not emit edit events', () => {
    const text = create('abc')
    const listener = vi.fn()
    text.addEventListener('change', listener)
    text.addEventListener('delta', listener)
    String(text)
    text.toJSON()
    Array.from(text)
    expect(listener).not.toHaveBeenCalled()
  })

  it('the iterator omits missing Footage returned by the engine', () => {
    const text = create('abc')
    vi.spyOn(Projection.prototype, 'value').mockReturnValueOnce(undefined)
    expect([...text]).toEqual(['b', 'c'])
  })
})
