# Sequencer 1.0.1 audit

Consolidated report: [sequencer issue #5](https://github.com/sovereignbase/sequencer/issues/5).

The scenarios use Projection directly, without SequencedArray. No core fixes or
test skips are included.

```powershell
# Nine reduced, self-contained reproductions, isolated in separate Workers:
node test/audit/sequencer/repro.mjs
node test/audit/sequencer/repro.mjs merge-splices --details

# Full deterministic matrix: 128 seeds across eight variants:
node test/audit/sequencer/run.mjs --seeds 128

# A single original scenario:
node test/audit/sequencer/run.mjs --variant live-compact --seed 67
```

Variants cover immediate delivery, compaction, mid-history hydration, ordered,
reversed and shuffled offline delivery, duplicates, and three/five-peer snapshot
merges. Checks include local Array models, consumer splices, indexed/range/bulk
reads, length, convergence and structured/JSON snapshot roundtrips. A broken
consumer view is reset after recording its failure so later packets can be
checked independently. Native execution is bounded by a five-second Worker timeout.

The existing sequencer suite passed 184 tests. The additional matrix executed
2,545,617 checks over 1,024 histories; 584 histories failed. Nine reduced cases
were also verified in Chromium. These are failing contracts, not a claim that
every assertion corresponds to a separate root cause or that a finite audit
exhausts every possible history.

JSON results live under `benchmark/.results/sequencer-audit-*.json`.
`minimize.mjs` reduces recorded histories; `repro.mjs` includes the reduced
fixtures and can be copied into another project with sequencer 1.0.1 installed.
