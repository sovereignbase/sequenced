[![npm version](https://img.shields.io/npm/v/@sovereignbase/sequenced)](https://www.npmjs.com/package/@sovereignbase/sequenced)
[![JSR](https://jsr.io/badges/@sovereignbase/sequenced)](https://jsr.io/@sovereignbase/sequenced)
[![CI](https://github.com/sovereignbase/sequenced/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/sovereignbase/sequenced/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/sovereignbase/sequenced/branch/master/graph/badge.svg)](https://codecov.io/gh/sovereignbase/sequenced)
[![license](https://img.shields.io/npm/l/@sovereignbase/sequenced)](LICENSE)

# Sequenced

Replicated Array, Map, Register and Text implementations built on [Sequencer](https://github.com/sovereignbase/sequencer).

## Contents

- [Array](#array)
  - [Usage](#usage) · [Errors](#errors) · [Benchmarks](#benchmarks) · [Tests](#tests)
- [Map](#map)
  - [Usage](#usage-1) · [Errors](#errors-1) · [Benchmarks](#benchmarks-1) · [Tests](#tests-1)
- [Register](#register)
  - [Usage](#usage-2) · [Errors](#errors-2) · [Benchmarks](#benchmarks-2) · [Tests](#tests-2)
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

Individual elements can be accessed with `get(index)`, updated with `set(index, value)`, and deleted with `delete(index)`.

Copying methods return standard JavaScript arrays `(Array<T>)`. Callbacks receive this `(SequencedArray<T>)` as their array argument.

Iterators use the current SequencedArray contents, including modifications made during iteration.

#### Errors

| Code                        | Meaning                                                 |
| --------------------------- | ------------------------------------------------------- |
| `INVALID_ARRAY_LENGTH`      | The requested length is not a valid array length.       |
| `ARRAY_INDEX_OUT_OF_BOUNDS` | `set` or `delete` does not address an existing element. |
| `INVALID_CALLBACK`          | A callback is not callable.                             |
| `REDUCE_EMPTY_ARRAY`        | Reduction of an empty array without an initial value.   |

### Benchmarks

<!-- BEGIN GENERATED:array:benchmarks -->

2026-11-09 · ops/sec

Node v24.16.0 · win32 x64 · Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz · Sequencer 1.1.1

| Operation             |        100 |      1,000 |     10,000 |
| --------------------- | ---------: | ---------: | ---------: |
| `length`              | 47,786,961 | 29,948,201 | 44,745,858 |
| `at.random`           | 17,576,370 | 20,524,800 | 22,746,290 |
| `get.random`          | 19,904,505 | 20,733,674 | 20,380,596 |
| `values`              |    139,992 |     16,188 |      1,547 |
| `slice.all`           |  2,654,214 |    895,624 |    113,585 |
| `slice.random`        |  4,653,562 |  7,021,944 |  6,594,310 |
| `push`                |  1,037,871 |  1,561,241 |  1,575,968 |
| `unshift`             |  1,302,172 |    918,723 |    965,787 |
| `splice.random`       |    564,648 |    492,500 |    502,791 |
| `set.random`          |    628,545 |    556,888 |    453,973 |
| `delete.random`       |    836,620 |    744,439 |    697,408 |
| `apply.insert.random` |  1,233,279 |  1,143,011 |  1,159,843 |
| `apply.set.random`    |    441,545 |    447,300 |    401,141 |
| `apply.delete.random` |    542,549 |    600,903 |    534,935 |
| `merge.insert.random` |    117,422 |    124,571 |     87,507 |
| `merge.set.random`    |     49,957 |     63,633 |     52,387 |
| `merge.delete.random` |     91,403 |     86,758 |     57,413 |
| `merge.identical`     |    820,542 |    866,191 |    840,658 |
| `snapshot`            |  1,903,505 |  2,443,859 |  2,104,232 |
| `toJSON`              |  2,979,185 |  4,765,566 |  4,515,536 |

<!-- END GENERATED:array:benchmarks -->

### Tests

<!-- BEGIN GENERATED:array:tests -->

2026-11-09 · **passed**

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      8 |      1 |       0 |
| convergence |      8 |      0 |       0 |
| equivelance |    280 |      0 |       0 |
| events      |     40 |      0 |       0 |
| integration |      4 |      2 |       0 |
| unit        |     66 |      0 |       0 |

| Statements | Branches | Functions |  Lines |
| ---------: | -------: | --------: | -----: |
|     99.56% |     100% |    98.70% | 99.52% |

#### Compatibility

| Runtime      | Version       | Status |
| ------------ | ------------- | ------ |
| Node.js ESM  | v24.16.0      | passed |
| Node.js CJS  | v24.16.0      | passed |
| Bun          | 1.4.4         | passed |
| Deno         | 2.9.6         | passed |
| Edge Runtime | 4.0.1         | passed |
| workerd      | 1.20261109.1  | passed |
| Chromium     | 158.0.8127.18 | passed |
| Firefox      | —             | failed |
| WebKit       | 27.2          | passed |

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

Keys can be strings or finite numbers. `Number(number)` and `String(number)` are distinct keys.

#### Errors

| Code                | Meaning                                        |
| ------------------- | ---------------------------------------------- |
| `INVALID_MAP_KEY`   | A key is neither a string nor a finite number. |
| `INVALID_MAP_ENTRY` | An entry is not a `[key, value]` pair.         |
| `INVALID_CALLBACK`  | The `forEach` callback is not callable.        |

### Benchmarks

<!-- BEGIN GENERATED:map:benchmarks -->

2026-11-09 · ops/sec

Node v24.16.0 · win32 x64 · Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz · Sequencer 1.1.1

| Operation             |        100 |      1,000 |     10,000 |
| --------------------- | ---------: | ---------: | ---------: |
| `get.random`          | 14,794,386 | 10,727,142 |  6,903,206 |
| `has.random`          | 26,212,538 |  7,703,037 | 10,038,049 |
| `set.random`          |    207,374 |    206,128 |    223,938 |
| `delete.random`       |    204,218 |    210,891 |    187,994 |
| `apply.set.random`    |    181,981 |     95,089 |    169,094 |
| `apply.delete.random` |    226,397 |    170,031 |    169,206 |
| `set.new`             |    469,794 |    351,970 |    292,561 |
| `apply.set.new`       |    504,651 |    355,603 |    303,857 |
| `size`                | 56,130,358 | 64,896,627 | 70,386,496 |
| `clear`               |     57,877 |     29,199 |      4,380 |
| `keys`                |  2,191,474 |    271,580 |     34,484 |
| `values`              |     61,648 |      9,387 |      1,432 |
| `entries`             |     52,289 |      8,848 |      1,022 |
| `iterator`            |     42,036 |     10,362 |      1,103 |
| `forEach`             |     77,711 |     10,493 |        968 |
| `merge.set.random`    |     35,316 |     64,534 |     56,443 |
| `merge.delete.random` |     49,495 |     51,018 |     35,142 |
| `merge.set.new`       |    156,740 |    290,539 |    260,880 |
| `merge.identical`     |    449,920 |  1,131,742 |  1,107,214 |
| `snapshot`            |    562,421 |  1,693,816 |  1,712,923 |
| `toJSON`              |  1,881,007 |  3,059,154 |  4,481,062 |
| `construct`           |     61,677 |     11,430 |        676 |
| `destroy`             |  1,167,444 |  1,040,378 |    149,882 |
| `addEventListener`    |  4,041,075 |  6,088,581 |  5,970,394 |
| `removeEventListener` | 11,622,838 | 11,476,169 | 12,819,136 |
| `dispatchEvent`       |  2,638,984 |  2,719,239 |  2,729,382 |
| `toStringTag`         | 57,997,530 | 67,795,200 | 67,317,727 |
| `inspect.node`        |      5,692 |      6,542 |        459 |
| `inspect.deno`        |     61,928 |      6,368 |        482 |

<!-- END GENERATED:map:benchmarks -->

### Tests

<!-- BEGIN GENERATED:map:tests -->

2026-11-09 · **passed**

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      8 |      1 |       0 |
| convergence |     16 |      0 |       0 |
| equivelance |    132 |      0 |       0 |
| events      |     61 |      0 |       0 |
| integration |      4 |      2 |       0 |
| unit        |     95 |      0 |       0 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime      | Version       | Status |
| ------------ | ------------- | ------ |
| Node.js ESM  | v24.16.0      | passed |
| Node.js CJS  | v24.16.0      | passed |
| Bun          | 1.4.4         | passed |
| Deno         | 2.9.6         | passed |
| Edge Runtime | 4.0.1         | passed |
| workerd      | 1.20261109.1  | passed |
| Chromium     | 158.0.8127.18 | passed |
| Firefox      | —             | failed |
| WebKit       | 27.2          | passed |

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

#### Errors

Sequencer errors are propagated unchanged.

### Benchmarks

<!-- BEGIN GENERATED:text:benchmarks -->

2026-11-09 · ops/sec

Node v24.16.0 · win32 x64 · Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz · Sequencer 1.1.1

| Operation              |        100 |      1,000 |     10,000 |
| ---------------------- | ---------: | ---------: | ---------: |
| `length`               | 35,574,711 | 52,361,891 | 56,766,581 |
| `toString`             |    674,408 |     85,870 |      8,564 |
| `iterator`             |     93,874 |     16,736 |      1,751 |
| `insert.head`          |    481,323 |    978,980 |    707,760 |
| `insert.middle`        |    701,681 |    936,238 |    963,094 |
| `insert.tail`          |    825,986 |  1,158,841 |    650,390 |
| `insert.random`        |    809,767 |    920,316 |    834,366 |
| `remove.random`        |    677,174 |    669,399 |    527,320 |
| `replace.random`       |    478,545 |    490,337 |    358,303 |
| `apply.insert.random`  |    861,215 |    805,659 |    844,471 |
| `apply.remove.random`  |    520,426 |    410,439 |    282,954 |
| `apply.replace.random` |    393,058 |    314,509 |    231,755 |
| `merge.insert.random`  |     98,958 |     58,367 |     10,882 |
| `merge.remove.random`  |    100,748 |     76,629 |     39,499 |
| `merge.replace.random` |     57,774 |     36,601 |      9,856 |
| `merge.identical`      |    698,045 |    349,723 |     52,795 |
| `snapshot`             |    610,650 |    109,992 |     10,364 |
| `toJSON`               |    868,205 |    116,103 |      8,347 |

<!-- END GENERATED:text:benchmarks -->

### Tests

<!-- BEGIN GENERATED:text:tests -->

2026-11-09 · **passed**

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      8 |      1 |       0 |
| convergence |      8 |      0 |       0 |
| equivelance |     66 |      0 |       0 |
| events      |     34 |      0 |       0 |
| integration |      4 |      2 |       0 |
| unit        |     59 |      0 |       0 |

| Statements | Branches | Functions |  Lines |
| ---------: | -------: | --------: | -----: |
|     98.64% |     100% |    95.45% | 98.50% |

#### Compatibility

| Runtime      | Version       | Status |
| ------------ | ------------- | ------ |
| Node.js ESM  | v24.16.0      | passed |
| Node.js CJS  | v24.16.0      | passed |
| Bun          | 1.4.4         | passed |
| Deno         | 2.9.6         | passed |
| Edge Runtime | 4.0.1         | passed |
| workerd      | 1.20261109.1  | passed |
| Chromium     | 158.0.8127.18 | passed |
| Firefox      | —             | failed |
| WebKit       | 27.2          | passed |

<!-- END GENERATED:text:tests -->

## License

Apache-2.0
