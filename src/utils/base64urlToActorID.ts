import { Bytes } from '@sovereignbase/bytecodec'
import { unknownError } from '../errors/unknown.js'

/**
 * Reads an actor identifier from the first four decoded bytes in little-endian order.
 * @param base64url The encoded bytes; at least four decoded bytes are required.
 * @returns An unsigned 32-bit actor identifier. Additional bytes are ignored.
 * @throws {SequencedError} With code `UNKNOWN_ERROR` if decoding or reading fails.
 */
export function base64urlToActorID(base64url: string): number {
  try {
    const bytes = Bytes.base64url.decode(base64url)
    return new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    ).getUint32(0, true)
  } catch (cause) {
    throw unknownError(cause, 'base64urlToActorID()')
  }
}
