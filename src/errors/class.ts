/** Identifies a library error independently of its human-readable message. */
export type SequencedErrorCode =
  /** An array length is not an unsigned 32-bit integer. */
  | 'INVALID_ARRAY_LENGTH'
  /** An indexed write or deletion does not address an existing array element. */
  | 'ARRAY_INDEX_OUT_OF_BOUNDS'
  /** A callback argument is not callable. */
  | 'INVALID_CALLBACK'
  /** A reduction has neither an initial value nor an array element to use. */
  | 'REDUCE_EMPTY_ARRAY'
  /** A map key is neither a string nor a finite number. */
  | 'INVALID_MAP_KEY'
  /** A map entry is not a two-element key/value pair. */
  | 'INVALID_MAP_ENTRY'
  /** An unexpected failure was wrapped with its original cause. */
  | 'UNKNOWN_ERROR'

/** An error with a library-prefixed message, a stable code and an optional cause. */
export class SequencedError extends Error {
  /** The machine-readable category of the failure. */
  readonly code: SequencedErrorCode

  /**
   * Creates an error whose name is `SequencedError`.
   * @param code The category of the failure.
   * @param message The detail to prefix with the library name; defaults to `code`.
   * @param options Error options, including the original `cause`.
   */
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
