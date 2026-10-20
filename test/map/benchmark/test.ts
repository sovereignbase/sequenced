import { Projection } from '@sovereignbase/sequencer'
import { describe, expect, it, vi } from 'vitest'
import { SequencedMap } from '../../../src/SequencedMap/class.js'
import {
  operations,
  prepareFixture,
  createWorkload,
  callsPerSample,
  supports,
} from '../../../benchmark/map/workloads.js'

describe.each(['plain', 'wrapper', 'wrapper+listeners'] as const)(
  'Map benchmark fixtures: %s',
  (implementation) => {
    it.each(
      operations.filter((operation) => supports(operation, implementation))
    )('%s validates fresh inputs against a native Map model', (operation) => {
      const fixture = prepareFixture(
        operation,
        64,
        callsPerSample(operation, 8)
      )
      for (let repeat = 0; repeat < 2; repeat++) {
        const workload = createWorkload(fixture, implementation, SequencedMap)
        try {
          workload.run()
          expect(() => workload.verify()).not.toThrow()
        } finally {
          workload.dispose()
        }
      }
    })
  }
)
it('does not benchmark a substitute when the Map constructor is missing', () => {
  expect(() =>
    createWorkload(prepareFixture('get.random', 64, 8), 'wrapper')
  ).toThrow(TypeError)
})

it('uses reproducible random keys across the collection and adjusts deletion positions', () => {
  const fixture = prepareFixture('delete.random', 1024, 32, 17)
  expect(prepareFixture('delete.random', 1024, 32, 17).selected).toEqual(
    fixture.selected
  )
  expect(prepareFixture('delete.random', 1024, 32, 18).selected).not.toEqual(
    fixture.selected
  )
  expect(new Set(fixture.keys).size).toBe(32)
  expect(Math.min(...fixture.selected)).toBeLessThan(256)
  expect(Math.max(...fixture.selected)).toBeGreaterThan(768)
  const remaining = fixture.entries.slice()
  fixture.positions.forEach((at, i) => {
    expect(remaining.splice(at, 1)[0][0]).toBe(fixture.keys[i])
  })
  expect(remaining).toEqual(fixture.expected)
})

it.each(['get.random', 'has.random'] as const)(
  '%s executes the complete random key trace',
  (operation) => {
    const method = operation === 'get.random' ? 'get' : 'has'
    const spy = vi.spyOn(SequencedMap.prototype, method)
    const fixture = prepareFixture(operation, 1024, 32)
    const workload = createWorkload(fixture, 'wrapper', SequencedMap)
    try {
      for (let run = 0; run < 33; run++) {
        workload.run()
        workload.verify()
      }
      expect(new Set(spy.mock.calls.map(([key]) => key)).size).toBe(1024)
      expect(spy.mock.calls.map(([key]) => key)).toEqual([
        ...fixture.keys,
        ...fixture.keys.slice(0, 32),
      ])
    } finally {
      spy.mockRestore()
      workload.dispose()
    }
  }
)

it('benchmarks every public Map method, getter and symbol', () => {
  const covered = new Map<PropertyKey, string>([
    ['constructor', 'construct'],
    ['size', 'size'],
    ['get', 'get.random'],
    ['has', 'has.random'],
    ['set', 'set.random'],
    ['delete', 'delete.random'],
    ['clear', 'clear'],
    ['keys', 'keys'],
    ['values', 'values'],
    ['entries', 'entries'],
    ['forEach', 'forEach'],
    ['apply', 'apply.set.random'],
    ['merge', 'merge.set.random'],
    ['snapshot', 'snapshot'],
    ['toJSON', 'toJSON'],
    ['destroy', 'destroy'],
    ['addEventListener', 'addEventListener'],
    ['removeEventListener', 'removeEventListener'],
    ['dispatchEvent', 'dispatchEvent'],
    [Symbol.iterator, 'iterator'],
    [Symbol.toStringTag, 'toStringTag'],
    [Symbol.for('nodejs.util.inspect.custom'), 'inspect.node'],
    [Symbol.for('Deno.customInspect'), 'inspect.deno'],
  ])
  for (const key of Reflect.ownKeys(SequencedMap.prototype)) {
    if (key === 'received' || key === 'patch') continue
    expect(covered.has(key), String(key)).toBe(true)
    expect(operations).toContain(covered.get(key))
  }
})

it.each(['addEventListener', 'removeEventListener'] as const)(
  '%s resets registrations between samples on the same Map',
  (operation) => {
    const fixture = prepareFixture(operation, 64, 8)
    const workload = createWorkload(fixture, 'wrapper+listeners', SequencedMap)
    try {
      for (let run = 0; run < 4; run++) {
        workload.resetListeners()
        workload.run()
      }
      expect(() => workload.verify()).not.toThrow()
    } finally {
      workload.dispose()
    }
  }
)

it.each([
  'merge.set.random',
  'merge.delete.random',
  'merge.set.new',
  'merge.identical',
] as const)(
  '%s supplies complete retained Sequences to Projection.merge',
  (operation) => {
    const fixture = prepareFixture(operation, 64, 8)
    const expected = new Map(fixture.entries)
    fixture.states.forEach((snapshot, i) => {
      if (operation === 'merge.set.random' || operation === 'merge.set.new')
        expected.set(...fixture.payloads[i])
      else if (operation === 'merge.delete.random')
        expected.delete(fixture.keys[i])
      const hydrated = new Projection(300, snapshot)
      try {
        expect(hydrated.values()).toEqual([...expected])
      } finally {
        hydrated.destroy()
      }
    })
    const merge = vi.spyOn(Projection.prototype, 'merge')
    const apply = vi.spyOn(Projection.prototype, 'apply')
    const workload = createWorkload(fixture, 'wrapper', SequencedMap)
    try {
      workload.run()
      workload.verify()
      expect(apply).not.toHaveBeenCalled()
      expect(merge.mock.calls.map(([snapshot]) => snapshot)).toEqual(
        operation === 'merge.identical'
          ? Array(8).fill(fixture.states[0])
          : fixture.states
      )
      if (operation === 'merge.identical') {
        expect(
          merge.mock.results.every(({ value }) => value?.[0].length === 0)
        ).toBe(true)
      }
    } finally {
      merge.mockRestore()
      apply.mockRestore()
      workload.dispose()
    }
  }
)
