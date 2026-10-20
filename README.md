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

#### Errorss

| Code                        | Meaning                                                 |
| --------------------------- | ------------------------------------------------------- |
| `INVALID_ARRAY_LENGTH`      | The requested length is not a valid array length.       |
| `ARRAY_INDEX_OUT_OF_BOUNDS` | `set` or `delete` does not address an existing element. |
| `INVALID_CALLBACK`          | A callback is not callable.                             |
| `REDUCE_EMPTY_ARRAY`        | Reduction of an empty array without an initial value.   |

### Benchmarks

<!-- BEGIN GENERATED:array:benchmarks -->

Latest run: 2026-10-20T08:48:26.986Z. Status: **passed**.

Node v24.16.0; win32 x64; Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz.
Sequencer 1.0.2.

Throughput is measured in **ops/sec per API call**. Iterators are consumed completely. Fixture setup, validation and cleanup are outside timing.
Batch: 32; measurement budget: 20 ms per variant/case. Measured selection: complete.

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

— means unmeasured or no equivalent API. RME, sample counts and full metadata are saved locally in `benchmark/.results/`.

<!-- END GENERATED:array:benchmarks -->

### Tests

Native Array is the oracle for local method behavior. The suites cover mutations, reads, callbacks, live iterators, public types, events, replication and convergence with registered participants.

<!-- BEGIN GENERATED:array:tests -->

Latest Vitest run: 2026-10-20T08:46:51.653Z. Status: **passed**.
Node v24.16.0; win32 x64. 9 test files; 355 passed, 0 failed, 0 skipped.

| Test suite                                                            | Passed | Failed | Skipped | Status | Duration (s) |
| --------------------------------------------------------------------- | -----: | -----: | ------: | ------ | -----------: |
| [benchmark](test/array/benchmark/test.ts)                             |     43 |      0 |       0 | passed |         0.06 |
| [convergence](test/array/convergence/test.ts)                         |      8 |      0 |       0 | passed |         0.05 |
| [equivelance/api](test/array/equivelance/api/test.ts)                 |     52 |      0 |       0 | passed |         0.02 |
| [equivelance/callbacks](test/array/equivelance/callbacks/test.ts)     |     38 |      0 |       0 | passed |         0.02 |
| [equivelance/mutations](test/array/equivelance/mutations/test.ts)     |    105 |      0 |       0 | passed |         0.10 |
| [equivelance/reads](test/array/equivelance/reads/test.ts)             |     76 |      0 |       0 | passed |         0.07 |
| [equivelance/regressions](test/array/equivelance/regressions/test.ts) |      9 |      0 |       0 | passed |         0.02 |
| [equivelance/types](test/array/equivelance/types/test.ts)             |      2 |      0 |       0 | passed |         0.01 |
| [events](test/array/events/test.ts)                                   |     22 |      0 |       0 | passed |         0.03 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime                       | Version      | Status | Passed | Failed | Skipped | Checked (UTC)            |
| ----------------------------- | ------------ | ------ | -----: | -----: | ------: | ------------------------ |
| Node.js (Vitest source tests) | v24.16.0     | passed |    355 |      0 |       0 | 2026-10-20T08:46:51.653Z |
| Chromium browser window       | 156.0.8078.4 | passed |      1 |      0 |       0 | 2026-10-20T08:47:21.280Z |
| Firefox browser window        | 153.0        | passed |      1 |      0 |       0 | 2026-10-20T08:47:21.281Z |
| WebKit browser window         | 27.2         | passed |      1 |      0 |       0 | 2026-10-20T08:47:21.281Z |

Only executed runtimes are marked as verified. Browser checks import the built ESM package and test editing, events and replication. Counts describe the latest selection; other model sections retain their own latest run.

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
Local operations follow native Map behavior. Concurrent duplicate keys resolve by Projection order.

#### Errors

| Code                | Meaning                                        |
| ------------------- | ---------------------------------------------- |
| `INVALID_MAP_KEY`   | A key is neither a string nor a finite number. |
| `INVALID_MAP_ENTRY` | An entry is not a `[key, value]` pair.         |
| `INVALID_CALLBACK`  | The `forEach` callback is not callable.        |

### Benchmarks

<!-- BEGIN GENERATED:map:benchmarks -->

Latest run: 2026-10-20T08:50:21.571Z. Status: **passed**.

Node v24.16.0; win32 x64; Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz.
Sequencer 1.0.2.

Throughput is measured in **ops/sec per API call**. Iterators are consumed completely. Fixture setup, validation and cleanup are outside timing.
Batch: 32; measurement budget: 20 ms per variant/case. Measured selection: complete.

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

— means unmeasured or no equivalent API. RME, sample counts and full metadata are saved locally in `benchmark/.results/`.

<!-- END GENERATED:map:benchmarks -->

### Tests

Native Map is the oracle for local methods, key identity and iteration order.
The suites also cover JSON keys, incremental patches, change events, first-entry conflict resolution and model convergence.

<!-- BEGIN GENERATED:map:tests -->

Latest Vitest run: 2026-10-20T08:46:51.665Z. Status: **passed**.
Node v24.16.0; win32 x64. 6 test files; 275 passed, 0 failed, 0 skipped.

