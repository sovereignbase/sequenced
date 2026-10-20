# Text suite

```powershell
npm run test:text
npm run test:text:watch
npm run typecheck:text
```

| Scenario                                           | Checks                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [API and reads](equivelance/api/test.ts)           | Existing methods, string conversion, UTF-16 length, inspection and live code-unit iteration                    |
| [Editing equivalence](equivelance/editing/test.ts) | Insertion, selection removal/replacement, defaults, typing, paste, backspace and seeded editor histories       |
| [Events](events/test.ts)                           | Half-open ranges, code-unit conversion, engine forwarding, JSON snapshots and EventTarget options              |
| [Convergence](convergence/test.ts)                 | Registered offline editors, overlapping selections, merge, compatible checkpoints and synchronous render order |
| [Types](types/test.ts)                             | Existing method and event signatures                                                                           |
| [Benchmark fixtures](benchmark/test.ts)            | Every workload and variant reaches its independent string edit model                                           |
| [Browsers](compatibility/browser.spec.ts)          | Built package, text editing and change-driven rendering                                                        |

The oracle is `before.slice(0, start) + inserted + before.slice(end)`.
Selections are valid half-open UTF-16 offsets, matching the existing Text API.
The matrix covers empty text, line endings, tabs, NUL, combining marks, surrogate
pairs and lone surrogates. Every selection in the short fixtures is tested.
A seeded history also replays every change event into a separate rendered string.

This suite does not require String instance methods. Text iteration intentionally
returns UTF-16 code units (`text.split('')`), rather than native String iteration's
code points. Existing empty remote change events remain supported.

See the [shared protocol rules](../README.md) and [benchmarks](../../benchmark/README.md).
Text has no public disposal method; the test/benchmark helper releases its native
Projection after use without adding a method to the library.
