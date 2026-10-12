/**
 * Splits a string into user-perceived characters using grapheme segmentation.
 *
 * @param value The text to segment.
 * @returns An array of grapheme clusters in source order.
 */
const asciiGraphemes = /^[\x00-\x09\x0B\x0C\x0E-\x7F]+$/
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function transformStringToGraphemeArray(value: string): string[] {
  const length = value.length

  if (length === 0) return []
  if (length === 1) return [value]

  if (length === 2 && value.codePointAt(0)! > 0xffff) {
    return [value]
  }

  const first = value.charCodeAt(0)

  if (first <= 0x7f && first !== 13 && asciiGraphemes.test(value)) {
    return value.split('')
  }

  return Array.from(segmenter.segment(value), (x) => x.segment)
}
