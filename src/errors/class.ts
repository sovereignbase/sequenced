export type SequencedErrorCode = 'EXAMPLE_ERROR_CODE'

export class SequencedError extends Error {
  readonly code: SequencedErrorCode

  constructor(code: SequencedErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/sequenced} ${detail}`)
    this.code = code
    this.name = 'SequencedError'
  }
}
