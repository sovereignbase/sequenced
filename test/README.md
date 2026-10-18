# Tests

Tests run against TypeScript source. Like the sibling `sequencer` repository,
scenario folders contain `test.ts` and shared fixtures live in `.shared`.

| Suite                                            | Scope                                                    | Command               |
| ------------------------------------------------ | -------------------------------------------------------- | --------------------- |
| [Array equivalence](equivelance/array/README.md) | Native Array method contract, CRDT extensions and events | `npm run test:array`  |
| Unit / integration                               | Existing `*.test.ts` suites                              | `npm run test:vitest` |

`npm run test:array` disables coverage for the targeted suite. The full
`test:vitest` command retains the repository's existing 100% coverage thresholds.
`npm run typecheck:array` checks SequencedArray, its public declarations, the Array
tests and benchmark harness. `npm run typecheck` also checks existing tests and
their imported source; unfinished Map/Set/Struct scaffolds have independent errors.

The Array suite deliberately retains a failing offline regression for
[sequencer issue #2](https://github.com/sovereignbase/sequencer/issues/2).