| Test suite                                                | Passed | Failed | Skipped | Status | Duration (s) |
| --------------------------------------------------------- | -----: | -----: | ------: | ------ | -----------: |
| [benchmark](test/map/benchmark/test.ts)                   |     94 |      0 |       0 | passed |         0.28 |
| [convergence](test/map/convergence/test.ts)               |     10 |      0 |       0 | passed |         0.06 |
| [equivelance](test/map/equivelance/test.ts)               |    135 |      0 |       0 | passed |         0.18 |
| [events/incremental](test/map/events/incremental/test.ts) |     16 |      0 |       0 | passed |         0.49 |
| [events](test/map/events/test.ts)                         |     19 |      0 |       0 | passed |         0.03 |
| [types](test/map/types/test.ts)                           |      1 |      0 |       0 | passed |         0.01 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime                       | Version      | Status | Passed | Failed | Skipped | Checked (UTC)            |
| ----------------------------- | ------------ | ------ | -----: | -----: | ------: | ------------------------ |
| Node.js (Vitest source tests) | v24.16.0     | passed |    275 |      0 |       0 | 2026-10-20T08:46:51.665Z |
| Chromium browser window       | 156.0.8078.4 | passed |      1 |      0 |       0 | 2026-10-20T08:47:21.281Z |
| Firefox browser window        | 153.0        | passed |      1 |      0 |       0 | 2026-10-20T08:47:21.281Z |
| WebKit browser window         | 27.2         | passed |      1 |      0 |       0 | 2026-10-20T08:47:21.281Z |

Only executed runtimes are marked as verified. Browser checks import the built ESM package and test editing, events and replication. Counts describe the latest selection; other model sections retain their own latest run.

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

Text currently creates no wrapper-specific validation errors.
Sequencer and platform errors propagate with their original types and codes.

### Benchmarks

<!-- BEGIN GENERATED:text:benchmarks -->

Latest run: 2026-10-20T08:50:40.299Z. Status: **passed**.

Node v24.16.0; win32 x64; Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz.
Sequencer 1.0.2.

Throughput is measured in **ops/sec per API call**. Iterators are consumed completely. Fixture setup, validation and cleanup are outside timing.
Batch: 32; measurement budget: 20 ms per variant/case. Measured selection: complete.

| Operation        |        100 |      1,000 |     10,000 |
| ---------------- | ---------: | ---------: | ---------: |
| `length`         | 55,165,848 | 45,348,586 | 41,587,760 |
| `read`           |    634,728 |     72,498 |      8,079 |
| `iterate`        |    133,286 |     14,701 |      1,526 |
| `insert.head`    |    781,833 |    848,514 |    810,321 |
| `insert.middle`  |    856,303 |    785,584 |    943,363 |
| `insert.tail`    |    789,969 |    919,122 |    650,968 |
| `remove.middle`  |    247,958 |    522,787 |    555,633 |
| `replace.middle` |    391,759 |    281,665 |    293,702 |
| `apply.insert`   |    581,862 |    625,453 |    727,876 |
| `merge.insert`   |     79,044 |     60,045 |     10,663 |
| `snapshot`       |    555,431 |     76,557 |      9,727 |

— means unmeasured or no equivalent API. RME, sample counts and full metadata are saved locally in `benchmark/.results/`.

<!-- END GENERATED:text:benchmarks -->

### Tests

Editing is compared with string slicing and insertion, including typing, paste, deletion, selections, Unicode and seeded histories.
The suites also check public types, events, change-driven rendering and model convergence.

<!-- BEGIN GENERATED:text:tests -->

Latest Vitest run: 2026-10-20T08:46:51.676Z. Status: **passed**.
Node v24.16.0; win32 x64. 6 test files; 125 passed, 0 failed, 0 skipped.

| Test suite                                                   | Passed | Failed | Skipped | Status | Duration (s) |
| ------------------------------------------------------------ | -----: | -----: | ------: | ------ | -----------: |
| [benchmark](test/text/benchmark/test.ts)                     |     34 |      0 |       0 | passed |         0.05 |
| [convergence](test/text/convergence/test.ts)                 |      8 |      0 |       0 | passed |         0.04 |
| [equivelance/api](test/text/equivelance/api/test.ts)         |      6 |      0 |       0 | passed |         0.02 |
| [equivelance/editing](test/text/equivelance/editing/test.ts) |     60 |      0 |       0 | passed |         0.36 |
| [events](test/text/events/test.ts)                           |     16 |      0 |       0 | passed |         0.02 |
| [types](test/text/types/test.ts)                             |      1 |      0 |       0 | passed |         0.01 |

| Statements | Branches | Functions | Lines |
| ---------: | -------: | --------: | ----: |
|       100% |     100% |      100% |  100% |

#### Compatibility

| Runtime                       | Version      | Status | Passed | Failed | Skipped | Checked (UTC)            |
| ----------------------------- | ------------ | ------ | -----: | -----: | ------: | ------------------------ |
| Node.js (Vitest source tests) | v24.16.0     | passed |    125 |      0 |       0 | 2026-10-20T08:46:51.676Z |
| Chromium browser window       | 156.0.8078.4 | passed |      1 |      0 |       0 | 2026-10-20T08:47:21.281Z |
| Firefox browser window        | 153.0        | passed |      1 |      0 |       0 | 2026-10-20T08:47:21.281Z |
| WebKit browser window         | 27.2         | passed |      1 |      0 |       0 | 2026-10-20T08:47:21.281Z |

Only executed runtimes are marked as verified. Browser checks import the built ESM package and test editing, events and replication. Counts describe the latest selection; other model sections retain their own latest run.

<!-- END GENERATED:text:tests -->

## License

Apache-2.0
