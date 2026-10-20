# Sequenced Optimization Skill

Use this skill when optimizing Sequenced runtime performance, memory use, bundle size, or generated JavaScript size.

## Objective

Optimize Sequenced as aggressively as possible while preserving its required semantics, convergence guarantees, correctness, representative workloads, benchmark integrity, documentation, and maintainability.

Priorities, in order:

1. **Preserve all required semantics and convergence guarantees.**
2. **Optimize runtime performance to the extreme.**
3. **Remove every operation, allocation, copy, branch, indirection, and state transition not required for correctness.**
4. **Simplify control flow and data flow to the extreme.**
5. **Minimize source code, generated JavaScript, and bundle size.**
6. **Maintain accurate documentation.**
7. **Find bottlenecks through runtime analysis and eliminate them.**

Performance is the primary optimization objective, but never knowingly break required semantics or convergence guarantees.

When uncertain whether behavior is semantically required:

- do not guess;
- do not silently remove it;
- identify the exact uncertainty;
- ask the user before proceeding.

Only make educated optimization attempts. Every optimization decision must be supported by reproducible measurements, profiling data, generated-code inspection, source-level reasoning, or another verifiable form of evidence.

---

## Initial Review

Before selecting an optimization target:

1. Read the current full benchmark table from `README.md` when it is available or has been supplied by the user.

2. Before modifying code for an optimization session, run the complete benchmark suite and retain a fresh full-suite baseline from the current checkout. Do not use the README table as a substitute for this baseline.

3. Treat the README benchmark table as historical and competitive context only. The fresh full-suite run is the regression baseline for every optimization attempted from that checkout.

4. Every retained optimization must be compared against the complete baseline suite, not only the benchmark rows expected to improve. Domain-specific changes can cause non-local regressions in apparently unrelated operations.

5. Review the relevant implementation under `src`.

6. Review relevant tests, benchmark implementations, package configuration, generated artifacts, and public interfaces.

7. Review previously attempted optimizations under:

   `C:\Users\jorts\sequenced\archives\optimizations`

8. Do not repeat an already documented failed optimization unless there is concrete evidence that a materially different implementation could succeed.

9. Identify the real hot path before changing code. Do not optimize a function merely because it appears theoretically inefficient.

---

## Optimization Scope

Optimization targets may include:

- execution time;
- throughput;
- latency;
- allocations;
- memory footprint;
- cache locality;
- branch count and predictability;
- instruction count;
- generated JavaScript size;
- final package or bundle size;
- compressed transfer size;
- initialization cost;
- unnecessary imports, exports, wrappers, or runtime machinery;
- unnecessary indirection;
- object-shape instability;
- avoidable garbage collection pressure;
- data layouts that create unnecessary copying or traversal;
- repeated searches, scans, lookups, or conversions;
- unnecessary iterator, array, object, closure, promise, or callback creation.

Prefer removing work entirely over making unnecessary work faster.

---

## Measurement Rules

Use targeted before-and-after measurements for every optimization attempt.

### Controlled Environment

Use the same:

- benchmark command;
- benchmark implementation;
- runtime and runtime version;
- machine;
- machine power state;
- background-process conditions;
- input data;
- random seeds when applicable;
- warm-up procedure;
- iteration count;
- run count;
- measurement method;
- competitor versions.

Do not change benchmark methodology between the baseline and candidate.

### Minimum Runs

Run both the baseline and candidate at least three times.

Retain the raw output from every run.

For very large, stable, and consistently one-sided differences, additional runs are not required merely as ceremony.

### Noisy Results

Consider a result noisy when variance is large enough that it could plausibly change the optimization decision.

When results are noisy, mixed, or close:

1. Run the baseline and candidate at least five times each.
2. Use the median as the primary result.
3. Report dispersion using standard deviation or interquartile range.
4. Inspect the distributions rather than relying only on averages.
5. Increase the run count when the distributions still overlap materially.
6. Never accept or reject a change based on one noisy run.

Use identical run counts for the baseline and candidate. When additional candidate runs are collected, collect the corresponding additional baseline runs.

### Full-Suite Regression Guard

A targeted benchmark is never sufficient to accept an optimization.

For every optimization candidate:

1. Run the complete benchmark suite against the baseline before the optimization when that fresh session baseline has not already been captured.
2. Run the complete benchmark suite against the candidate after the optimization.
3. Use the same benchmark implementation, runtime, machine, inputs, warm-up procedure, and measurement method.
4. Compare every benchmark row, including domains and operations that the optimization was not expected to affect.
5. Produce a complete before/after diff for the suite.
6. Investigate every apparent regression instead of assuming an unrelated benchmark cannot have been affected.
7. When an apparent regression is within noise, rerun that row or relevant suite subset using the noisy-result procedure until the decision is resolved.
8. Do not retain an optimization with a reproducible benchmark regression unless the user explicitly accepts a quantified tradeoff for a larger system-level benefit.

