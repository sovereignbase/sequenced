[![npm version](https://img.shields.io/npm/v/@sovereignbase/package-name)](https://www.npmjs.com/package/@sovereignbase/package-name)
[![JSR](https://jsr.io/badges/@sovereignbase/package-name)](https://jsr.io/@sovereignbase/package-name)
[![CI](https://github.com/sovereignbase/package-name/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/sovereignbase/package-name/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/sovereignbase/package-name/branch/master/graph/badge.svg)](https://codecov.io/gh/sovereignbase/package-name)
[![license](https://img.shields.io/npm/l/@sovereignbase/package-name)](LICENSE)

# package-name

## Installation

## Usage

```typescript
import { Sequenced } from '@sovereignbase/sequenced'

const alice = new Sequenced.Array<string>(1)
const bob = new Sequenced.Array<string>(2)
alice.addEventListener('delta', (event) => bob.apply(event.detail))
alice.push('hello', 'world')
alice.set(1, 'there')
console.log([...bob]) // ['hello', 'there']
alice.destroy()
bob.destroy()
```

## API

`Sequenced.Array<T>` (also exported as `SequencedArray`) implements the ES2024
Array instance methods, plus `get`, `set`, `delete`, `apply`, `merge`, `snapshot`,
`toJSON`, typed event listeners and `destroy`. See [the Array API](src/SequencedArray/README.md).

## Behavior

## Tests

[SequencedArray equivalence tests](test/equivelance/array/README.md) run with
`npm run test:array`; check their TypeScript harness with
`npm run typecheck:array`.

[Array benchmarks](benchmark/README.md) run with `npm run bench:array` and compare
plain sequencer with the SequencedArray wrapper, including listener overhead.
The offline-delivery regression currently fails because of
[sequencer issue #2](https://github.com/sovereignbase/sequencer/issues/2).

## License
