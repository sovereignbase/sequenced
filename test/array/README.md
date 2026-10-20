# Array suite

```powershell
npm run test:array
npm run test:array:watch
npm run typecheck:array
```

| Scenario                                       | Checks                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [API](equivelance/api/test.ts)                 | All 38 ES2024 Array instance methods, length, default iterator and extensions                                       |
| [Reads](equivelance/reads/test.ts)             | Native results, search equality, index coercion, copies, nested arrays, empty inputs and errors                     |
| [Mutations](equivelance/mutations/test.ts)     | Return values, receiver identity, splice ranges, stable sorting, length and seeded local edits                      |
| [Callbacks](equivelance/callbacks/test.ts)     | Arguments, thisArg, order, exceptions, callback edits and live iterators                                            |
| [Regressions](equivelance/regressions/test.ts) | Callback edits, shallow references, sparse callback results and no-op events                                        |
| [Types](equivelance/types/test.ts)             | Real public declarations, generic inference, type guards and event payloads                                         |
| [Events and extensions](events/test.ts)        | Local splice events, get/set/delete, apply/merge forwarding and EventTarget behavior                                |
| [Convergence](convergence/test.ts)             | Registered concurrent participants, overlapping edits, merge, rendered views and compatible checkpoint continuation |
| [Benchmark fixtures](benchmark/test.ts)        | Every workload and variant reaches its native-array model from fresh state                                          |
| [Browsers](compatibility/browser.spec.ts)      | Built package, Array methods and replication events                                                                 |

Native Array is the oracle for method behavior. The wrapper is loaded from
source with its actual TypeScript declarations. The method manifest is checked
against the runtime's Array prototype.

This is a dense method API: positions use get/set/delete; copying methods return
plain arrays and callbacks receive the wrapper. Grown slots contain explicit
undefined values. Numeric properties, sparse descriptors and static Array
factories are outside this API. `delete(index)` removes one element and shifts
the tail; it is not the JavaScript delete-property operator.

See the [shared protocol rules](../README.md) and [benchmarks](../../benchmark/README.md).
