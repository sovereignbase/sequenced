# Benchmarks

```powershell
npm run bench
npm run bench:array
npm run bench:map
npm run bench:text
```

Array, Map and Text use the same runner in `benchmark/runner.ts`, comparing plain Sequencer with the local wrappers. Results are reported as API calls per second for sizes 100, 1,000 and 10,000.

Random operations use a seeded edit trace. Corresponding local, `apply.*.random` and `merge.*.random` cases use the same positions and edits. Merge receives a complete sequence after each edit; `merge.identical` measures merging unchanged state.

Mutations start from fresh state; reads reuse unchanged state. Fixture creation, input preparation, verification and cleanup are outside timing. Every workload checks its result against the native collection or text model. Text insertion includes UTF-16 splitting.

All models print throughput tables and write `benchmark/.results/<model>.json` with environment, configuration, sample counts, RME, ns/call, ops/sec and latency relative to plain Sequencer. README tables use the same results. Measurements run serially with warmup and coverage disabled.

| Variable                | Default                           | Meaning                                             |
| ----------------------- | --------------------------------- | --------------------------------------------------- |
| `BENCH_IMPLEMENTATIONS` | `plain,wrapper,wrapper+listeners` | Implementations                                     |
| `BENCH_SIZES`           | `100,1000,10000`                  | Initial collection sizes                            |
| `BENCH_OPERATIONS`      | All cases                         | Operations in the selected model                    |
| `BENCH_BATCH`           | `32`                              | Calls per sample                                    |
| `BENCH_TIME`            | `20`                              | Measurement budget per variant/case in milliseconds |
| `BENCH_SEED`            | `0xc0ffee`                        | Random seed                                         |

```powershell
$env:BENCH_OPERATIONS = 'insert.random,apply.insert.random,merge.insert.random'
npm run bench:text
Remove-Item Env:BENCH_OPERATIONS
```
