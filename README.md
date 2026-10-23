[![npm version](https://img.shields.io/npm/v/@sovereignbase/sequenced)](https://www.npmjs.com/package/@sovereignbase/sequenced)
[![JSR](https://jsr.io/badges/@sovereignbase/sequenced)](https://jsr.io/@sovereignbase/sequenced)
[![CI](https://github.com/sovereignbase/sequenced/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/sovereignbase/sequenced/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/sovereignbase/sequenced/branch/master/graph/badge.svg)](https://codecov.io/gh/sovereignbase/sequenced)
[![license](https://img.shields.io/npm/l/@sovereignbase/sequenced)](LICENSE)

# Sequenced

Replicated Array, Map and Text implementations built on [Sequencer](https://github.com/sovereignbase/sequencer).

## Contents

- [Array](#array)
  - [Usage](#usage) · [Errors](#errors) · [Benchmarks](#benchmarks) · [Tests](#tests)
- [Map](#map)
  - [Usage](#usage-1) · [Errors](#errors-1) · [Benchmarks](#benchmarks-1) · [Tests](#tests-1)
- [Text](#text)
  - [Usage](#usage-2) · [Errors](#errors-2) · [Benchmarks](#benchmarks-2) · [Tests](#tests-2)
- [License](#license)

## Array

### Usage

```typescript
import { Sequenced } from '@sovereignbase/sequenced'

const alice = new Sequenced.Array<string>(1)
const bob = new Sequenced.Array<string>(2)
alice.addEventListener('delta', (event) => bob.apply(event.detail))
bob.addEventListener('delta', (event) => alice.apply(event.detail))
alice.push('hello', 'world')
alice.set(1, 'there')
console.log([...bob]) // ['hello', 'there']
alice.destroy()
bob.destroy()
```

The dense Array method API uses `get(index)`, `set(index, value)` and `delete(index)` for individual positions.

Copying methods return plain arrays. Callbacks receive the wrapper, and iterators observe subsequent edits.

#### Errors

| Code                        | Meaning                                                 |
| --------------------------- | ------------------------------------------------------- |
| `INVALID_ARRAY_LENGTH`      | The requested length is not a valid array length.       |
| `ARRAY_INDEX_OUT_OF_BOUNDS` | `set` or `delete` does not address an existing element. |
| `INVALID_CALLBACK`          | A callback is not callable.                             |
| `REDUCE_EMPTY_ARRAY`        | Reduction of an empty array without an initial value.   |

### Benchmarks

<!-- BEGIN GENERATED:array:benchmarks -->

2026-10-23 · ops/sec

Node v24.16.0 · win32 x64 · Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz · Sequencer 1.1.1

| Operation             |        100 |      1,000 |     10,000 |
| --------------------- | ---------: | ---------: | ---------: |
| `length`              | 52,159,739 | 51,791,223 | 52,006,140 |
| `at.random`           | 25,066,824 | 27,687,308 | 26,193,890 |
| `get.random`          | 23,882,054 | 27,029,049 | 27,247,864 |
| `values`              |    153,455 |     17,480 |      1,783 |
| `slice.all`           |  5,511,587 |    831,638 |    125,554 |
| `slice.random`        |  6,589,972 |  7,419,687 |  7,580,080 |
| `push`                |  1,486,528 |  1,863,963 |  1,626,297 |
| `unshift`             |  1,227,646 |  1,370,528 |  1,320,933 |
| `splice.random`       |    529,454 |    570,319 |    483,302 |
| `set.random`          |    679,227 |    668,972 |    535,288 |
| `delete.random`       |    896,242 |    874,789 |    680,240 |
| `apply.insert.random` |  1,243,643 |  1,341,260 |  1,210,456 |
| `apply.set.random`    |    526,872 |    482,917 |    412,581 |
| `apply.delete.random` |    700,278 |    663,277 |    523,033 |
| `merge.insert.random` |    135,914 |    141,653 |    110,790 |
| `merge.set.random`    |     65,100 |     59,129 |     49,882 |
| `merge.delete.random` |    107,786 |     99,822 |     60,349 |
| `merge.identical`     |  1,155,766 |  1,147,882 |  1,053,073 |
| `snapshot`            |  2,168,982 |  2,461,735 |  2,657,725 |
| `toJSON`              |  4,642,527 |  5,149,138 |  5,144,365 |

<!-- END GENERATED:array:benchmarks -->

### Tests

<!-- BEGIN GENERATED:array:tests -->

2026-10-23 · **passed**

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      9 |      0 |       0 |
| convergence |      8 |      0 |       0 |
| equivelance |    280 |      0 |       0 |
| events      |     40 |      0 |       0 |
| integration |      6 |      0 |       0 |
| unit        |     66 |      0 |       0 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime      | Version      | Status |
| ------------ | ------------ | ------ |
| Node.js ESM  | v24.16.0     | passed |
| Node.js CJS  | v24.16.0     | passed |
| Bun          | 1.4.4        | passed |
| Deno         | 2.9.6        | passed |
| Edge Runtime | 4.0.1        | passed |
| workerd      | 1.20261019.1 | passed |
| Chromium     | 156.0.8078.4 | passed |
| Firefox      | 153.0        | passed |
| WebKit       | 27.2         | passed |

<!-- END GENERATED:array:tests -->

## Map

### Usage

```typescript
import { Sequenced } from '@sovereignbase/sequenced'

const map = new Sequenced.Map<string | number, number>(1)
map.set('apples', 3).set(1, 10)
console.log(map.get('apples')) // 3
console.log([...map]) // [['apples', 3], [1, 10]]
map.delete(1)
const snapshot = map.toJSON()
map.destroy()
```

Keys are strings or finite numbers. Numeric and string keys remain distinct.
Concurrent duplicate keys keep the first entry.

#### Errors

| Code                | Meaning                                        |
| ------------------- | ---------------------------------------------- |
| `INVALID_MAP_KEY`   | A key is neither a string nor a finite number. |
| `INVALID_MAP_ENTRY` | An entry is not a `[key, value]` pair.         |
| `INVALID_CALLBACK`  | The `forEach` callback is not callable.        |

### Benchmarks

<!-- BEGIN GENERATED:map:benchmarks -->

2026-10-23 · ops/sec

Node v24.16.0 · win32 x64 · Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz · Sequencer 1.1.1

| Operation             |        100 |      1,000 |     10,000 |
| --------------------- | ---------: | ---------: | ---------: |
| `get.random`          | 18,237,215 | 13,404,599 | 12,330,029 |
| `has.random`          | 28,291,527 | 19,351,903 | 18,882,161 |
| `set.random`          |    281,080 |    290,387 |    292,144 |
| `delete.random`       |    327,918 |     52,126 |      6,126 |
| `apply.set.random`    |    364,392 |    236,552 |    135,770 |
| `apply.delete.random` |    165,263 |     18,820 |      2,094 |
| `set.new`             |    863,391 |    587,182 |    556,319 |
| `apply.set.new`       |    800,827 |    544,688 |    422,041 |
| `size`                | 90,797,038 | 81,918,400 | 90,315,445 |
| `clear`               |    199,102 |     47,238 |      4,996 |
| `keys`                |  3,521,512 |    410,603 |     37,447 |
| `values`              |    136,272 |     14,399 |      1,335 |
| `entries`             |    111,787 |     12,035 |      1,094 |
| `iterator`            |    122,528 |     12,184 |      1,107 |
| `forEach`             |    141,619 |      8,073 |      1,265 |
| `merge.set.random`    |     89,359 |     72,386 |     74,544 |
| `merge.delete.random` |     85,012 |     19,779 |      2,044 |
| `merge.set.new`       |    451,914 |    354,649 |    302,275 |
| `merge.identical`     |  1,455,636 |  1,239,207 |  1,335,927 |
| `snapshot`            |  1,826,342 |  1,720,172 |  1,576,946 |
| `toJSON`              |  4,986,676 |  5,220,800 |  5,095,440 |
| `construct`           |    124,908 |     13,547 |        947 |
| `destroy`             |  2,025,090 |  1,622,026 |    358,701 |
| `addEventListener`    |  6,031,668 |  7,387,655 |  7,401,415 |
| `removeEventListener` | 13,721,394 | 15,661,930 | 14,717,738 |
| `dispatchEvent`       |  3,321,821 |  3,430,194 |  2,916,698 |
| `toStringTag`         | 37,089,731 | 84,849,503 | 81,143,189 |
| `inspect.node`        |     34,731 |      6,727 |        589 |
| `inspect.deno`        |     14,984 |      7,955 |        586 |

<!-- END GENERATED:map:benchmarks -->

### Tests

<!-- BEGIN GENERATED:map:tests -->

2026-10-23 · **passed**

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      9 |      0 |       0 |
| convergence |     10 |      0 |       0 |
| equivelance |    135 |      0 |       0 |
| events      |     66 |      0 |       0 |
| integration |      6 |      0 |       0 |
| unit        |     95 |      0 |       0 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime      | Version      | Status |
| ------------ | ------------ | ------ |
| Node.js ESM  | v24.16.0     | passed |
| Node.js CJS  | v24.16.0     | passed |
| Bun          | 1.4.4        | passed |
| Deno         | 2.9.6        | passed |
| Edge Runtime | 4.0.1        | passed |
| workerd      | 1.20261019.1 | passed |
| Chromium     | 156.0.8078.4 | passed |
| Firefox      | 153.0        | passed |
| WebKit       | 27.2         | passed |

<!-- END GENERATED:map:tests -->

## Text

### Usage

```typescript
import { Sequenced } from '@sovereignbase/sequenced'

const text = new Sequenced.Text(1)
text.insert(0, 'Hello world')
text.replace(6, 11, 'there')
text.insert(text.length, '!')
console.log(text.toString()) // 'Hello there!'
text.remove(5, text.length)
console.log(text.toString()) // 'Hello'
```

Editing uses UTF-16 offsets and half-open selections: `[start, end)`.
`toJSON()` exports the complete replication snapshot.

#### Errors

Sequencer errors are propagated unchanged.

### Benchmarks

<!-- BEGIN GENERATED:text:benchmarks -->

2026-10-23 · ops/sec

Node v24.16.0 · win32 x64 · Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz · Sequencer 1.1.1

| Operation              |        100 |      1,000 |     10,000 |
| ---------------------- | ---------: | ---------: | ---------: |
| `length`               | 63,476,165 | 55,657,043 | 55,861,283 |
| `toString`             |    736,712 |     85,473 |      8,467 |
| `iterator`             |    144,558 |     15,831 |      1,678 |
| `insert.head`          |    754,404 |    984,960 |    921,845 |
| `insert.middle`        |    849,743 |    881,701 |    944,868 |
| `insert.tail`          |    914,610 |  1,141,812 |  1,038,494 |
| `insert.random`        |    696,813 |    880,860 |    883,762 |
| `remove.random`        |    638,355 |    655,129 |    558,785 |
| `replace.random`       |    469,470 |    516,409 |    450,635 |
| `apply.insert.random`  |    751,914 |    839,299 |    857,690 |
| `apply.remove.random`  |    526,775 |    527,607 |    388,369 |
| `apply.replace.random` |    396,649 |    378,371 |    363,423 |
| `merge.insert.random`  |     97,929 |     65,466 |     11,953 |
| `merge.remove.random`  |    110,202 |     91,304 |     38,619 |
| `merge.replace.random` |     58,043 |     42,632 |     10,775 |
| `merge.identical`      |    709,456 |    386,970 |     73,332 |
| `snapshot`             |    633,309 |    118,996 |     12,994 |
| `toJSON`               |    839,484 |    125,947 |     12,423 |

<!-- END GENERATED:text:benchmarks -->

### Tests

<!-- BEGIN GENERATED:text:tests -->

2026-10-23 · **passed**

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      9 |      0 |       0 |
| convergence |      8 |      0 |       0 |
| equivelance |     66 |      0 |       0 |
| events      |     34 |      0 |       0 |
| integration |      6 |      0 |       0 |
| unit        |     59 |      0 |       0 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime      | Version      | Status |
| ------------ | ------------ | ------ |
| Node.js ESM  | v24.16.0     | passed |
| Node.js CJS  | v24.16.0     | passed |
| Bun          | 1.4.4        | passed |
| Deno         | 2.9.6        | passed |
| Edge Runtime | 4.0.1        | passed |
| workerd      | 1.20261019.1 | passed |
| Chromium     | 156.0.8078.4 | passed |
| Firefox      | 153.0        | passed |
| WebKit       | 27.2         | passed |

<!-- END GENERATED:text:tests -->

## License

Apache-2.0
