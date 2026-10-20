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

2026-10-20 · ops/sec

Node v24.16.0 · win32 x64 · Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz · Sequencer 1.0.2

| Operation       |        100 |      1,000 |     10,000 |
| --------------- | ---------: | ---------: | ---------: |
| `length`        | 80,823,192 | 83,821,143 | 81,469,993 |
| `at.middle`     | 35,071,649 | 35,046,050 | 34,798,052 |
| `get.middle`    | 35,488,187 | 36,582,217 | 24,424,501 |
| `values`        |    144,465 |     17,244 |        960 |
| `slice.all`     |  5,304,194 |    843,804 |     87,459 |
| `slice.middle`  |  6,900,179 |  6,940,557 |  5,760,736 |
| `push`          |  1,734,543 |  1,821,717 |  1,298,882 |
| `unshift`       |  1,439,986 |  1,240,434 |  1,207,958 |
| `splice.middle` |    703,188 |    521,376 |    481,011 |
| `set.middle`    |    683,634 |    666,807 |    380,101 |
| `delete.middle` |    885,413 |    817,263 |    611,784 |
| `apply.insert`  |  1,222,411 |  1,253,141 |  1,109,357 |
| `merge.insert`  |    134,352 |    150,712 |    129,472 |
| `snapshot`      |  3,564,461 |  4,783,091 |  4,544,964 |

<!-- END GENERATED:array:benchmarks -->

### Tests

<!-- BEGIN GENERATED:array:tests -->

2026-10-20 · **passed**

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      8 |      1 |       0 |
| convergence |      8 |      0 |       0 |
| equivelance |    280 |      0 |       0 |
| events      |     40 |      0 |       0 |
| integration |      4 |      2 |       0 |
| unit        |     46 |      0 |       0 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime      | Version      | Status |
| ------------ | ------------ | ------ |
| Node.js ESM  | v24.16.0     | passed |
| Node.js CJS  | v24.16.0     | passed |
| Bun          | 1.4.3        | passed |
| Deno         | 2.9.6        | passed |
| Edge Runtime | 4.0.1        | passed |
| workerd      | 1.20261006.1 | passed |
| Chromium     | 156.0.8078.4 | passed |
| Firefox      | —            | failed |
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

2026-10-20 · ops/sec

Node v24.16.0 · win32 x64 · Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz · Sequencer 1.0.2

| Operation             |        100 |      1,000 |     10,000 |
| --------------------- | ---------: | ---------: | ---------: |
| `get.random`          | 17,651,023 | 12,816,895 | 10,349,210 |
| `has.random`          | 26,978,391 | 19,898,006 | 15,507,714 |
| `set.random`          |    258,658 |    247,792 |    233,128 |
| `delete.random`       |    284,436 |     33,648 |      5,200 |
| `apply.set.random`    |    311,970 |    241,318 |    179,812 |
| `apply.delete.random` |    116,390 |      9,616 |      1,951 |
| `set.new`             |    518,460 |    414,100 |    410,512 |
| `apply.set.new`       |    553,431 |    484,214 |    221,008 |
| `size`                | 64,651,830 | 72,794,836 | 61,194,964 |
| `clear`               |    193,661 |     44,883 |      3,292 |
| `keys`                |  3,541,231 |    356,077 |     22,160 |
| `values`              |    111,279 |     12,539 |      1,124 |
| `entries`             |    100,341 |     11,104 |        775 |
| `iterator`            |    107,888 |     10,327 |        601 |
| `forEach`             |     90,478 |     11,859 |        888 |
| `merge.set.random`    |     76,489 |     77,678 |     55,750 |
| `merge.delete.random` |     62,265 |     18,686 |      1,597 |
| `merge.set.new`       |    371,761 |    341,584 |    191,302 |
| `merge.identical`     |  1,169,808 |  1,329,547 |    909,904 |
| `snapshot`            |  1,462,363 |  2,020,063 |  1,385,094 |
| `toJSON`              |  4,198,127 |  4,442,911 |  3,865,387 |
| `construct`           |    115,074 |     13,528 |        645 |
| `destroy`             |  2,065,519 |    630,094 |    243,710 |
| `addEventListener`    |  6,201,929 |  5,883,101 |  3,975,989 |
| `removeEventListener` | 13,514,659 | 12,797,504 |  9,503,572 |
| `dispatchEvent`       |  3,019,574 |  2,828,630 |  2,558,490 |
| `toStringTag`         | 77,019,645 | 73,188,068 | 69,341,360 |
| `inspect.node`        |     80,196 |      7,194 |        474 |
| `inspect.deno`        |     73,789 |      7,434 |        495 |

<!-- END GENERATED:map:benchmarks -->

### Tests

<!-- BEGIN GENERATED:map:tests -->

2026-10-20 · **passed**

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      8 |      1 |       0 |
| convergence |     10 |      0 |       0 |
| equivelance |    135 |      0 |       0 |
| events      |     66 |      0 |       0 |
| integration |      4 |      2 |       0 |
| unit        |     95 |      0 |       0 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime      | Version      | Status |
| ------------ | ------------ | ------ |
| Node.js ESM  | v24.16.0     | passed |
| Node.js CJS  | v24.16.0     | passed |
| Bun          | 1.4.3        | passed |
| Deno         | 2.9.6        | passed |
| Edge Runtime | 4.0.1        | passed |
| workerd      | 1.20261006.1 | passed |
| Chromium     | 156.0.8078.4 | passed |
| Firefox      | —            | failed |
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

2026-10-20 · ops/sec

Node v24.16.0 · win32 x64 · Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz · Sequencer 1.1.1

| Operation        |        100 |      1,000 |     10,000 |
| ---------------- | ---------: | ---------: | ---------: |
| `length`         | 37,408,810 | 25,071,824 | 34,043,418 |
| `read`           |    549,931 |     40,203 |      5,782 |
| `iterate`        |    106,831 |      3,165 |        589 |
| `insert.head`    |    439,975 |    688,054 |    288,583 |
| `insert.middle`  |    366,061 |    641,507 |    485,393 |
| `insert.tail`    |    700,030 |    707,272 |    570,646 |
| `remove.middle`  |    583,811 |    415,678 |    401,142 |
| `replace.middle` |    357,634 |    284,990 |    264,359 |
| `apply.insert`   |    555,286 |    554,510 |    460,970 |
| `merge.insert`   |     29,858 |     41,471 |     11,182 |
| `snapshot`       |    472,198 |     79,791 |     10,859 |

<!-- END GENERATED:text:benchmarks -->

### Tests

<!-- BEGIN GENERATED:text:tests -->

2026-10-20 · **passed**

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      8 |      1 |       0 |
| convergence |      8 |      0 |       0 |
| equivelance |     66 |      0 |       0 |
| events      |     34 |      0 |       0 |
| integration |      4 |      2 |       0 |
| unit        |     35 |      0 |       0 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime      | Version      | Status |
| ------------ | ------------ | ------ |
| Node.js ESM  | v24.16.0     | passed |
| Node.js CJS  | v24.16.0     | passed |
| Bun          | 1.4.3        | passed |
| Deno         | 2.9.6        | passed |
| Edge Runtime | 4.0.1        | passed |
| workerd      | 1.20261006.1 | passed |
| Chromium     | 156.0.8078.4 | passed |
| Firefox      | —            | failed |
| WebKit       | 27.2         | passed |

<!-- END GENERATED:text:tests -->

## License

Apache-2.0
