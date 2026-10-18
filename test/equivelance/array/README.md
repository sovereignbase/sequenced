# SequencedArray equivalence

```powershell
npm run test:array
npm run test:array:watch
npm run typecheck:array
```

The folder name `equivelance` follows the requested location. Tests use the same
scenario-folder / `test.ts` layout as `../sequencer/test`.

| Scenario                                | Contract                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [API](api/test.ts)                      | All 38 ES2024 Array instance methods, default iterator, length, constructor hydration and CRDT extensions                      |
| [Reads](reads/test.ts)                  | Results, search equality, index coercion, empty inputs, copying methods, nested arrays and errors                              |
| [Mutations](mutations/test.ts)          | Native return values and receiver identity, splice boundaries, stable sorting, length and a seeded 300-edit history            |
| [Callbacks](callbacks/test.ts)          | Argument values/order, receiver identity, thisArg, short circuiting, exceptions, mutations during traversal and live iterators |
| [Replication](replication/test.ts)      | get/set/delete, apply/merge, sequencer interoperability, convergence, snapshots and EventTarget behavior                       |
| [Benchmark fixtures](benchmark/test.ts) | Every plain-sequencer workload reaches its independent native-array model from a fresh fixture                                 |
| [Public types](types/test.ts)           | Package exports, generic inference, type guards and typed events                                                               |
| [Regressions](regressions/test.ts)      | Callback edits, shallow references, no-op events, synchronous transport and seeded offline delivery                            |

Native arrays provide the expected results; the wrapper is always loaded from
`src/SequencedArray/class.ts`, without building `dist` or substituting a mock.
The runtime manifest detects additions to `Array.prototype` in a newer Node
runtime so unsupported methods cannot silently disappear from the contract.
Use a Node runtime with ES2024 Array support (the verified runtime is Node 24).

The contract covers instance methods. Static factories (`Array.from`, `of`,
`isArray`, etc.), bracket-property access and sparse property descriptors are
outside its scope. Grown length slots must iterate as `undefined`; the tests do
not require those slots to be sparse. Callback-driven truncation must still
produce the same result as the corresponding native method.

CRDT conventions follow the existing SequencedText wrapper: `delta` carries
sequencer Gossip, `change` carries ordered `[start, exclusiveEnd, values?]`
splices, and `snapshot` carries a Sequence. `delete(index)` removes **one**
visible value and shifts subsequent values. It is a CRDT operation, unlike the
JavaScript `delete array[index]` operator. `set` replaces one visible value.
Return values for these extensions are deliberately unspecified. Acknowledgements
travel in `delta` gossip as in SequencedText; no separate `ack` event is required.

The seeded offline-delivery regression currently fails because of
[sequencer issue #2](https://github.com/sovereignbase/sequencer/issues/2). It stays
enabled and failing: there is no skip, expected-failure annotation or wrapper
workaround. The other Array tests exercise the actual source implementation.

The same length/value inconsistency reproduces without SequencedArray:

```powershell
node test/equivelance/array/regressions/sequencer-repro.ts
```

[Shared fixtures](../../.shared/array.ts) load the implementation from source.
The native-array differential tables use an adapter type for callback receivers;
[public declaration tests](types/test.ts) check the actual exported types directly.
`typecheck:array` now includes implementation and declaration checking.

See [array benchmarks](../../../benchmark/README.md) for the wrapper comparison.
