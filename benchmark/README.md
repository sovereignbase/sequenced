# SequencedArray benchmarks

```powershell
npm run bench:array
# npm run bench is an alias for the same suite.
```

The Vitest TypeScript benchmark compares the installed
`@sovereignbase/sequencer` package's `Projection` with the local SequencedArray
source at initial lengths 100, 1,000 and 10,000:

| Variant             | Measured behavior                                             |
| ------------------- | ------------------------------------------------------------- |
| `plain`             | Direct Projection operations without wrapper events           |
| `wrapper`           | SequencedArray calls without registered listeners             |
| `wrapper+listeners` | Same calls with delta/change listeners consuming event detail |

Cases cover length, middle reads, materialized values, a 16-value slice, append,
prepend, middle splice/replace/delete, fresh remote apply/merge and replication
snapshot export. Identical adapter indirection is present on both sides.
`values` consumes the wrapper's iterator into an array to match Projection's
materialized result. Snapshot compares `Projection.sequence()` with
`SequencedArray.toJSON()` and includes any JSON-metadata normalization in the
wrapper. This case does not measure `JSON.stringify`.

Each sample batches 32 API calls to reduce timer overhead. Each mutating sample
starts from a fresh hydration of the same snapshot; read cases reuse an unchanged
fixture within each warmup/measured phase. Snapshot construction, hydration,
payload allocation, remote gossip/snapshot generation, result verification and
cleanup are outside the timed region. Apply/merge cases use distinct sequential
updates from a second actor, rather than replaying one duplicate update. Every
mutating sample, including warmup, verifies the final values against a native-array
model. Read cases verify state and their last result after each phase, outside timing.

Vitest's console comparison measures **batches** per second. Generated
`benchmark/.results/array.json` and `array.md` normalize latency/throughput to
individual API calls and include the wrapper/plain latency ratio:
`1.20` means the wrapper takes 20% longer. JSON also includes environment,
configuration, sample counts, relative margin of error and a completeness flag.
Reports describe the latest run and are ignored by Git. A failed initial import
removes previous reports; partial runs are marked incomplete.

Measurements run serially with coverage disabled, with warmup before each case.
No performance threshold is asserted. Wrapper disposal releases JS references
for Projection's finalizer because the current wrapper has no public destroy
method. Plain fixtures explicitly destroy their Projection outside timing.
This is a throughput comparison; GC interference and very short operation
timings still require interpreting the reported uncertainty. It is not a memory
benchmark.

To run only the baseline while SequencedArray is unfinished:

```powershell
$env:BENCH_IMPLEMENTATIONS = 'plain'
npm run bench:array
Remove-Item Env:BENCH_IMPLEMENTATIONS
```

To make a short, focused comparison:

```powershell
$env:BENCH_SIZES = '100,1000'
$env:BENCH_OPERATIONS = 'push,set.middle,apply.insert'
$env:BENCH_TIME = '100'
npm run bench:array
Remove-Item Env:BENCH_SIZES,Env:BENCH_OPERATIONS,Env:BENCH_TIME
```

| Variable                | Default                           | Meaning                                                      |
| ----------------------- | --------------------------------- | ------------------------------------------------------------ |
| `BENCH_IMPLEMENTATIONS` | `plain,wrapper,wrapper+listeners` | Comma-separated implementations                              |
| `BENCH_SIZES`           | `100,1000,10000`                  | Positive initial visible lengths                             |
| `BENCH_OPERATIONS`      | All cases in `array/workloads.ts` | Comma-separated cases                                        |
| `BENCH_BATCH`           | `32`                              | Calls per sample, at most the smallest size                  |
| `BENCH_TIME`            | `100`                             | Measured time budget per implementation/case in milliseconds |

The default wrapper comparison currently fails when loading the unfinished
SequencedArray source. The plain-only command remains runnable; the benchmark
never substitutes a baseline for a missing wrapper. No wrapper overhead number
can be reported until its implementation loads and passes workload validation.
