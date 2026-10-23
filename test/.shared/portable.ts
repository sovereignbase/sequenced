import { Sequenced, SequencedError } from '../../dist/index.js'

export type Model = 'array' | 'map' | 'text'
export type Outcome = { model: Model; name: string; error: string | null }

function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
    )
}
function dispose(value: object): void {
  const target = value as {
    destroy?: () => void
    projection?: { destroy(): void }
  }
  if (target.destroy) target.destroy()
  else target.projection?.destroy()
}
export function runSuite(
  API = Sequenced,
  ErrorClass = SequencedError
): Outcome[] {
  const cases: Array<[Model, string, () => void]> = [
    [
      'array',
      'native Array editing',
      () => {
        const subject = new API.Array<number>(1),
          expected: number[] = []
        try {
          for (let i = 0; i < 48; i++) {
            equal(subject.push(i), expected.push(i))
            equal(subject.unshift(-i), expected.unshift(-i))
            equal(subject.splice(1, 1, i * 2), expected.splice(1, 1, i * 2))
            equal(subject.pop(), expected.pop())
            equal(subject.slice(), expected)
            equal([...subject.values()], expected)
            equal(
              subject.map((value) => value + 1),
              expected.map((value) => value + 1)
            )
          }
        } finally {
          dispose(subject)
        }
      },
    ],
    [
      'map',
      'native Map editing and JSON keys',
      () => {
        const subject = new API.Map<string | number, number>(1),
          expected = new Map<string | number, number>()
        try {
          for (const key of [
            1,
            '1',
            '',
            0,
            -0,
            -1,
            0.5,
            Number.MAX_VALUE,
            'constructor',
            '__proto__',
          ]) {
            subject.set(key, 1)
            expected.set(key, 1)
            subject.set(key, 2)
            expected.set(key, 2)
            equal(subject.get(key), expected.get(key))
            equal(subject.has(key), expected.has(key))
            equal([...subject], [...expected])
          }
          for (const key of [...expected.keys()])
            equal(subject.delete(key), expected.delete(key))
          equal(subject.size, expected.size)
        } finally {
          dispose(subject)
        }
      },
    ],
    [
      'text',
      'typing, selections and UTF-16',
      () => {
        const subject = new API.Text(1)
        let expected = ''
        try {
          for (const value of ['Hello', ' ', '世界', '😀', '\n', 'e\u0301']) {
            subject.insert(subject.length, value)
            expected += value
            equal(subject.toString(), expected)
          }
          subject.replace(1, 4, 'text')
          expected = expected.slice(0, 1) + 'text' + expected.slice(4)
          subject.remove(0, 2)
          expected = expected.slice(2)
          equal(subject.toString(), expected)
          equal(subject.length, expected.length)
          equal([...subject].join(''), expected)
        } finally {
          dispose(subject)
        }
      },
    ],
  ]
  for (const model of ['array', 'map', 'text'] as const) {
    cases.push([
      model,
      'events, replication and JSON snapshot',
      () => {
        const Constructor = API[
          model === 'array' ? 'Array' : model === 'map' ? 'Map' : 'Text'
        ] as new (actorID: number, snapshot?: any) => any
        const peers: any[] = [new Constructor(1), new Constructor(2)]
        const read = (peer: any) =>
          model === 'text' ? peer.toString() : [...peer]
        let changes = 0
        const retained: object[] = []
        try {
          peers.forEach((peer, index) => {
            peer.addEventListener('delta', ({ detail }: CustomEvent<unknown>) =>
              peers[1 - index].apply(JSON.parse(JSON.stringify(detail)))
            )
            peer.addEventListener('change', () => changes++)
          })
          if (model === 'array') {
            peers[0].push('a', 'b')
            peers[1].set(1, 'B')
            peers[0].delete(0)
          } else if (model === 'map') {
            peers[0].set('a', 1)
            peers[1].set('b', 2)
            peers[0].delete('a')
          } else {
            peers[0].insert(0, 'abc')
            peers[1].replace(1, 2, 'B')
            peers[0].remove(0, 1)
          }
          equal(read(peers[0]), read(peers[1]))
          if (!changes) throw new Error('Missing change events')
          const snapshot = JSON.parse(JSON.stringify(peers[0]))
          const restored: any = new Constructor(1, snapshot)
          retained.push(restored)
          equal(read(restored), read(peers[0]))
          const merged: any = new Constructor(2)
          retained.push(merged)
          merged.merge(snapshot)
          equal(read(merged), read(peers[0]))
        } finally {
          ;[...peers, ...retained].forEach(dispose)
        }
      },
    ])
    cases.push([
      model,
      'scoped errors',
      () => {
        const failure = new ErrorClass('INVALID_CALLBACK', 'test')
        equal(failure.name, 'SequencedError')
        equal(failure.code, 'INVALID_CALLBACK')
        equal(failure.message, '{@sovereignbase/sequenced} test')
        if (model === 'map') {
          const subject = new API.Map<number, number>(1)
          try {
            for (const key of [NaN, Infinity, -Infinity]) {
              let error: unknown
              try {
                subject.set(key, 1)
              } catch (caught) {
                error = caught
              }
              if (!(error instanceof ErrorClass))
                throw new Error('Non-JSON key was accepted')
            }
          } finally {
            dispose(subject)
          }
        }
      },
    ])
  }
  return cases.map(([model, name, run]) => {
    try {
      run()
      return { model, name, error: null }
    } catch (error) {
      return { model, name, error: String(error) }
    }
  })
}
