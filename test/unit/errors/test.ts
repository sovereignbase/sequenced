import { Projection } from '@sovereignbase/sequencer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sequenced, SequencedError } from '../../../src/index.js'
import { unknownError } from '../../../src/errors/unknown.js'
import { releaseText } from '../../text/text.js'

const retained: Array<{ destroy(): void }> = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const subject of retained.splice(0)) subject.destroy()
})

function check(action: () => unknown, cause: unknown, operation: string) {
  try {
    action()
    expect.fail('Expected a scoped error')
  } catch (error) {
    expect(error).toBeInstanceOf(SequencedError)
    expect(error).toMatchObject({
      code: 'UNKNOWN_ERROR',
      message: '{@sovereignbase/sequenced} ' + operation + ' failed.',
    })
    expect((error as SequencedError).cause).toBe(cause)
  }
}

it('preserves existing library errors and wraps arbitrary causes once', () => {
  const existing = new SequencedError('INVALID_CALLBACK')
  expect(unknownError(existing, 'operation()')).toBe(existing)
  for (const cause of [
    new Error('unexpected'),
    undefined,
    null,
    'failure',
    42,
  ]) {
    const error = unknownError(cause, 'operation()')
    expect(error.code).toBe('UNKNOWN_ERROR')
    expect(error.message).toBe('{@sovereignbase/sequenced} operation() failed.')
    expect(error.cause).toBe(cause)
    expect(unknownError(error, 'outer()')).toBe(error)
  }
})

describe.each(['Array', 'Map', 'Text'] as const)(
  '%s scoped failures',
  (model) => {
    function create(): any {
      const Constructor = Sequenced[model] as new (actorID: number) => any
      const subject = new Constructor(1)
      if (model === 'Array') subject.push(1)
      else if (model === 'Map') subject.set('a', 1)
      else subject.insert(0, 'a')
      retained.push({
        destroy: () =>
          model === 'Text' ? releaseText(subject) : subject.destroy(),
      })
      return subject
    }

    it('scopes constructor failures and retains the engine cause chain', () => {
      const failure = new Error('snapshot accessor')
      const snapshot = Object.defineProperty([[], []], 0, {
        get() {
          throw failure
        },
      })
      try {
        Reflect.construct(Sequenced[model], [1, snapshot])
        expect.fail('Expected constructor failure')
      } catch (error) {
        expect(error).toBeInstanceOf(SequencedError)
        expect(error).toMatchObject({
          code: 'UNKNOWN_ERROR',
          message:
            '{@sovereignbase/sequenced} Sequenced' +
            model +
            '.constructor() failed.',
        })
        expect((error as Error).cause).toBeInstanceOf(Error)
        expect(((error as Error).cause as Error).cause).toBe(failure)
      }
    })

    const cases: Array<
      [
        string,
        Exclude<keyof Projection<unknown>, 'actorID'>,
        (subject: any) => unknown,
      ]
    > =
      model === 'Array'
        ? [
            ['length()', 'length', (subject) => subject.length],
            ['#value()', 'value', (subject) => subject.get(0)],
            ['#values()', 'values', (subject) => subject.slice()],
            ['edit()', 'insert', (subject) => subject.push(2)],
            ['toJSON()', 'sequence', (subject) => subject.toJSON()],
            ['destroy()', 'destroy', (subject) => subject.destroy()],
          ]
        : model === 'Map'
          ? [
              ['#value()', 'value', (subject) => subject.get('a')],
              ['set()', 'replace', (subject) => subject.set('a', 2)],
              ['delete()', 'remove', (subject) => subject.delete('a')],
              ['clear()', 'remove', (subject) => subject.clear()],
              ['toJSON()', 'sequence', (subject) => subject.toJSON()],
              ['destroy()', 'destroy', (subject) => subject.destroy()],
            ]
          : [
              [
                '#value()',
                'value',
                (subject) => subject[Symbol.iterator]().next(),
              ],
              ['length()', 'length', (subject) => subject.length],
              ['insert()', 'insert', (subject) => subject.insert(0, 'x')],
              ['remove()', 'remove', (subject) => subject.remove(0, 1)],
              ['replace()', 'replace', (subject) => subject.replace(0, 1, 'x')],
              ['toJSON()', 'sequence', (subject) => subject.toJSON()],
              ['valueOf()', 'values', (subject) => subject.valueOf()],
            ]
    it.each(cases)(
      '%s scopes an unexpected engine failure',
      (operation, method, action) => {
        const subject = create(),
          failure = new Error('engine')
        vi.spyOn(Projection.prototype, method).mockImplementationOnce(() => {
          throw failure
        })
        check(
          () => action(subject),
          failure,
          'Sequenced' + model + '.' + operation
        )
      }
    )

    it.each([
      'addEventListener',
      'removeEventListener',
      'dispatchEvent',
    ] as const)('%s scopes native event failures', (method) => {
      const subject = create(),
        failure = new Error('event')
      subject.addEventListener('snapshot', () => {})
      vi.spyOn(EventTarget.prototype, method).mockImplementationOnce(() => {
        throw failure
      })
      check(
        () =>
          subject[method](
            'snapshot',
            method === 'dispatchEvent' ? subject.toJSON() : () => {}
          ),
        failure,
        'Sequenced' + model + '.' + method + '()'
      )
    })

    it('retains an existing SequencedError from a nested operation', () => {
      const subject = create()
      const error = new SequencedError('UNKNOWN_ERROR', 'inner')
      vi.spyOn(Projection.prototype, 'sequence').mockImplementationOnce(() => {
        throw error
      })
      expect(() => subject.toJSON()).toThrow(error)
    })
  }
)