The full-suite baseline may be reused across multiple optimization hypotheses only while the baseline checkout, benchmark implementation, runtime, and environment remain unchanged. If any of those change, capture a new complete baseline.

### Mixed Results

When some affected benchmark rows improve and others regress, report for every affected row:

- baseline median;
- candidate median;
- dispersion;
- absolute difference;
- percentage change;
- fastest competitor;
- Sequenced’s position before and after;
- Sequenced-to-winner ratio before and after;
- percentage gap from the winner before and after.

Use profiling, generated-code inspection, or focused microbenchmarks when the cause of mixed results is unclear.

Do not hide regressions behind aggregate averages.

### Competitor Comparisons

Apply the same run count, environment, and statistical procedure when benchmarking external implementations.

Report:

- Sequenced’s before-to-after percentage change;
- fastest competing implementation;
- Sequenced-to-winner ratio before and after;
- percentage gap from the winner before and after;
- benchmark rows won before and after;
- benchmark rows lost before and after.

A reduction in Sequenced’s absolute execution time is not automatically sufficient.

Treat a change as worse when it:

- increases the relative gap to the winner;
- causes Sequenced to lose more rows in the target area;
- improves an artificial microbenchmark while degrading representative workloads;

unless the regression is justified by a documented semantic or system-level benefit.

---

## Bundle-Size Rules

Measure size whenever a change could affect generated output.

At minimum, measure all applicable artifacts:

- generated JavaScript;
- final distributed JavaScript bundle;
- package output;
- gzip-compressed output;
- Brotli-compressed output.

Use the exact same:

- runtime target;
- minifier;
- bundler;
- optimization settings;
- source-map configuration;
- compression settings.

Report:

- baseline bytes;
- candidate bytes;
- absolute byte difference;
- percentage difference;
- compressed-size difference;
- which symbols, functions, imports, exports, wrappers, or runtime features caused the difference when identifiable.

Inspect generated output when size unexpectedly changes.

Prefer changes that improve both runtime performance and artifact size.

A size regression may be accepted only when:

- the runtime or memory improvement is reproducible and meaningful;
- the size cost is explicitly quantified;
- no smaller implementation provides the same benefit;
- the tradeoff is documented.

Do not increase code or bundle size for speculative performance.

Remove unused:

- exports;
- imports;
- wrappers;
- helper layers;
- duplicated branches;
- runtime checks already guaranteed by internal invariants;
- compatibility machinery not required by supported environments;
- metadata;
- dead code.

Never remove externally required validation or compatibility behavior merely to reduce bytes.

---

## Optimization Loop

Work iteratively. Handle one concrete optimization hypothesis at a time.

### 1. Select a Target

Choose one specific target that:

- is supported by benchmark, profiling, allocation, memory, cache, branch, generated-code, bundle-size, or runtime evidence;
- is not already documented as an equivalent attempted implementation; or
- could improve on a documented attempt through a materially different implementation.

Do not optimize code merely because it looks inefficient.

### 2. Form a Hypothesis

Document:

- the suspected bottleneck;
- the evidence that it exists;
- the proposed cause;
- why the proposed change could improve it;
- which benchmark rows or artifacts should be affected;
- which semantics, invariants, workloads, or interfaces could be at risk;
- the expected runtime, memory, and size effects.

The hypothesis must be falsifiable.

### 3. Plan the Smallest Safe Change

Prefer the smallest change capable of testing the hypothesis.

Avoid combining unrelated optimizations. Each benchmark result must be attributable to a specific change.

Before adding machinery, determine whether the same result can be achieved by deleting or collapsing existing work.

### 4. Establish the Targeted Baseline

Before modifying the implementation:

1. Ensure a fresh complete benchmark-suite baseline exists for the current checkout; otherwise run the entire suite now.
2. Run the targeted benchmark with enough repetitions for precise local comparison.
3. Measure applicable memory and artifact sizes.
4. Apply the measurement rules.
5. Retain all raw full-suite and targeted results.
6. Record the exact commands and environment.

### 5. Make the Change

Implement the smallest safe version of the optimization.

Keep the implementation:

- minimal;
- semantic;
- readable;
- locally understandable;
- consistent with the existing codebase;
- free of unnecessary abstractions;
- free of duplicated logic;
- free of speculative state.

Aggressively inspect the hot path for:

