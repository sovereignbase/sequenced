import { SequencedError } from './class.js'

export function unknownError(
  cause: unknown,
  operation: string
): SequencedError {
  return cause instanceof SequencedError
    ? cause
    : new SequencedError('UNKNOWN_ERROR', `${operation} failed.`, { cause })
}
