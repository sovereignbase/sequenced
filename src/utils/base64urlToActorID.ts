import { Bytes } from '@sovereignbase/bytecodec'
import { unknownError } from '../errors/unknown.js'

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
