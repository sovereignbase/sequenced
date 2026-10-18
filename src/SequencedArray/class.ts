import { Projection } from '@sovereignbase/sequencer'
import type { Result } from '@sovereignbase/sequencer'
import type {
  SequencedArraySnapshot,
  SequencedArrayEventMap,
  SequencedArrayEventListenerFor,
} from './types/type.js'

/** ECMAScript ToIntegerOrInfinity; unary + also rejects BigInt and Symbol. */
function integer(value: number): number {
  const number = +value
  return Number.isNaN(number) || number === 0 ? 0 : Math.trunc(number)
}

function position(value: number, length: number): number {
  const index = integer(value)
  return index < 0 ? Math.max(length + index, 0) : Math.min(index, length)
}

function callable(callback: unknown): asserts callback is Function {
  if (typeof callback !== 'function')
    throw new TypeError('Callback must be a function')
}

/**
 * A dense replicated sequence with the ES2024 Array instance methods.
 *
 * Read/write positions use get/set/delete rather than numeric properties.
 * Copying methods return plain arrays; callbacks receive this replica.
 * Values have normal shallow JavaScript reference semantics. Nested object
 * mutations are not replicated: replace the element with set() to publish them.
 */
export class SequencedArray<T> implements Iterable<T> {
  private readonly projection: Projection<T>
  private readonly eventTarget = new EventTarget()

  /** Hydrates an optional trusted sequencer snapshot for the supplied actor. */
  constructor(actorID: number, snapshot?: SequencedArraySnapshot<T>) {
    this.projection = new Projection<T>(actorID, snapshot)
  }

  get length(): number {
    return this.projection.length()
  }

  /** Grown slots are explicit undefined values, rather than sparse properties. */
  set length(value: number) {
    const length = value >>> 0
    if (length !== +value) throw new RangeError('Invalid array length')
    const previous = this.length
    if (length < previous) this.edit(length, previous - length, [])
    else if (length > previous)
      this.edit(
        previous,
        0,
        new Array<T>(length - previous).fill(undefined as T)
      )
  }

  /** Reads a zero-based position; invalid or missing positions return undefined. */
  get(index: number): T | undefined {
    return Number.isInteger(index) && index >= 0 && index < this.length
      ? this.projection.value(index)
      : undefined
  }

  at(index: number): T | undefined {
    const length = this.length
    const offset = integer(index)
    const at = offset < 0 ? length + offset : offset
    return at >= 0 && at < length ? this.projection.value(at) : undefined
  }

  /** Replaces one existing position; rejects positions outside the visible sequence. */
  set(index: number, value: T): void {
    this.checkIndex(index)
    this.edit(index, 1, [value])
  }

  /** Removes one position and shifts following values to the left. */
  delete(index: number): void {
    this.checkIndex(index)
    this.edit(index, 1, [])
  }

