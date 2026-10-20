# Wrapper benchmarks

```powershell
npm run bench          # Array and Text, serially
npm run bench:array
npm run bench:text
```

Both Vitest TypeScript suites compare the installed Sequencer Projection with
local wrapper source at initial lengths 100, 1,000 and 10,000.

| Variant             | Measured calls                                        |
| ------------------- | ----------------------------------------------------- |
| `plain`             | Direct Projection operations                          |
| `wrapper`           | Wrapper without registered listeners                  |
| `wrapper+listeners` | Wrapper with change/delta listeners consuming details |

Array covers length, indexed reads, bulk slices, materialized iteration, append,
prepend, middle splice/set/delete, apply/merge and snapshot export. `slice.all`
compares bulk reads on both sides. `values` materializes the wrapper's live
iterator and compares it with Projection's bulk values; its ratio includes
iteration semantics as well as wrapper overhead.

Text covers length, full text reads, materialized code-unit iteration, insertion
at head/middle/tail, selection removal/replacement, apply/merge and snapshot
export. Plain edits receive prepared code units; Text receives strings and its
UTF-16 splitting is timed. Text snapshot/merge timings include conversion between
strings and raw Footage. Array snapshot export includes metadata normalization.
No case times JSON.stringify.

Both sides have the same adapter indirection and batch 32 API calls per sample.
Mutating samples hydrate fresh state; reads reuse unchanged state. Fixture
creation, native hydration, input preparation, assertions and cleanup run outside
timing. Apply/merge receive distinct sequential insertions, not duplicate no-ops.
All variants are checked against an independent Array/string model before the
benchmark is accepted. Tests also exercise each fixture twice from fresh state.

Reports are written to `benchmark/.results/array.json`, `array.md`, `text.json`
and `text.md`. They record environment, Sequencer version, configuration,
completeness, sample counts, RME, ns/call, calls/s and wrapper/plain latency ratio.
A ratio of 1.20 means 20% longer latency. Vitest's console reports batches/s;
files normalize to individual API calls. Partial runs are marked incomplete.

Measurements use warmup, disabled coverage and a single worker. Ratios have no
pass/fail threshold. Interpret short timings with their RME; this is not a memory
benchmark. Native state is released outside timing. Text's helper does so without
adding a public disposal method.

| Variable                | Default                           | Meaning                                             |
| ----------------------- | --------------------------------- | --------------------------------------------------- |
| `BENCH_IMPLEMENTATIONS` | `plain,wrapper,wrapper+listeners` | Variants                                            |
| `BENCH_SIZES`           | `100,1000,10000`                  | Initial visible lengths/code units                  |
| `BENCH_OPERATIONS`      | All cases                         | Cases in the selected model's workloads.ts          |
| `BENCH_BATCH`           | `32`                              | Calls per sample, no greater than the smallest size |
| `BENCH_TIME`            | `100`                             | Measurement budget per variant/case, milliseconds   |

For a focused comparison, select the model and its case names:

```powershell
$env:BENCH_SIZES = '100,1000'
$env:BENCH_OPERATIONS = 'insert.tail,replace.middle'
$env:BENCH_TIME = '250'
npm run bench:text
Remove-Item Env:BENCH_SIZES,Env:BENCH_OPERATIONS,Env:BENCH_TIME
```
