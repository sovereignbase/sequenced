import { beforeAll, describe, expect, it } from 'vitest'
import {
  arrayMethods,
  arraySnapshot,
  loadArray,
  type ArrayConstructor,
} from '../.shared/array.js'

it('keeps the manifest in sync with this runtime’s Array prototype', () => {
  const native = Object.getOwnPropertyNames(Array.prototype)
    .filter((key) => !['constructor', 'length'].includes(key))
    .sort()
  expect([...arrayMethods].sort()).toEqual(native)
})

describe('SequencedArray API surface', () => {
  let ArrayReplica: ArrayConstructor
  beforeAll(async () => {
    ArrayReplica = await loadArray()
  })

  it.each(arrayMethods)('exposes Array.prototype.%s', (method) => {
    expect(new ArrayReplica<number>(1)[method]).toBeTypeOf('function')
  })

  it.each([
    'get',
    'set',
    'delete',
    'apply',
    'merge',
    'snapshot',
    'toJSON',
    'destroy',
    'addEventListener',
    'removeEventListener',
    'dispatchEvent',
  ] as const)('exposes the CRDT extension %s', (method) => {
    expect(new ArrayReplica<number>(1)[method]).toBeTypeOf('function')
  })

  it('starts empty and hydrates visible values from a snapshot', () => {
    const empty = new ArrayReplica<number>(1)
    expect(empty.length).toBe(0)
    expect([...empty]).toEqual([])
    const populated = new ArrayReplica(2, arraySnapshot([1, 2, 3]))
    expect(populated.length).toBe(3)
    expect([...populated]).toEqual([1, 2, 3])
  })

  it('exposes a writable length and default value iterator', () => {
    const replica = new ArrayReplica(1, arraySnapshot([1, 2, 3]))
    expect(replica[Symbol.iterator]).toBeTypeOf('function')
    replica.length = 1
    expect([...replica]).toEqual([1])
    replica.length = 0
    expect([...replica]).toEqual([])
  })
})
