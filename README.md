[![npm version](https://img.shields.io/npm/v/@sovereignbase/sequenced)](https://www.npmjs.com/package/@sovereignbase/sequenced)
[![JSR](https://jsr.io/badges/@sovereignbase/sequenced)](https://jsr.io/@sovereignbase/sequenced)
[![CI](https://github.com/sovereignbase/sequenced/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/sovereignbase/sequenced/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/sovereignbase/sequenced/branch/master/graph/badge.svg)](https://codecov.io/gh/sovereignbase/sequenced)
[![license](https://img.shields.io/npm/l/@sovereignbase/sequenced)](LICENSE)

# Sequenced

## Installation

## Usage

```typescript
import { Sequenced } from '@sovereignbase/sequenced'

const alice = new Sequenced.Array<string>(1)
const bob = new Sequenced.Array<string>(2)
alice.apply([[1], [2]])
bob.apply([[1], [2]])
alice.addEventListener('delta', (event) => bob.apply(event.detail))
bob.addEventListener('delta', (event) => alice.apply(event.detail))
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

[Array tests](test/array/README.md) compare the methods with native Array.
[Text tests](test/text/README.md) compare current editing operations with string
edits at UTF-16 offsets. Both include events, public types, model convergence and
browser checks. Run `npm test`, or `npm run test:array` / `npm run test:text`.

[Benchmarks](benchmark/README.md) compare plain Sequencer with each wrapper,
with and without listeners: `npm run bench:array`, `npm run bench:text`, or
`npm run bench` for both.

## License

Apache-2.0
