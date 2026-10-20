# Tests

Array and Text have separate suites under `test/array` and `test/text`.
Scenario folders contain `test.ts`; browser checks use `*.spec.ts`.

| Command                                      | Scope                                                             |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `npm test`                                   | Package and docs build, TypeScript, coverage, then browser checks |
| `npm run test:array`                         | [Array suite](array/README.md), without coverage                  |
| `npm run test:text`                          | [Text suite](text/README.md), without coverage                    |
| `npm run test:vitest`                        | Both suites with 100% statements, branches, functions and lines   |
| `npm run typecheck`                          | Both implementations, their tests and benchmarks                  |
| `npm run typecheck:array` / `typecheck:text` | One model and its benchmark                                       |
| `npm run test:e2e`                           | Built ESM package in Chromium, Firefox and WebKit                 |
| `npm run bench`                              | [Both benchmark suites](../benchmark/README.md)                   |

Coverage measures the published Array/Text implementations and package entry.
The existing Struct tests are retained once under `test/struct`; they are outside
these two suites. No unfinished model implementation is needed to run them.

Equivalence tests use the real installed Sequencer and local wrapper source.
Array results come from native arrays. Text edits come from string slices at
UTF-16 offsets, using only the current Text methods. Engine-boundary tests use
spies to verify forwarding and event conversion independently of engine policy.

Convergence tests use the shared [transport](.shared/replication.ts): all active
Actors are registered with Actor-only acknowledgements before removals. Sender
histories retain FIFO order; senders can interleave and packets can duplicate.
Pending histories are delivered before their acknowledgement replies. Checkpoint
continuation hydrates every editor from the same completed checkpoint and does
not replay gossip from the discarded coordinate space. These are Array/Text
model tests, not assertions about internal masks or compaction layout.

Use Node 24 or later with ES2024 Array methods. Before browser checks on a new
machine, run `npx playwright install chromium firefox webkit`. `npm test` builds
the browser package first; direct `test:e2e` expects `dist` to have been built.

`PLAYWRIGHT_FIREFOX_EXECUTABLE` can select an already installed Playwright Firefox
binary when testing locally; by default Playwright uses its matching download.
