import { Bytes } from '@sovereignbase/bytecodec'

export function base64urlToActorID(base64url: string): number {
  const bytes = Bytes.base64url.decode(base64url)

  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  ).getUint32(0, true)
}
