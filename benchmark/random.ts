export function random(seed: number) {
  return () => {
    let word = (seed += 0x6d2b79f5)
    word = Math.imul(word ^ (word >>> 15), word | 1)
    word ^= word + Math.imul(word ^ (word >>> 7), word | 61)
    return ((word ^ (word >>> 14)) >>> 0) / 0x100000000
  }
}
