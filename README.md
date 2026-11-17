[![npm version](https://img.shields.io/npm/v/@sovereignbase/sequenced)](https://www.npmjs.com/package/@sovereignbase/sequenced)
[![JSR](https://jsr.io/badges/@sovereignbase/sequenced)](https://jsr.io/@sovereignbase/sequenced)
[![CI](https://github.com/sovereignbase/sequenced/actions/workflows/ci.yaml/badge.svg?branch=master)](https://github.com/sovereignbase/sequenced/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/sovereignbase/sequenced/branch/master/graph/badge.svg)](https://codecov.io/gh/sovereignbase/sequenced)
[![license](https://img.shields.io/npm/l/@sovereignbase/sequenced)](LICENSE)

# Sequenced

Work in progress...

Replicated Array, Map, Register and Text implementations built on [Sequencer](https://github.com/sovereignbase/sequencer).

## Contents

- [Array](#array)
  - [Usage](#usage) · [Errors](#errors) · [Benchmarks](#benchmarks) · [Tests](#tests)
- [Map](#map)
  - [Usage](#usage-1) · [Errors](#errors-1) · [Benchmarks](#benchmarks-1) · [Tests](#tests-1)
- [Register](#register)
  - [Usage](#usage-2) · [Errors](#errors-2) · [Benchmarks](#benchmarks-2) · [Tests](#tests-2)
- [Set](#set)
  - [Usage](#usage-2) · [Errors](#errors-2) · [Benchmarks](#benchmarks-2) · [Tests](#tests-2)
- [Struct](#struct)
  - [Usage](#usage-2) · [Errors](#errors-2) · [Benchmarks](#benchmarks-2) · [Tests](#tests-2)
- [Text](#text)
  - [Usage](#usage-2) · [Errors](#errors-2) · [Benchmarks](#benchmarks-2) · [Tests](#tests-2)
- [Tuple](#tuple)
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

2026-11-14 · ops/sec

Node v24.22.1 · win32 x64 · 11th Gen Intel(R) Core(TM) i7-1185G7 @ 3.00GHz · Sequencer 1.2.6

| Operation             |        100 |      1,000 |     10,000 |
| --------------------- | ---------: | ---------: | ---------: |
| `length`              | 98,704,597 | 84,003,540 | 78,221,618 |
| `at.random`           | 38,197,636 | 40,380,598 | 36,577,234 |
| `get.random`          | 37,192,670 | 39,684,813 | 35,332,093 |
| `values`              |    253,474 |     26,579 |      2,666 |
| `slice.all`           |  8,403,879 |  1,473,556 |    362,152 |
| `slice.random`        | 14,616,796 | 15,449,214 | 14,672,133 |
| `push`                |  2,749,953 |  3,084,919 |  2,824,470 |
| `unshift`             |  2,242,852 |  2,217,423 |  2,038,033 |
| `splice.random`       |    886,023 |    940,617 |    760,326 |
| `set.random`          |    938,234 |  1,029,983 |    842,581 |
| `delete.random`       |  1,327,708 |  1,431,492 |  1,141,852 |
| `apply.insert.random` |  2,117,109 |  2,005,417 |  1,692,657 |
| `apply.set.random`    |    826,654 |    811,874 |    698,529 |
| `apply.delete.random` |  1,048,604 |    942,372 |    849,477 |
| `merge.insert.random` |    227,773 |    235,591 |    168,697 |
| `merge.set.random`    |    113,004 |    108,081 |     84,975 |
| `merge.delete.random` |    187,324 |    157,643 |    123,475 |
| `merge.identical`     |  2,098,146 |  2,164,497 |  2,021,359 |
| `snapshot`            |  5,046,274 |  5,112,577 |  4,965,332 |
| `toJSON`              |  9,843,324 | 11,504,047 | 11,375,431 |

<!-- END GENERATED:array:benchmarks -->

### Tests

<!-- BEGIN GENERATED:array:tests -->

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      — |      — |       — |
| convergence |      — |      — |       — |
| equivelance |      — |      — |       — |
| events      |      — |      — |       — |
| integration |      — |      — |       — |
| unit        |      — |      — |       — |

#### Compatibility

| Runtime      | Version | Status  |
| ------------ | ------- | ------- |
| Node.js ESM  | —       | not run |
| Node.js CJS  | —       | not run |
| Bun          | —       | not run |
| Deno         | —       | not run |
| Edge Runtime | —       | not run |
| workerd      | —       | not run |
| Chromium     | —       | not run |
| Firefox      | —       | not run |
| WebKit       | —       | not run |

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

2026-11-14 · ops/sec

Node v24.22.1 · win32 x64 · 11th Gen Intel(R) Core(TM) i7-1185G7 @ 3.00GHz · Sequencer 1.2.6

| Operation             |         100 |       1,000 |      10,000 |
| --------------------- | ----------: | ----------: | ----------: |
| `get.random`          |  33,352,766 |  26,800,796 |  21,148,694 |
| `has.random`          |  52,961,611 |  36,402,654 |  28,689,026 |
| `set.random`          |     642,496 |     479,808 |     453,586 |
| `delete.random`       |     637,714 |     503,527 |     475,884 |
| `apply.set.random`    |     543,571 |     432,901 |     362,620 |
| `apply.delete.random` |     541,172 |     435,900 |     366,294 |
| `set.new`             |   1,192,807 |     776,695 |     601,756 |
| `apply.set.new`       |   1,146,930 |     803,856 |     564,611 |
| `size`                | 125,392,973 | 130,704,293 | 114,469,828 |
| `clear`               |     321,534 |      76,335 |       8,177 |
| `keys`                |   5,301,764 |     538,766 |      51,900 |
| `values`              |     192,912 |      18,897 |       1,724 |
| `entries`             |     151,120 |      15,974 |       1,429 |
| `iterator`            |     159,559 |      17,409 |       1,432 |
| `forEach`             |     179,953 |      17,393 |       1,683 |
| `merge.set.random`    |     162,121 |     148,651 |     131,018 |
| `merge.delete.random` |     165,646 |     151,969 |     120,501 |
| `merge.set.new`       |     653,776 |     552,903 |     470,769 |
| `merge.identical`     |   2,288,067 |   2,351,600 |   2,412,547 |
| `snapshot`            |   2,929,647 |   3,182,918 |   3,187,690 |
| `toJSON`              |   9,940,859 |  10,400,352 |  10,890,655 |
| `construct`           |     224,860 |      27,283 |       1,309 |
| `destroy`             |   3,300,083 |   3,196,818 |     871,096 |
| `addEventListener`    |  10,972,471 |  11,200,592 |   9,018,118 |
| `removeEventListener` |  24,687,753 |  26,069,488 |  23,277,353 |
| `dispatchEvent`       |   4,450,243 |   4,532,995 |   4,020,358 |
| `toStringTag`         | 128,102,719 | 124,628,177 | 112,276,239 |
| `inspect.node`        |     127,774 |      11,942 |         795 |
| `inspect.deno`        |     131,683 |      11,562 |         821 |

<!-- END GENERATED:map:benchmarks -->

### Tests

<!-- BEGIN GENERATED:map:tests -->

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      — |      — |       — |
| convergence |      — |      — |       — |
| equivelance |      — |      — |       — |
| events      |      — |      — |       — |
| integration |      — |      — |       — |
| unit        |      — |      — |       — |

#### Compatibility

| Runtime      | Version | Status  |
| ------------ | ------- | ------- |
| Node.js ESM  | —       | not run |
| Node.js CJS  | —       | not run |
| Bun          | —       | not run |
| Deno         | —       | not run |
| Edge Runtime | —       | not run |
| workerd      | —       | not run |
| Chromium     | —       | not run |
| Firefox      | —       | not run |
| WebKit       | —       | not run |

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

2026-11-14 · ops/sec

Node v24.22.1 · win32 x64 · 11th Gen Intel(R) Core(TM) i7-1185G7 @ 3.00GHz · Sequencer 1.2.6

| Operation              |        100 |      1,000 |     10,000 |
| ---------------------- | ---------: | ---------: | ---------: |
| `length`               | 99,017,105 | 85,384,746 | 82,441,963 |
| `toString`             |  1,420,979 |    149,641 |     16,807 |
| `iterator`             |    218,086 |     23,624 |      2,194 |
| `insert.head`          |  1,232,134 |  1,250,306 |  1,205,574 |
| `insert.middle`        |  1,248,595 |  1,240,700 |  1,265,953 |
| `insert.tail`          |  1,350,798 |  1,428,122 |  1,414,812 |
| `insert.random`        |    973,572 |  1,125,050 |  1,157,439 |
| `remove.random`        |  1,067,818 |  1,026,492 |    815,437 |
| `replace.random`       |    636,444 |    728,613 |    683,628 |
| `apply.insert.random`  |  1,291,084 |  1,295,605 |  1,239,938 |
| `apply.remove.random`  |    838,283 |    825,575 |    696,573 |
| `apply.replace.random` |    611,638 |    595,300 |    567,022 |
| `merge.insert.random`  |    166,379 |    104,998 |     19,988 |
| `merge.remove.random`  |    179,535 |    155,469 |     76,373 |
| `merge.replace.random` |     95,362 |     58,579 |     18,003 |
| `merge.identical`      |  1,121,308 |    667,538 |    129,929 |
| `snapshot`             |  1,092,745 |    182,241 |     18,696 |
| `toJSON`               |  1,609,037 |    204,621 |     20,561 |

<!-- END GENERATED:text:benchmarks -->

### Tests

<!-- BEGIN GENERATED:text:tests -->

| Test suite  | Passed | Failed | Skipped |
| ----------- | -----: | -----: | ------: |
| compability |      — |      — |       — |
| convergence |      — |      — |       — |
| equivelance |      — |      — |       — |
| events      |      — |      — |       — |
| integration |      — |      — |       — |
| unit        |      — |      — |       — |

#### Compatibility

| Runtime      | Version | Status  |
| ------------ | ------- | ------- |
| Node.js ESM  | —       | not run |
| Node.js CJS  | —       | not run |
| Bun          | —       | not run |
| Deno         | —       | not run |
| Edge Runtime | —       | not run |
| workerd      | —       | not run |
| Chromium     | —       | not run |
| Firefox      | —       | not run |
| WebKit       | —       | not run |

<!-- END GENERATED:text:tests -->

## License

Apache-2.0
