# SequencedArray

```typescript
import { Sequenced, SequencedArray } from '@sovereignbase/sequenced'

const array = new Sequenced.Array<number>(1)
array.push(1, 2, 3)
array.set(1, 20)
array.delete(0)
array.splice(-1, 1, 30, 40)
console.log([...array]) // [20, 30, 40]
array.destroy()
```

The named `SequencedArray` export is the same constructor as `Sequenced.Array`.
All 38 ES2024 Array instance methods are available. Methods that copy return
plain arrays. Mutators return native-style lengths, removed values or the
receiver. Callback methods capture the initial length, observe changes to pending
positions, preserve callback `thisArg`, and pass the replica as their third
argument. Iterators observe subsequent edits and stay exhausted after completion.

This is a dense, method-based API. Numeric property access, sparse descriptors,
`Array.isArray(replica)` and Array's static factories are outside the contract.
Growing `length` appends explicit `undefined` values. Local object reads and
copies preserve shallow references; modifying a nested object does not publish
a CRDT edit. Use `set` to replace and replicate an element.

| Extension                                   | Behavior                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `new SequencedArray<T>(actorID, snapshot?)` | Creates an empty replica or hydrates trusted sequencer state                                |
| `get(index)`                                | Zero-based read; invalid or missing indexes return undefined                                |
| `set(index, value)`                         | Replaces one existing element; invalid indexes throw RangeError                             |
| `delete(index)`                             | Removes one existing element and shifts subsequent values; invalid indexes throw RangeError |
| `apply(gossip)`                             | Applies sequencer Gossip and emits resulting changes/replies                                |
| `merge(snapshot)`                           | Merges full sequencer state                                                                 |
| `toJSON()`                                  | Exports a replication snapshot, including history and JSON-compatible numeric metadata      |
| `snapshot()`                                | Emits that replication snapshot as a snapshot event                                         |
| `destroy()`                                 | Releases native state; repeat calls are harmless; do not use the replica afterwards         |

Snapshots preserve causal metadata, whereas `[...array]` only returns visible
values. JSON transport follows ordinary JSON value serialization rules.
Actor identifiers, acknowledgements and participant membership retain the
underlying sequencer protocol semantics.

Listeners use EventTarget options, including `once`, `signal` and capture-matched
removal. `change` carries sequencer splices `[start, exclusiveEnd, values?]`;
`delta` carries sequencer Gossip; `snapshot` carries a Sequence. Local changes
are dispatched before outgoing gossip so synchronous transport preserves visible
change order. Empty edits do not emit changes or gossip. Delivery of an already
applied operation may emit acknowledgement gossip without a visible change.