- repeated conditions;
- duplicated expressions;
- avoidable branches;
- work repeated across branches;
- checks that can safely occur once before branching;
- checks guaranteed by internal invariants;
- redundant property accesses;
- redundant Map/Object lookups;
- redundant conversions;
- unnecessary temporary objects;
- unnecessary arrays;
- unnecessary copies;
- unnecessary allocation;
- unnecessary initialization;
- unnecessary bounds calculations;
- unnecessary closures;
- unnecessary iterator creation;
- unnecessary spreading or destructuring;
- unnecessary promises or async boundaries;
- repeated string encoding or decoding;
- repeated serialization or parsing;
- repeated index updates;
- repeated traversal of the same data;
- data structures whose maintenance cost dominates the operation they accelerate.

Collapse branches when their shared work can safely execute once before or after the branch.

Remove operations that are provably unnecessary for correctness and convergence.

### 6. Validate Correctness

Run the targeted tests for the affected area.

Ignore coverage metrics during optimization evaluation.

Ensure all relevant convergence invariants pass. The optimization must continue to guarantee full real-time convergence in every supported scenario.

Do not:

- weaken tests;
- delete correctness checks from tests;
- bypass assertions;
- narrow test inputs;
- exclude failing scenarios;
- alter expected results;
- redefine semantics;
- change representative workloads;

merely to make an optimization pass.

When feasible, add a focused regression test for any invariant exposed by the optimization.

### 7. Measure the Candidate

Run the exact targeted baseline procedure against the candidate.

Then run the complete benchmark suite against the candidate and compare every row with the fresh full-suite baseline.

Measure:

- targeted benchmark results;
- complete benchmark-suite results;
- every full-suite before/after percentage change;
- applicable memory behavior;
- applicable generated artifact sizes;
- relevant competitor results.

Use the same run count for baseline and candidate measurements being directly compared.

Any apparent full-suite regression must be resolved with additional matched baseline/candidate runs when noise could change the decision.

### 8. Analyze Generated JavaScript

Inspect final generated JavaScript whenever an optimization depends on runtime or bundler behavior such as:

- inlining;
- branch elimination;
- dead-code elimination;
- constant folding;
- allocation removal;
- object-shape changes;
- property access patterns;
- iterator lowering;
- spread/destructuring expansion;
- helper generation;
- bundler tree-shaking;
- minification.

Check whether the generated output actually:

- removed the intended operation;
- removed the intended branch;
- removed dead code;
- avoided an allocation;
- reduced property accesses;
- removed unnecessary wrappers or helpers;
- changed bundle size in the expected direction.

Do not assume a source-level simplification changed runtime behavior.

If the intended transformation is absent, treat that as evidence against the hypothesis.

### 9. Evaluate the Result

Keep the change only when evidence shows a meaningful improvement and the complete benchmark suite shows no reproducible regression, unless the user explicitly accepts a quantified system-level tradeoff.

Consider:

- median performance;
- dispersion;
- distribution overlap;
- complete benchmark-suite diff;
- affected benchmark rows;
- unrelated benchmark rows that changed unexpectedly;
- representative workloads;
- competitor position;
- generated code;
- source-code size;
- bundle size;
- memory use;
- initialization cost;
- complexity;
- correctness risk;
- convergence guarantees.

Prefer Pareto improvements: changes that improve one or more important dimensions without worsening another.

If the change does not improve its target, revert it completely.

If the result is statistically or practically inconclusive, revert it unless additional profiling or benchmarking can resolve the uncertainty immediately.

Do not retain speculative optimization code.

### 10. Document the Attempt

Create a record under:

`C:\Users\jorts\sequenced\archives\optimizations\{targetDescriptiveName}`

Document:

- target;
- hypothesis;
- bottleneck evidence;
- relevant source locations;
- previous related attempts;
- implementation details;
- benchmark environment;
- runtime version;
- commands used;
- run count;
- raw full-suite baseline results;
- raw full-suite candidate results;
- complete full-suite before/after diff;
- every investigated apparent regression and its resolution;
- raw targeted baseline results;
- raw targeted candidate results;
- medians;
- variance or interquartile range;
- absolute differences;
- percentage changes;
- competitor results;
- relative gaps before and after;
- bundle sizes before and after;
- memory effects;
- affected tests;
- convergence-invariant results;
- generated-code findings;
- final decision;
- reason the change was kept or reverted;
- possible future investigations.

Document failed attempts as carefully as successful ones so they are not repeated without new evidence.

### 11. Repeat

Repeat the loop with the next evidence-backed optimization target.

Do not continue modifying a retained optimization while its effect remains unclear.

Establish a clean measured result before beginning the next hypothesis.

