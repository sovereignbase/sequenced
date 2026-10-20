import { Bytes } from '@sovereignbase/bytecodec'
import { afterEach, expect, it, vi } from 'vitest'
import { base64urlToActorID, SequencedError } from '../../../src/index.js'

afterEach(() => vi.restoreAllMocks())

it.each([0, 1, 0x12345678, 0x80000000, 0xffffffff])(
  'reads the first four decoded bytes as little-endian uint32: %s',
  (actor) => {
    const bytes = Buffer.alloc(12, 0xff)
    bytes.writeUInt32LE(actor, 0)
    expect(base64urlToActorID(bytes.toString('base64url'))).toBe(actor)
    expect(base64urlToActorID(bytes.toString('base64'))).toBe(actor)
  }
)

it('respects a decoded view byte offset and length', () => {
  const backing = Uint8Array.of(0xff, 0xff, 0x78, 0x56, 0x34, 0x12, 0xff)
  const decode = vi
    .spyOn(Bytes.base64url, 'decode')
    .mockReturnValue(backing.subarray(2, 6))
  expect(base64urlToActorID('input')).toBe(0x12345678)
  expect(decode).toHaveBeenCalledExactlyOnceWith('input')
})

it.each(['', 'AQ', 'AQI', 'AQID', '€'])(
  'scopes decoding and short-input failures with their cause: %j',
  (input) => {
    expect(() => base64urlToActorID(input)).toThrowError(
      expect.objectContaining({
        name: 'SequencedError',
        code: 'UNKNOWN_ERROR',
        message: '{@sovereignbase/sequenced} base64urlToActorID() failed.',
        cause: expect.any(Error),
      })
    )
  }
)

it('retains unexpected thrown values and existing scoped errors', () => {
  const decode = vi.spyOn(Bytes.base64url, 'decode')
  for (const cause of [new Error('decode'), null, 'failure', undefined]) {
    decode.mockImplementationOnce(() => {
      throw cause
    })
    try {
      base64urlToActorID('input')
      expect.fail('Expected a scoped error')
    } catch (error) {
      expect(error).toBeInstanceOf(SequencedError)
      expect((error as SequencedError).code).toBe('UNKNOWN_ERROR')
      expect((error as SequencedError).cause).toBe(cause)
    }
  }
  const scoped = new SequencedError('UNKNOWN_ERROR', 'existing')
  decode.mockImplementationOnce(() => {
    throw scoped
  })
  expect(() => base64urlToActorID('input')).toThrow(scoped)
})
