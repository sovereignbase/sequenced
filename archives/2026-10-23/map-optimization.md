# Map optimization

Implemented the previously measured Map optimizations in `src/SequencedMap/class.ts`:

- Removed the persistent duplicate-count Map. The physical key array and first-position index already contain this information.
- Promote surviving duplicate entries during the existing index-shift traversal. No index rebuild or additional persistent bookkeeping.
- Local deletion locates further copies with native `indexOf` and allocates a combined delta only when multiple entries are removed.
- Removed the full-footage `validEntries` / `allowMissing` scans before `apply` and `merge`, leaving Sequencer's transport validation to Sequencer.

Local Map behavior, first-entry conflict resolution, event payloads and convergence are preserved. Replication inputs remain `unknown`.

## Previous measurements — 2026-10-20

Node v24.16.0, Sequencer 1.1.1, Windows x64, Intel i5-10210U. Three complete baseline and candidate runs with `BENCH_TIME=20 npm run bench`, sizes 100, 1,000 and 10,000. All 474 implementation rows were compared, including plain Sequencer. Suspected regressions were checked with five alternating baseline/candidate pairs and did not reproduce.

| Measurement                            |           Before |           After |
| -------------------------------------- | ---------------: | --------------: |
| `delete.random`, 10,000 entries        |      5,162 ops/s |     5,708 ops/s |
| `apply.delete.random`, 1,000 entries   |     13,775 ops/s |    21,327 ops/s |
| `merge.set.random`, 10,000 entries     |     14,808 ops/s |    79,211 ops/s |
| `merge.identical`, 10,000 entries      |     22,749 ops/s | 1,411,558 ops/s |
| Retained heap, duplicate-heavy fixture | 12,944,696 bytes | 7,439,016 bytes |
| ESM JavaScript                         |     30,996 bytes |    30,380 bytes |
| Gzip                                   |      6,927 bytes |     6,816 bytes |
| Brotli                                 |      5,987 bytes |     5,876 bytes |

Throughput values are three-run medians for the observed wrapper. Removing full-footage scans accounts for the large merge improvement; removing duplicate bookkeeping accounts for the retained-heap reduction. The heap fixture retained 24 Maps with 5,000 logical keys and two physical copies per key; its 42.5% reduction is specific to that fixture. Five matched targeted runs also reduced tail-winner promotion latency from 413,454 to 351,885 ns/op; small deletion timing differences remained within noise.

An early version called Projection removals inside the key-compaction loop and slowed ordinary deletion; it was rejected. An early winner-promotion version changed iteration order; it was also rejected. The retained implementation keeps removals before compaction and uses a transient missing-index marker during patch processing.

Current verification: package build, TypeScript checks and all 888 tests pass; statements, branches, functions and lines have 100% source coverage. The throughput and memory figures above are the previous measurements, not a new benchmark run.