---

## Code Constraints

Keep the code semantic, minimal, readable, and consistent with the existing codebase.

Prefer:

- deleting work;
- deleting state;
- deleting branches;
- deleting abstractions;
- simpler data flow;
- fewer allocations;
- fewer copies;
- fewer conversions;
- fewer property accesses;
- fewer lookups;
- fewer traversals;
- fewer imports and exports;
- better locality;
- stable object shapes;
- smaller hot-path representations;
- compile-time or initialization-time work over repeated runtime work when justified;
- direct representations;
- shared work outside branches;
- semantic helper functions only when they make the implementation clearer;
- reducing source and generated code size.

Avoid:

- speculative optimization;
- unmeasured micro-optimization;
- benchmark-specific special cases;
- unrealistic workloads;
- large abstractions;
- unnecessary indirection;
- additional state without demonstrated value;
- duplicated logic;
- unrelated refactoring;
- changing several performance variables at once;
- retaining unsuccessful code;
- accepting regressions hidden by aggregate results;
- changing benchmark methodology between baseline and candidate;
- optimizing dead or insignificant code;
- comments that describe behavior no longer present.

---

## Benchmark Integrity

Never manufacture a benchmark win.

Do not:

- remove required work from only the benchmarked path;
- cache values that real workloads cannot cache;
- exclude setup costs that are part of real operation;
- use different inputs for Sequenced and competitors;
- reduce correctness guarantees for benchmark builds;
- alter competitor configurations unfairly;
- select only favorable runs;
- discard unfavorable valid measurements;
- compare warmed Sequenced results against cold competitors;
- modify benchmark semantics without explicitly documenting the change.

Benchmarks must continue to represent real supported behavior.

Never accept a local benchmark win without checking the complete suite for regressions.

---

## Decision Rules

Keep an optimization when:

- correctness and convergence tests pass;
- required semantics are preserved;
- the target improvement is reproducible;
- the improvement is practically meaningful;
- the complete benchmark suite has been compared before and after;
- no benchmark row has a reproducible regression unless the user explicitly accepts a quantified system-level tradeoff;
- competitor position does not materially worsen without justification;
- bundle, memory, and complexity costs are acceptable;
- the result is fully documented.

Revert an optimization when:

- its target does not improve;
- the result is inconclusive;
- variance overwhelms the measured difference;
- any benchmark row regresses reproducibly without an explicitly accepted tradeoff;
- representative workloads regress materially;
- it weakens semantics or convergence;
- it requires benchmark manipulation;
- it introduces unjustified complexity or state;
- it produces an unjustified bundle-size regression;
- its benefit cannot be reproduced.

---

## Non-Negotiable Rules

**PRESERVE REQUIRED SEMANTICS AND CONVERGENCE GUARANTEES COMPLETELY.**

**OPTIMIZE RUNTIME PERFORMANCE TO THE EXTREME.**

**SIMPLIFY LOGIC AND DATA FLOW TO THE EXTREME.**

**REMOVE EVERY OPERATION AND BRANCH NOT REQUIRED FOR CORRECTNESS.**

**COLLAPSE DUPLICATED BRANCH WORK WHEN SAFE.**

**MINIMIZE SOURCE CODE, GENERATED JAVASCRIPT, AND BUNDLE SIZE.**

**FIND BOTTLENECKS THROUGH RUNTIME ANALYSIS AND ELIMINATE THEM.**

**ONLY MAKE EDUCATED, FALSIFIABLE OPTIMIZATION ATTEMPTS.**

**RUN AND RETAIN A FRESH COMPLETE BENCHMARK-SUITE BASELINE BEFORE OPTIMIZATION.**

**MEASURE THE TARGETED BASELINE BEFORE MODIFYING CODE.**

**RUN THE COMPLETE BENCHMARK SUITE AFTER EVERY OPTIMIZATION CANDIDATE AND COMPARE EVERY ROW AGAINST BASELINE.**

**DO NOT RETAIN A CANDIDATE WITH A REPRODUCIBLE BENCHMARK REGRESSION UNLESS THE USER EXPLICITLY ACCEPTS THE QUANTIFIED TRADEOFF.**

**VALIDATE EVERY CANDIDATE WITH IDENTICAL MEASUREMENT PROCEDURES.**

**REVERT CHANGES THAT DO NOT PRODUCE A REPRODUCIBLE, MEANINGFUL IMPROVEMENT.**

**DOCUMENT SUCCESSFUL AND FAILED ATTEMPTS.**

**BASE EVERY DECISION ON VERIFIABLE, REPRODUCIBLE, TESTED EVIDENCE.**
