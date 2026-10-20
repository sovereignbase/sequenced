import { afterEach, describe, expect, it } from 'vitest'
import { inspect } from 'node:util'
import { Sequenced } from '../../../../src/index.js'
import { SequencedText, releaseText, textSnapshot } from '../../text.js'

const documents: SequencedText[] = []
function create(value = '') {
  const text = new Sequenced.Text(1, textSnapshot(value))
  documents.push(text)
  return text
}
afterEach(() => documents.splice(0).forEach(releaseText))

describe('SequencedText existing API', () => {
  it('keeps the current text API without requiring String methods', () => {
    expect(Sequenced.Text).toBe(SequencedText)
    expect(
      Object.getOwnPropertyNames(SequencedText.prototype)
        .filter((key) => key !== 'constructor')
        .sort()
    ).toEqual(
      [
        'apply',
        'insert',
        'length',
        'merge',
        'remove',
        'replace',
        'snapshot',
        'toJSON',
        'toString',
        'valueOf',
        'addEventListener',
        'removeEventListener',
        'dispatchEvent',
      ].sort()
    )
  })

  it('constructs an empty document', () => {
    const text = new SequencedText(1)
    documents.push(text)
    expect(text.length).toBe(0)
    expect(text.toString()).toBe('')
    expect([...text]).toEqual([])
  })

  it.each(['hello', 'Hei\nmaailma\r\n', 'A😀e\u0301\ud800\0'])(
    'reads UTF-16 text %j',
    (value) => {
      const text = create(value)
      expect(text.length).toBe(value.length)
      expect(text.valueOf()).toBe(value)
      expect(text.toString()).toBe(value)
      expect(String(text)).toBe(value)
      expect(`${text}`).toBe(value)
      expect(text + '!').toBe(value + '!')
      expect([...text]).toEqual(value.split(''))
      expect(inspect(text)).toBe(value)
      expect(
        Reflect.apply(
          Reflect.get(text, Symbol.for('Deno.customInspect')),
          text,
          []
        )
      ).toBe(value)
    }
  )

  it('iterates live code units and stays exhausted after completion', () => {
    const text = create('abc')
    const iterator = text[Symbol.iterator]()
    expect(iterator.next().value).toBe('a')
    text.replace(1, 2, '😀')
    text.insert(text.length, '!')
    expect([...iterator]).toEqual('😀c!'.split(''))
    text.insert(text.length, '?')
    expect(iterator.next().done).toBe(true)
  })
})
