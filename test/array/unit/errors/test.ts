import { expect, it } from 'vitest'
import { SequencedError } from '../../../../src/index.js'

it('preserves scoped error codes, default messages and causes', () => {
  const cause = new Error('cause')
  const error = new SequencedError('INVALID_CALLBACK', 'callback', { cause })
  expect(error).toBeInstanceOf(Error)
  expect(error.name).toBe('SequencedError')
  expect(error.code).toBe('INVALID_CALLBACK')
  expect(error.message).toBe('{@sovereignbase/sequenced} callback')
  expect(error.cause).toBe(cause)
  expect(new SequencedError('INVALID_CALLBACK').message).toBe(
    '{@sovereignbase/sequenced} INVALID_CALLBACK'
  )
})
