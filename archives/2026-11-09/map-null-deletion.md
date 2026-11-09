# Map null-slot deletion

Ordinary deletion previously removed a physical entry and rewrote every following key index. It now replaces the entry with `null`. The wrapper's index work is constant time for unique keys, both locally and when receiving a one-slot replacement. Projection still performs the replicated edit. Duplicate deletion replaces every copy; duplicate resolution still selects the first physical entry.

Snapshots preserve null slots. Construction removes them and later duplicate keys while building the index in one pass. A single null-slot counter replaces repeated counting; no additional per-key structure or validation was introduced. Existing physical splice handling continues to update affected positions. Generated JavaScript confirms that ordinary deletion no longer traverses the suffix.

## Measurements

Windows x64, Intel Core i5-10210U, Node v24.16.0, Sequencer 1.1.1, Vitest 5.1.0; HP Optimized power plan. Three complete runs per revision with `BENCH_TIME=20 npm run bench`, sizes 100/1,000/10,000, batch 32, seed 0xc0ffee. All 591 implementation rows across Array, Map and Text were compared. Older-tooling runs were retained separately and excluded. Builds use tsdown 0.23.7 / Rolldown 1.3.1, ES2024, identical configuration.

Remote fixtures use each revision's real Map writer and its actual gossip or complete sequence. The unchanged plain local-delete reference uses null replacement. Setup, verification and disposal are outside timing. Figures below are complete calls/s, median [interquartile range]. The last column is Map throughput divided by plain Projection throughput for the same call.

| Call                  |   Keys |                    Before |                     After |   Ratio | Share of plain, before → after |
| --------------------- | -----: | ------------------------: | ------------------------: | ------: | -----------------------------: |
| `delete.random`       |    100 | 301,923 [269,670–303,166] | 204,218 [160,207–292,764] |   0.68× |                  50.5% → 23.9% |
| `apply.delete.random` |    100 | 143,709 [130,128–144,127] | 350,144 [288,271–351,723] |   2.44× |                  16.2% → 52.4% |
| `merge.delete.random` |    100 |    57,794 [57,601–59,762] |    84,418 [66,956–86,107] |   1.46× |                  45.0% → 92.6% |
| `delete.random`       |  1,000 |    40,456 [39,189–41,162] | 267,649 [239,270–294,405] |   6.62× |                   4.9% → 35.7% |
| `apply.delete.random` |  1,000 |    15,210 [14,689–15,524] | 175,234 [172,633–213,759] |  11.52× |                   1.9% → 52.2% |
| `merge.delete.random` |  1,000 |    13,992 [13,952–15,250] |    51,018 [40,173–61,575] |   3.65× |                  10.5% → 59.4% |
| `delete.random`       | 10,000 |       4,757 [4,497–4,880] | 245,723 [216,858–264,603] |  51.66× |                   1.0% → 52.1% |
| `apply.delete.random` | 10,000 |       1,568 [1,546–1,712] | 169,206 [148,967–176,942] | 107.92× |                   0.3% → 46.1% |
| `merge.delete.random` | 10,000 |       1,443 [1,327–1,511] |    66,866 [51,004–68,225] |  46.32× |                   1.2% → 84.1% |

### Matched checks

Five alternating baseline/candidate pairs rechecked the 80 flagged cases, plus 13 additional cases matched by the filter, using the same runner and 20 ms budget. Every selected case includes all supported implementations. No Map row was slower in all five matched pairs, but several medians remained lower and the distributions were wide; small differences remain inconclusive. The unchanged Text `insert.tail` case at 10,000 characters was 24.1% lower across these runs. A further five alternating control pairs using the identical Text implementation, import graph and working directory reversed that result: 389,650 → 685,481 calls/s, with individual paired changes from −10.4% to +150.5%. This demonstrates substantial timing instability in the short-budget checks. These controls do not establish broad performance improvements. The retained change is supported by the much larger deletion gains and the accepted storage/restoration costs; the small-map results are shown rather than omitted. Against plain Projection, Map won 9 and lost 66 comparable rows both before and after; unobserved Map won 12 → 14 of 75 comparable rows.

Separate complete-call checks use 32 unique seeded random keys, five warmup batches and 30 measured batches per process, with five alternating processes per revision. Latencies below are ns/call, median [interquartile range] at 10,000 keys.

| Call                  |                    Before |                  After |  Ratio |
| --------------------- | ------------------------: | ---------------------: | -----: |
| `delete.random`       | 225,509 [221,895–293,716] |  13,451 [5,448–13,884] | 16.77× |
| `apply.delete.random` | 678,891 [492,965–704,839] |   8,426 [7,759–29,880] | 80.57× |
| `merge.delete.random` | 607,707 [571,547–628,990] | 21,288 [17,412–44,687] | 28.55× |

## Retained state and restoration

Sixteen retained replicas start with 2,000 keys each, then delete every even key; 1,000 keys remain. Values come from the same immutable input. Separate Node processes use forced GC and five alternating runs per revision. Restoration includes constructor cleanup (three warmups, ten restores per process). Memory and snapshot figures are bytes; restoration is ns/instance. These measured storage and cold-path costs are accepted for the deletion improvement.

| Measurement        |    Before |     After |   Change |
| ------------------ | --------: | --------: | -------: |
| heapBytes          | 1,330,000 | 2,177,096 |   +63.7% |
| externalBytes      | 3,014,660 | 6,815,748 |  +126.1% |
| physicalSlots      |     1,000 |     2,000 |  +100.0% |
| snapshotJsonBytes  |    12,925 |    36,833 |  +185.0% |
| restoreNanoseconds |    90,570 | 1,863,700 | +1957.7% |

## Distributed output

Identical build and compression settings; byte counts. Package measurements use the same manifest, README and license for both revisions.

| Artifact             |  Before |   After |     Difference |
| -------------------- | ------: | ------: | -------------: |
| index.js, raw        |  26,080 |  26,500 |   +420 (+1.6%) |
| index.js, gzip       |   5,453 |   5,448 |     -5 (-0.1%) |
| index.js, brotli     |   4,715 |   4,702 |    -13 (-0.3%) |
| index.cjs, raw       |  26,348 |  26,768 |   +420 (+1.6%) |
| index.cjs, gzip      |   5,505 |   5,500 |     -5 (-0.1%) |
| index.cjs, brotli    |   4,763 |   4,738 |    -25 (-0.5%) |
| Package size         |  67,580 |  67,941 |   +361 (+0.5%) |
| Package unpackedSize | 336,610 | 339,086 | +2,476 (+0.7%) |

## Verification

Package build, API documentation generation, TypeScript checking and formatting pass. All 930 Vitest tests pass, including 310 Map tests. Map coverage is 100% for statements (248/248), branches (137/137), functions (27/27) and lines (221/221). The global 100% coverage gate fails: line coverage is 91.02%, with uncovered Register code and the Array/Text object-tag getters outside this change.

Node ESM/CJS, Bun, Deno, Edge Runtime and workerd checks pass for all three collections. All 18 Chromium/WebKit browser checks pass, including asynchronous P2P and WebSocket editing. The nine Firefox checks failed in the local browser environment; Firefox work was stopped at the user's request. These are not reported as successful checks.

Native Map behavior, first-entry duplicate winners, null insertion/replacement/removal patches, events, registered offline restoration and continued editing are covered. No Sequencer implementation or compaction contract was changed. Raw full-suite results, all-row differences, matched checks, memory measurements and build outputs are retained locally in `benchmark/.results/map-null-2026-11-09/`.
