import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SequencedText,
  editText,
  releaseText,
  textSnapshot,
} from '../.shared/text.js'

const documents: SequencedText[] = []
function create(value = '') {
  const text = new SequencedText(1, textSnapshot(value))
  documents.push(text)
  return text
}
afterEach(() => documents.splice(0).forEach(releaseText))

describe.each(['', 'hello', 'one\ntwo\r\n', 'A😀B', 'e\u0301\ud800', '\0\t'])(
  'text editing equivalence: %j',
  (initial) => {
    it.each(['', 'x', '😀', 'pasted\r\ntext'])(
      'inserts %j at every UTF-16 boundary',
      (inserted) => {
        for (let at = 0; at <= initial.length; at++) {
          const text = create(initial)
          expect(text.insert(at, inserted)).toBeUndefined()
          expect(text.toString()).toBe(editText(initial, at, at, inserted))
          expect(text.length).toBe(initial.length + inserted.length)
        }
      }
    )

    it.each(['', 'x', '😀\n'])(
      'replaces every valid selection with %j',
      (inserted) => {
        for (let start = 0; start <= initial.length; start++) {
          for (let end = start; end <= initial.length; end++) {
            const text = create(initial)
            expect(text.replace(start, end, inserted)).toBeUndefined()
            expect(text.toString()).toBe(
              editText(initial, start, end, inserted)
            )
            expect(text.length).toBe(
              initial.length - (end - start) + inserted.length
            )
          }
        }
      }
    )

    it('removes every valid selection', () => {
      for (let start = 0; start <= initial.length; start++) {
        for (let end = start; end <= initial.length; end++) {
          const text = create(initial)
          expect(text.remove(start, end)).toBeUndefined()
          expect(text.toString()).toBe(editText(initial, start, end))
        }
      }
    })

    it('supports omitted selection and replacement arguments', () => {
      const remove = create(initial)
      remove.remove()
      expect(remove.toString()).toBe('')
      const replace = create(initial)
      replace.replace()
      expect(replace.toString()).toBe('')
      const tail = create(initial)
      tail.remove(Math.floor(initial.length / 2))
      expect(tail.toString()).toBe(
        initial.slice(0, Math.floor(initial.length / 2))
      )
      const replaceTail = create(initial)
      replaceTail.replace(1 > initial.length ? 0 : 1)
      expect(replaceTail.toString()).toBe(
        initial.slice(0, Math.min(1, initial.length))
      )
    })
  }
)

describe('text editor histories', () => {
  it.each([1, 0xc0ffee, 0x51ced, 0xffffffff])(
    'matches string edits and rendered change events (seed %s)',
    (seed) => {
      const text = create('Start\n😀')
      let expected = text.toString()
      let rendered = expected
      text.addEventListener('change', ({ detail }) => {
        for (const [start, end, inserted] of detail)
          rendered = editText(rendered, start, end, inserted)
      })
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed >>> 8
      }
      const input = [
        'a',
        ' ',
        '\n',
        '\r\n',
        '😀',
        'e\u0301',
        'paste\ttext',
        '\0',
      ]
      for (let step = 0; step < 300; step++) {
        const start = random() % (expected.length + 1)
        const end = start + (random() % (expected.length - start + 1))
        const inserted = input[random() % input.length]
        switch (random() % 3) {
          case 0:
            text.insert(start, inserted)
            expected = editText(expected, start, start, inserted)
            break
          case 1:
            text.remove(start, end)
            expected = editText(expected, start, end)
            break
          case 2:
            text.replace(start, end, inserted)
            expected = editText(expected, start, end, inserted)
        }
        expect(text.toString(), `step ${step}`).toBe(expected)
        expect(text.length, `step ${step}`).toBe(expected.length)
        expect(rendered, `step ${step}`).toBe(expected)
      }
    }
  )

  it('types, selects, pastes, backspaces and deletes using editor offsets', () => {
    const text = create()
    let cursor = 0
    for (const typed of ['H', 'e', 'l', 'l', 'o', ' ', '😀']) {
      text.insert(cursor, typed)
      cursor += typed.length
    }
    expect(text.toString()).toBe('Hello 😀')
    text.remove(cursor - 2, cursor) // Backspace the selected surrogate pair.
    text.replace(0, 5, 'Hei')
    text.insert(text.length, 'maailma\nnext line')
    text.remove(3, 4) // Delete the space at the caret.
    expect(text.toString()).toBe('Heimaailma\nnext line')
  })

  it('empty edits leave state and local events unchanged', () => {
    const text = create('abc')
    const listener = vi.fn()
    text.addEventListener('change', listener)
    text.addEventListener('delta', listener)
    text.insert(1, '')
    text.remove(1, 1)
    text.replace(1, 1, '')
    expect(text.toString()).toBe('abc')
    expect(listener).not.toHaveBeenCalled()
  })
})
