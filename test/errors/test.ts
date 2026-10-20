import { expect, it } from 'vitest'
import {
  Sequenced,
  SequencedArray,
  SequencedMap,
  SequencedError,
} from '../../src/index.js'
import type { SequencedErrorCode } from '../../src/index.js'
import { mapSnapshot } from '../map/map.js'

function scoped(call: () => unknown, code: SequencedErrorCode) {
  let failure: unknown
  try {
    call()
  } catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(SequencedError)
  expect(failure).toMatchObject({ name: 'SequencedError', code })
  expect((failure as Error).message).toMatch(/^\{@sovereignbase\/sequenced\} /)
}

it('exports a scoped Error with a stable code and default message', () => {
  const code: SequencedErrorCode = 'INVALID_MAP_KEY'
  const error = new SequencedError(code)
  expect(error).toBeInstanceOf(Error)
  expect(error).toBeInstanceOf(SequencedError)
  expect(error.name).toBe('SequencedError')
  expect(error.code).toBe(code)
  expect(error.message).toBe('{@sovereignbase/sequenced} INVALID_MAP_KEY')
})

it('preserves a custom message and the original cause', () => {
  const cause = new Error('original failure')
  const error = new SequencedError('INVALID_MAP_ENTRY', 'Invalid entry', {
    cause,
  })
  expect(error.message).toBe('{@sovereignbase/sequenced} Invalid entry')
  expect(error.code).toBe('INVALID_MAP_ENTRY')
  expect(error.cause).toBe(cause)
})

const arrayCases: Array<
  [SequencedErrorCode, (array: SequencedArray<number>) => unknown]
> = [
  [
    'INVALID_ARRAY_LENGTH',
    (array) => {
      array.length = -1
    },
  ],
  ['ARRAY_INDEX_OUT_OF_BOUNDS', (array) => array.set(-1, 0)],
  ['ARRAY_INDEX_OUT_OF_BOUNDS', (array) => array.delete(-1)],
  ['INVALID_CALLBACK', (array) => Reflect.apply(array.map, array, [null])],
  ['REDUCE_EMPTY_ARRAY', (array) => array.reduce((a, b) => a + b)],
  ['REDUCE_EMPTY_ARRAY', (array) => array.reduceRight((a, b) => a + b)],
]
it.each(arrayCases)(
  'Array reports %s through SequencedError',
  (code, invoke) => {
    const array = new SequencedArray<number>(1)
    try {
      scoped(() => invoke(array), code)
    } finally {
      array.destroy()
    }
  }
)

it.each(['get', 'has', 'set', 'delete'] as const)(
  'Map.%s reports invalid JSON keys',
  (method) => {
    const map = new SequencedMap<string | number, number>(1)
    try {
      scoped(
        () => Reflect.apply(map[method], map, [Infinity, 1]),
        'INVALID_MAP_KEY'
      )
      expect(map.size).toBe(0)
    } finally {
      map.destroy()
    }
  }
)

it('Map scopes invalid entry shapes and invalid callbacks', () => {
  scoped(
    () => new SequencedMap(1, mapSnapshot([['a']] as never)),
    'INVALID_MAP_ENTRY'
  )
  const map = new SequencedMap<string, number>(1)
  try {
    scoped(() => Reflect.apply(map.forEach, map, [null]), 'INVALID_CALLBACK')
  } finally {
    map.destroy()
  }
})

it.each([
  ['Array', () => new SequencedArray<number>(1)],
  ['Map', () => new SequencedMap<string, number>(1)],
  ['Text', () => new Sequenced.Text(1)],
] as const)('%s preserves original errors from the engine', (_name, create) => {
  const replica = create()
  const failure = new Error('engine failure')
  const projection = Reflect.get(replica, 'projection')
  const original = projection.apply
  projection.apply = () => {
    throw failure
  }
  try {
    let caught: unknown
    try {
      replica.apply([[1]])
    } catch (error) {
      caught = error
    }
    expect(caught).toBe(failure)
  } finally {
    projection.apply = original
    if ('destroy' in replica) replica.destroy()
    else projection.destroy()
  }
})
