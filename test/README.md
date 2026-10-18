# Tests

Tests run against TypeScript source. Like the sibling `sequencer` repository,
scenario folders contain `test.ts` and shared fixtures live in `.shared`.

| Suite                                            | Scope                                                    | Command               |
| ------------------------------------------------ | -------------------------------------------------------- | --------------------- |
| [Array equivalence](equivelance/array/README.md) | Native Array method contract, CRDT extensions and events | `npm run test:array`  |
| Unit / integration                               | Existing `*.test.ts` suites                              | `npm run test:vitest` |

`npm run test:array` disables coverage for the targeted suite. The full
`test:vitest` command retains the repository's existing 100% coverage thresholds.
`npm run typecheck:array` checks the new test and benchmark harness independently
of the unfinished implementation. `npm run typecheck` also checks existing tests
and the source they import.
