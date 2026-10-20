export type SequencedErrorCode =
  | 'INVALID_ARRAY_LENGTH'
  | 'ARRAY_INDEX_OUT_OF_BOUNDS'
  | 'INVALID_CALLBACK'
  | 'REDUCE_EMPTY_ARRAY'
  | 'INVALID_MAP_KEY'
  | 'INVALID_MAP_ENTRY'
  | 'UNKNOWN_ERROR'

export class SequencedError extends Error {
  readonly code: SequencedErrorCode

  constructor(
    code: SequencedErrorCode,
    message?: string,
    options?: ErrorOptions
  ) {
    const detail = message ?? code
    super(`{@sovereignbase/sequenced} ${detail}`, options)
    this.code = code
    this.name = 'SequencedError'
  }
}