  private checkIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.length)
      throw new RangeError('Index must address an existing element')
  }

  /** Converts a half-open edit to the sequencer's inclusive removal range. */
  private edit(start: number, count: number, items: T[]): void {
    if (count === 0 && items.length === 0) return
    const delta =
      count === 0
        ? this.projection.insert(items, start)
        : items.length === 0
          ? this.projection.remove(start, start + count - 1)
          : this.projection.replace(items, start, start + count - 1)
    const change = items.length
      ? ([[start, start + count, items]] as const)
      : ([[start, start + count]] as const)
    // Emit visible changes first so synchronous transports cannot reorder them.
    this.dispatchEvent('change', change)
    this.dispatchEvent('delta', delta)
  }

  push(...items: T[]): number {
    const length = this.length
    this.edit(length, 0, items)
    return length + items.length
  }

  unshift(...items: T[]): number {
    const length = this.length
    this.edit(0, 0, items)
    return length + items.length
  }

  pop(): T | undefined {
    const length = this.length
    if (length === 0) return undefined
    const value = this.projection.value(length - 1)
    this.edit(length - 1, 1, [])
    return value
  }

  shift(): T | undefined {
    if (this.length === 0) return undefined
    const value = this.projection.value(0)
    this.edit(0, 1, [])
    return value
  }

  splice(start?: number, deleteCount?: number, ...items: T[]): T[] {
    const length = this.length
    const at = position(start ?? 0, length)
    const count =
      arguments.length === 0
        ? 0
        : arguments.length === 1
          ? length - at
          : Math.min(Math.max(integer(deleteCount as number), 0), length - at)
    const removed = count ? this.projection.values(at, at + count - 1) : []
    this.edit(at, count, items)
    return removed
  }

  fill(value: T, start = 0, end = this.length): this {
    const length = this.length
    const at = position(start, length)
    const count = Math.max(position(end, length) - at, 0)
    if (count) this.edit(at, count, new Array<T>(count).fill(value))
    return this
  }

  copyWithin(target: number, start: number, end = this.length): this {
    const length = this.length
    const to = position(target, length)
    const from = position(start, length)
    const count = Math.min(
      Math.max(position(end, length) - from, 0),
      length - to
    )
    if (count)
      this.edit(to, count, this.projection.values(from, from + count - 1))
    return this
  }

  reverse(): this {
    const values = this.projection.values()
    if (values.length > 1) this.edit(0, values.length, values.reverse())
    return this
  }

  sort(compareFn?: (a: T, b: T) => number): this {
    const values = this.projection.values().sort(compareFn)
    if (values.length)
      this.edit(0, Math.min(values.length, this.length), values)
    return this
  }

  slice(start = 0, end = this.length): T[] {
    const length = this.length
    const from = position(start, length)
    const to = position(end, length)
    return to > from ? this.projection.values(from, to - 1) : []
  }

  concat(...items: (T | ConcatArray<T>)[]): T[] {
    return this.projection.values().concat(...items)
  }

  includes(searchElement: T, fromIndex?: number): boolean {
    return this.projection.values().includes(searchElement, fromIndex)
  }

  indexOf(searchElement: T, fromIndex?: number): number {
    return this.projection.values().indexOf(searchElement, fromIndex)
  }

  lastIndexOf(searchElement: T, fromIndex?: number): number {
    const values = this.projection.values()
    return arguments.length < 2
      ? values.lastIndexOf(searchElement)
      : values.lastIndexOf(searchElement, fromIndex)
  }

  join(separator?: string): string {
    return this.projection.values().join(separator)
  }

  toString(): string {
    return this.join()
  }

  toLocaleString(
    locales?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions & Intl.DateTimeFormatOptions
  ): string {
    return Reflect.apply(
      Array.prototype.toLocaleString,
      this.projection.values(),
      [locales, options]
    )
  }

  flat<A, D extends number = 1>(
    this: SequencedArray<A>,
    depth?: D
  ): FlatArray<A[], D>[] {
    return this.projection.values().flat(depth)
  }

  toReversed(): T[] {
    return this.projection.values().toReversed()
  }

  toSorted(compareFn?: (a: T, b: T) => number): T[] {
    return this.projection.values().toSorted(compareFn)
  }

  toSpliced(start?: number, deleteCount?: number, ...items: T[]): T[] {
    return Reflect.apply(
      Array.prototype.toSpliced,
      this.projection.values(),
      arguments
    )
  }

  with(index: number, value: T): T[] {
    return this.projection.values().with(index, value)
  }

  /** Captures length once; pending values stay live during callback edits. */
  private visit(
    callback: (value: T, index: number) => boolean | void,
    backwards = false,
    missing = false
  ): void {
    const length = this.length
    for (let step = 0; step < length; step++) {
      const index = backwards ? length - step - 1 : step
      if (!missing && index >= this.length) continue
      if (callback(this.get(index) as T, index) === false) break
    }
  }

  every<S extends T>(
    predicate: (value: T, index: number, array: this) => value is S,
    thisArg?: unknown
  ): this is this & SequencedArray<S>
  every(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): boolean
  every(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): boolean {
    callable(predicate)
    let result = true
    this.visit((value, index) => {
      if (!Reflect.apply(predicate, thisArg, [value, index, this])) {
        result = false
        return false
      }
    })
    return result
  }

  some(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): boolean {
    callable(predicate)
    let result = false
    this.visit((value, index) => {
      if (Reflect.apply(predicate, thisArg, [value, index, this])) {
        result = true
        return false
      }
    })
    return result
  }

  filter<S extends T>(
    predicate: (value: T, index: number, array: this) => value is S,
    thisArg?: unknown
  ): S[]
  filter(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): T[]
  filter(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): T[] {
    callable(predicate)
    const result: T[] = []
    this.visit((value, index) => {
      if (Reflect.apply(predicate, thisArg, [value, index, this]))
        result.push(value)
    })
    return result
  }

  map<U>(
    callback: (value: T, index: number, array: this) => U,
    thisArg?: unknown
  ): U[] {
    callable(callback)
    const result = new Array<U>(this.length)
    this.visit((value, index) => {
      result[index] = Reflect.apply(callback, thisArg, [value, index, this])
    })
    return result
  }

  flatMap<U>(
    callback: (value: T, index: number, array: this) => U | ReadonlyArray<U>,
    thisArg?: unknown
  ): U[] {
    callable(callback)
    const result: U[] = []
    this.visit((value, index) => {
      const mapped = Reflect.apply(callback, thisArg, [value, index, this])
      if (Array.isArray(mapped)) {
        const length = mapped.length
        for (let i = 0; i < length; i++) if (i in mapped) result.push(mapped[i])
      } else result.push(mapped as U)
    })
    return result
  }

  forEach(
    callback: (value: T, index: number, array: this) => void,
    thisArg?: unknown
  ): void {
    callable(callback)
    this.visit((value, index) => {
      Reflect.apply(callback, thisArg, [value, index, this])
    })
  }

  private findPosition(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg: unknown,
    backwards: boolean
  ): number {
    callable(predicate)
    let result = -1
    this.visit(
      (value, index) => {
        if (Reflect.apply(predicate, thisArg, [value, index, this])) {
          result = index
          return false
        }
      },
      backwards,
      true
    )
    return result
  }

  findIndex(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): number {
    return this.findPosition(predicate, thisArg, false)
  }

  findLastIndex(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): number {
    return this.findPosition(predicate, thisArg, true)
  }

  find<S extends T>(
    predicate: (value: T, index: number, array: this) => value is S,
    thisArg?: unknown
  ): S | undefined
  find(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): T | undefined
  find(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): T | undefined {
    callable(predicate)
    let result: T | undefined
    this.visit(
      (value, index) => {
        if (Reflect.apply(predicate, thisArg, [value, index, this])) {
          result = value
          return false
        }
      },
      false,
      true
    )
    return result
  }

  findLast<S extends T>(
    predicate: (value: T, index: number, array: this) => value is S,
    thisArg?: unknown
  ): S | undefined
  findLast(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): T | undefined
  findLast(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): T | undefined {
    callable(predicate)
    let result: T | undefined
    this.visit(
      (value, index) => {
        if (Reflect.apply(predicate, thisArg, [value, index, this])) {
          result = value
          return false
        }
      },
      true,
      true
    )
    return result
  }

  private fold<U>(
    callback: (previous: U, value: T, index: number, array: this) => U,
    initial: U,
    supplied: boolean,
    backwards: boolean
  ): U {
    callable(callback)
    let result = initial
    let initialized = supplied
    this.visit((value, index) => {
      if (!initialized) {
        result = value as unknown as U
        initialized = true
      } else result = callback(result, value, index, this)
    }, backwards)
    if (!initialized)
      throw new TypeError('Reduce of empty array with no initial value')
    return result
  }

  reduce(callback: (previous: T, value: T, index: number, array: this) => T): T
  reduce<U>(
    callback: (previous: U, value: T, index: number, array: this) => U,
    initial: U
  ): U
  reduce<U>(
    callback: (previous: U, value: T, index: number, array: this) => U,
    initial?: U
  ): U {
    return this.fold(callback, initial as U, arguments.length > 1, false)
  }

  reduceRight(
    callback: (previous: T, value: T, index: number, array: this) => T
  ): T
  reduceRight<U>(
    callback: (previous: U, value: T, index: number, array: this) => U,
    initial: U
  ): U
  reduceRight<U>(
    callback: (previous: U, value: T, index: number, array: this) => U,
    initial?: U
  ): U {
    return this.fold(callback, initial as U, arguments.length > 1, true)
  }

  *values(): ArrayIterator<T> {
    for (let index = 0; index < this.length; index++)
      yield this.projection.value(index) as T
  }

  *keys(): ArrayIterator<number> {
    for (let index = 0; index < this.length; index++) yield index
  }

  *entries(): ArrayIterator<[number, T]> {
    for (let index = 0; index < this.length; index++)
      yield [index, this.projection.value(index) as T]
  }

  [Symbol.iterator](): ArrayIterator<T> {
    return this.values()
  }

  /** Applies Gossip and emits ordered visible changes plus any reply Gossip. */
  apply(delta: unknown): void {
    this.received(this.projection.apply(delta))
  }

  /** Merges a replication snapshot, preserving concurrent edits. */
  merge(snapshot: SequencedArraySnapshot<T>): void {
    this.received(this.projection.merge(snapshot))
  }

  private received(result: Result<T> | undefined): void {
    if (!result) return
    if (result[0].length) this.dispatchEvent('change', result[0])
    if (result[1]?.length) this.dispatchEvent('delta', result[1])
  }

  snapshot(): void {
    this.dispatchEvent('snapshot', this.toJSON())
  }

  /** Replication state, not just visible values; metadata is JSON-compatible. */
  toJSON(): SequencedArraySnapshot<T> {
    const [meta, values] = this.projection.sequence()
    return [Array.isArray(meta) ? meta : Array.from(meta), values]
  }

  /** Releases native state deterministically. Do not use the replica afterwards. */
  destroy(): void {
    this.projection.destroy()
  }

  [Symbol.for('nodejs.util.inspect.custom')](): T[] {
    return this.projection.values()
  }
  [Symbol.for('Deno.customInspect')](): T[] {
    return this.projection.values()
  }

  addEventListener<K extends keyof SequencedArrayEventMap<T>>(
    type: K,
    listener: SequencedArrayEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventTarget.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  removeEventListener<K extends keyof SequencedArrayEventMap<T>>(
    type: K,
    listener: SequencedArrayEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    this.eventTarget.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options
    )
  }

  dispatchEvent<K extends keyof SequencedArrayEventMap<T>>(
    type: K,
    detail: SequencedArrayEventMap<T>[K]
  ): void {
    this.eventTarget.dispatchEvent(new CustomEvent(type, { detail }))
  }
}
