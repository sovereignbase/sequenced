import { unknownError } from '../errors/unknown.js'
import { Projection } from '@sovereignbase/sequencer'
import { SequencedError } from '../errors/class.js'
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

/** Resolves a relative array position and clamps it to the visible bounds. */
function position(value: number, length: number): number {
  const index = integer(value)
  return index < 0 ? Math.max(length + index, 0) : Math.min(index, length)
}

/** Rejects a non-callable callback with `INVALID_CALLBACK`. */
function callable(callback: unknown): asserts callback is Function {
  if (typeof callback !== 'function')
    throw new SequencedError('INVALID_CALLBACK', 'Callback must be a function')
}

/**
 * A dense replicated sequence with the ES2024 Array instance methods.
 *
 * Read/write positions use get/set/delete rather than numeric properties.
 * Copying methods return plain arrays; callbacks receive this replica.
 * Values have normal shallow JavaScript reference semantics. Nested object
 * mutations are not replicated: replace the element with set() to publish them.
 *
 * @typeParam T The element type.
 */
export class SequencedArray<T> implements Iterable<T> {
  /** The sequencer projection that owns the replicated values. */
  private readonly projection: Projection<T>
  /** The event target, allocated when the first listener is registered. */
  private eventTarget?: EventTarget

  /** Reads one projection value and scopes unexpected failures to this library. */
  #value(at: number): T | undefined {
    try {
      return this.projection.value(at)
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.#value()')
    }
  }

  /** Reads a projection range whose end position is inclusive. */
  #values(start?: number, end?: number): T[] {
    try {
      return this.projection.values(start, end)
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.#values()')
    }
  }

  /**
   * Creates an empty array or restores a replication snapshot.
   * @param actorID The identifier of the local editing actor.
   * @param snapshot Optional replication state to restore.
   * @throws {SequencedError} If the underlying projection cannot be created.
   */
  constructor(actorID: number, snapshot?: unknown) {
    try {
      this.projection = new Projection<T>(actorID, snapshot)
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.constructor()')
    }
  }

  /** Returns the number of visible elements. */
  get length(): number {
    try {
      return this.projection.length()
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.length()')
    }
  }

  /**
   * Truncates the array or extends it with explicit `undefined` values.
   * @throws {SequencedError} With code `INVALID_ARRAY_LENGTH` for an invalid length.
   */
  set length(value: number) {
    const length = value >>> 0
    if (length !== +value)
      throw new SequencedError('INVALID_ARRAY_LENGTH', 'Invalid array length')
    const previous = this.length
    if (length < previous) this.edit(length, previous - length, [])
    else if (length > previous)
      this.edit(
        previous,
        0,
        new Array<T>(length - previous).fill(undefined as T)
      )
  }

  /**
   * Returns the element at an absolute, zero-based position.
   * @param index The position to read; negative indices are not relative.
   * @returns The element, or `undefined` if the position is invalid or absent.
   */
  get(index: number): T | undefined {
    return Number.isInteger(index) && index >= 0 && index < this.length
      ? this.#value(index)
      : undefined
  }

  /**
   * Returns the element at a relative position.
   * @param index The position to read. A negative value counts from the end.
   * @returns The element, or `undefined` if the resolved position is outside the array.
   */
  at(index: number): T | undefined {
    const length = this.length
    const offset = integer(index)
    const at = offset < 0 ? length + offset : offset
    return at >= 0 && at < length ? this.#value(at) : undefined
  }

  /**
   * Replaces one existing element and emits the resulting edit.
   * @param index The absolute, zero-based position to replace.
   * @param value The replacement value.
   * @throws {SequencedError} With code `ARRAY_INDEX_OUT_OF_BOUNDS` for an invalid position.
   */
  set(index: number, value: T): void {
    this.checkIndex(index)
    this.edit(index, 1, [value])
  }

  /**
   * Removes one element and shifts later elements to the left.
   * @param index The absolute, zero-based position to remove.
   * @throws {SequencedError} With code `ARRAY_INDEX_OUT_OF_BOUNDS` for an invalid position.
   */
  delete(index: number): void {
    this.checkIndex(index)
    this.edit(index, 1, [])
  }

  /** Requires an absolute index that addresses an existing element. */
  private checkIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.length)
      throw new SequencedError(
        'ARRAY_INDEX_OUT_OF_BOUNDS',
        'Index must address an existing element'
      )
  }

  /** Converts a half-open edit to the sequencer's inclusive removal range. */
  private edit(start: number, count: number, items: T[]): void {
    try {
      if (count === 0 && items.length === 0) return
      const delta =
        count === 0
          ? this.projection.insert(items, start)
          : items.length === 0
            ? this.projection.remove(start, start + count - 1)
            : this.projection.replace(items, start, start + count - 1)
      if (this.eventTarget) {
        const change = items.length
          ? ([[start, start + count, items]] as const)
          : ([[start, start + count]] as const)
        this.dispatchEvent('change', change)
        this.dispatchEvent('delta', delta)
      }
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.edit()')
    }
  }

  /**
   * Appends elements to the array.
   * @param items The elements to append, in order.
   * @returns The new array length.
   */
  push(...items: T[]): number {
    const length = this.length
    this.edit(length, 0, items)
    return length + items.length
  }

  /**
   * Prepends elements to the array.
   * @param items The elements to prepend, in order.
   * @returns The new array length.
   */
  unshift(...items: T[]): number {
    const length = this.length
    this.edit(0, 0, items)
    return length + items.length
  }

  /** Removes and returns the last element, or returns `undefined` if empty. */
  pop(): T | undefined {
    const length = this.length
    if (length === 0) return undefined
    const value = this.#value(length - 1)
    this.edit(length - 1, 1, [])
    return value
  }

  /** Removes and returns the first element, or returns `undefined` if empty. */
  shift(): T | undefined {
    if (this.length === 0) return undefined
    const value = this.#value(0)
    this.edit(0, 1, [])
    return value
  }

  /**
   * Removes elements and inserts replacements at the same position.
   * @param start The start position; negative values count from the end.
   * @param deleteCount The number to remove. Omission removes the remaining tail.
   * @param items The replacement elements, in order.
   * @returns A plain array containing the removed elements. No arguments perform no edit.
   */
  splice(start?: number, deleteCount?: number, ...items: T[]): T[] {
    const length = this.length
    const at = position(start ?? 0, length)
    const count =
      arguments.length === 0
        ? 0
        : arguments.length === 1
          ? length - at
          : Math.min(Math.max(integer(deleteCount as number), 0), length - at)
    const removed = count ? this.#values(at, at + count - 1) : []
    this.edit(at, count, items)
    return removed
  }

  /**
   * Replaces elements in a range with the same value.
   * @param value The value to store in each position.
   * @param start The inclusive start; defaults to zero.
   * @param end The exclusive end; defaults to `length`. Negative bounds count from the end.
   * @returns This array.
   */
  fill(value: T, start = 0, end = this.length): this {
    const length = this.length
    const at = position(start, length)
    const count = Math.max(position(end, length) - at, 0)
    if (count) this.edit(at, count, new Array<T>(count).fill(value))
    return this
  }

  /**
   * Copies a range to another position without changing the array length.
   * @param target The destination start position.
   * @param start The inclusive source start position.
   * @param end The exclusive source end; defaults to `length`. Negative positions count from the end.
   * @returns This array. Overlapping source and destination ranges are supported.
   */
  copyWithin(target: number, start: number, end = this.length): this {
    const length = this.length
    const to = position(target, length)
    const from = position(start, length)
    const count = Math.min(
      Math.max(position(end, length) - from, 0),
      length - to
    )
    if (count) this.edit(to, count, this.#values(from, from + count - 1))
    return this
  }

  /** Reverses the visible elements in place and returns this array. */
  reverse(): this {
    const values = this.#values()
    if (values.length > 1) this.edit(0, values.length, values.reverse())
    return this
  }

  /**
   * Sorts the visible elements in place using a stable ordering.
   * @param compareFn A comparator returning a negative, zero or positive number.
   * Omission uses JavaScript string ordering, with `undefined` values last.
   * @returns This array.
   */
  sort(compareFn?: (a: T, b: T) => number): this {
    const values = this.#values().sort(compareFn)
    if (values.length)
      this.edit(0, Math.min(values.length, this.length), values)
    return this
  }

  /**
   * Returns a shallow copy of a visible range as a plain array.
   * @param start The inclusive start; defaults to zero.
   * @param end The exclusive end; defaults to `length`. Negative bounds count from the end.
   */
  slice(start = 0, end = this.length): T[] {
    const length = this.length
    const from = position(start, length)
    const to = position(end, length)
    return to > from ? this.#values(from, to - 1) : []
  }

  /**
   * Returns a plain array containing the visible elements followed by the supplied items.
   * @param items Values or arrays to concatenate, using native Array spreading rules.
   */
  concat(...items: (T | ConcatArray<T>)[]): T[] {
    return this.#values().concat(...items)
  }

  /**
   * Tests whether the array contains a value using SameValueZero equality.
   * @param searchElement The value to find; `NaN` compares equal to itself.
   * @param fromIndex The search start; defaults to zero. Negative values count from the end.
   */
  includes(searchElement: T, fromIndex?: number): boolean {
    return this.#values().includes(searchElement, fromIndex)
  }

  /**
   * Returns the first strictly equal match, or `-1` if none exists.
   * @param searchElement The value to find.
   * @param fromIndex The search start; defaults to zero. Negative values count from the end.
   */
  indexOf(searchElement: T, fromIndex?: number): number {
    return this.#values().indexOf(searchElement, fromIndex)
  }

  /**
   * Returns the last strictly equal match, or `-1` if none exists.
   * @param searchElement The value to find.
   * @param fromIndex The backward search start; defaults to the last index.
   * Negative values count from the end.
   */
  lastIndexOf(searchElement: T, fromIndex?: number): number {
    const values = this.#values()
    return arguments.length < 2
      ? values.lastIndexOf(searchElement)
      : values.lastIndexOf(searchElement, fromIndex)
  }

  /**
   * Converts the elements to strings and joins them.
   * @param separator The text between elements; defaults to a comma.
   * @returns The joined string, with `null` and `undefined` represented as empty strings.
   */
  join(separator?: string): string {
    return this.#values().join(separator)
  }

  /** Returns the visible elements joined with commas. */
  toString(): string {
    return this.join()
  }

  /**
   * Returns the native Array locale-sensitive representation of the visible elements.
   * @param locales The locale or locales to use for element formatting.
   * @param options Formatting options passed to each element's locale conversion.
   */
  toLocaleString(
    locales?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions & Intl.DateTimeFormatOptions
  ): string {
    return Reflect.apply(Array.prototype.toLocaleString, this.#values(), [
      locales,
      options,
    ])
  }

  /**
   * Returns a plain array with nested native arrays flattened to the requested depth.
   * @param depth The number of levels to flatten; defaults to one.
   */
  flat<A, D extends number = 1>(
    this: SequencedArray<A>,
    depth?: D
  ): FlatArray<A[], D>[] {
    return this.#values().flat(depth)
  }

  /** Returns a shallow, reversed copy as a plain array. */
  toReversed(): T[] {
    return this.#values().toReversed()
  }

  /**
   * Returns a shallow, stably sorted copy as a plain array.
   * @param compareFn A comparator; omission uses native Array string ordering.
   */
  toSorted(compareFn?: (a: T, b: T) => number): T[] {
    return this.#values().toSorted(compareFn)
  }

  /**
   * Returns a plain array with a range removed or replaced, leaving this replica unchanged.
   * @param start The start position; negative values count from the end.
   * @param deleteCount The number to remove. Omission removes the remaining tail.
   * @param items The replacement elements.
   */
  toSpliced(start?: number, deleteCount?: number, ...items: T[]): T[] {
    return Reflect.apply(Array.prototype.toSpliced, this.#values(), arguments)
  }

  /**
   * Returns a plain array with one element replaced.
   * @param index The position to replace; negative values count from the end.
   * @param value The replacement value.
   * @throws {RangeError} If the resolved index is outside the array.
   */
  with(index: number, value: T): T[] {
    return this.#values().with(index, value)
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

  /**
   * Tests whether every visited element satisfies a type-guard predicate.
   * @param predicate Receives the value, index and this replica; stops at the first false result.
   * @param thisArg The callback's `this` value.
   * @returns Whether every element matches; a true result narrows the element type.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
  every<S extends T>(
    predicate: (value: T, index: number, array: this) => value is S,
    thisArg?: unknown
  ): this is this & SequencedArray<S>
  /**
   * Tests whether every visited element satisfies a predicate; an empty array returns true.
   * @param predicate Receives the value, index and this replica.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
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

  /**
   * Tests whether any visited element satisfies a predicate; an empty array returns false.
   * @param predicate Receives the value, index and this replica; stops at the first true result.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
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

  /**
   * Returns a plain array of elements accepted by a type-guard predicate.
   * @param predicate Receives the value, index and this replica.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
  filter<S extends T>(
    predicate: (value: T, index: number, array: this) => value is S,
    thisArg?: unknown
  ): S[]
  /**
   * Returns a plain array of elements for which the predicate is truthy.
   * @param predicate Receives the value, index and this replica.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
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

  /**
   * Returns a plain array containing the callback result for each visited element.
   * @param callback Receives the value, index and this replica.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the callback is not callable.
   */
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

  /**
   * Maps each visited element and flattens returned native arrays by one level.
   * @param callback Receives the value, index and this replica.
   * @param thisArg The callback's `this` value.
   * @returns A plain array containing the flattened results.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the callback is not callable.
   */
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

  /**
   * Calls a function for each visited element in ascending index order.
   * @param callback Receives the value, index and this replica.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the callback is not callable.
   */
  forEach(
    callback: (value: T, index: number, array: this) => void,
    thisArg?: unknown
  ): void {
    callable(callback)
    this.visit((value, index) => {
      Reflect.apply(callback, thisArg, [value, index, this])
    })
  }

  /** Finds a matching index in either direction, including positions removed during visitation. */
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

  /**
   * Returns the first matching index, or `-1` if the predicate never succeeds.
   * @param predicate Receives the value, index and this replica in ascending index order.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
  findIndex(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): number {
    return this.findPosition(predicate, thisArg, false)
  }

  /**
   * Returns the last matching index, or `-1` if the predicate never succeeds.
   * @param predicate Receives the value, index and this replica in descending index order.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
  findLastIndex(
    predicate: (value: T, index: number, array: this) => unknown,
    thisArg?: unknown
  ): number {
    return this.findPosition(predicate, thisArg, true)
  }

  /**
   * Returns the first element accepted by a type-guard predicate, or `undefined`.
   * @param predicate Receives the value, index and this replica in ascending index order.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
  find<S extends T>(
    predicate: (value: T, index: number, array: this) => value is S,
    thisArg?: unknown
  ): S | undefined
  /**
   * Returns the first element with a truthy predicate result, or `undefined`.
   * @param predicate Receives the value, index and this replica in ascending index order.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
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

  /**
   * Returns the last element accepted by a type-guard predicate, or `undefined`.
   * @param predicate Receives the value, index and this replica in descending index order.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
  findLast<S extends T>(
    predicate: (value: T, index: number, array: this) => value is S,
    thisArg?: unknown
  ): S | undefined
  /**
   * Returns the last element with a truthy predicate result, or `undefined`.
   * @param predicate Receives the value, index and this replica in descending index order.
   * @param thisArg The callback's `this` value.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the predicate is not callable.
   */
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

  /** Reduces visited values in the chosen direction and handles an omitted initial value. */
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
      throw new SequencedError(
        'REDUCE_EMPTY_ARRAY',
        'Reduce of empty array with no initial value'
      )
    return result
  }

  /**
   * Reduces elements from left to right, using the first element as the initial accumulator.
   * @param callback Receives the accumulator, value, index and this replica.
   * @returns The final accumulator.
   * @throws {SequencedError} With code `REDUCE_EMPTY_ARRAY` if no element exists,
   * or `INVALID_CALLBACK` if the callback is not callable.
   */
  reduce(callback: (previous: T, value: T, index: number, array: this) => T): T
  /**
   * Reduces elements from left to right, starting with the supplied accumulator.
   * @param callback Receives the accumulator, value, index and this replica.
   * @param initial The initial accumulator, also returned for an empty array.
   * @returns The final accumulator.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the callback is not callable.
   */
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

  /**
   * Reduces elements from right to left, using the last element as the initial accumulator.
   * @param callback Receives the accumulator, value, index and this replica.
   * @returns The final accumulator.
   * @throws {SequencedError} With code `REDUCE_EMPTY_ARRAY` if no element exists,
   * or `INVALID_CALLBACK` if the callback is not callable.
   */
  reduceRight(
    callback: (previous: T, value: T, index: number, array: this) => T
  ): T
  /**
   * Reduces elements from right to left, starting with the supplied accumulator.
   * @param callback Receives the accumulator, value, index and this replica.
   * @param initial The initial accumulator, also returned for an empty array.
   * @returns The final accumulator.
   * @throws {SequencedError} With code `INVALID_CALLBACK` if the callback is not callable.
   */
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

  /** Returns a live iterator over visible values in ascending index order. */
  *values(): ArrayIterator<T> {
    for (let index = 0; index < this.length; index++)
      yield this.#value(index) as T
  }

  /** Returns a live iterator over the visible, zero-based indices. */
  *keys(): ArrayIterator<number> {
    for (let index = 0; index < this.length; index++) yield index
  }

  /** Returns a live iterator of `[index, value]` pairs in ascending index order. */
  *entries(): ArrayIterator<[number, T]> {
    for (let index = 0; index < this.length; index++)
      yield [index, this.#value(index) as T]
  }

  /** Returns the same live value iterator as `values()`. */
  [Symbol.iterator](): ArrayIterator<T> {
    return this.values()
  }

  /**
   * Applies incoming gossip and emits visible changes and any reply gossip.
   * @param delta The received replication data. Sequencer handles transport validation.
   * @remarks This method does not throw.
   */
  apply(delta: unknown): void {
    try {
      this.received(this.projection.apply(delta))
    } catch {}
  }

  /**
   * Merges another replica's complete sequence and emits the resulting events.
   * @param snapshot The received replication state. Sequencer handles transport validation.
   * @remarks This method does not throw.
   */
  merge(snapshot: unknown): void {
    try {
      this.received(this.projection.merge(snapshot))
    } catch {}
  }

  /** Dispatches visible splices and reply gossip returned by the projection. */
  private received(result: Result<T> | undefined): void {
    if (!result) return
    if (result[0].length) this.dispatchEvent('change', result[0])
    if (result[1]?.length) this.dispatchEvent('delta', result[1])
  }

  /** Synchronously emits a `snapshot` event containing the current replication state. */
  snapshot(): void {
    this.dispatchEvent('snapshot', this.toJSON())
  }

  /**
   * Returns the complete replication state, including retained history.
   * @returns Structural metadata as a numeric array and the retained element data.
   * Used automatically by `JSON.stringify()`.
   */
  toJSON(): SequencedArraySnapshot<T> {
    try {
      const [meta, values] = this.projection.sequence()
      return [Array.isArray(meta) ? meta : Array.from(meta), values]
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.toJSON()')
    }
  }

  /** Releases the replica's native sequence state. */
  destroy(): void {
    try {
      this.projection.destroy()
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.destroy()')
    }
  }

  /** Returns a plain array of visible values for Node.js console inspection. */
  [Symbol.for('nodejs.util.inspect.custom')](): T[] {
    return this.#values()
  }
  /** Returns a plain array of visible values for Deno console inspection. */
  [Symbol.for('Deno.customInspect')](): T[] {
    return this.#values()
  }

  /**
   * Registers a callback or listener object for a typed collection event.
   * @param type The event name.
   * @param listener The listener to register; `null` is ignored.
   * @param options A capture flag or options such as `once` and `signal`.
   */
  addEventListener<K extends keyof SequencedArrayEventMap<T>>(
    type: K,
    listener: SequencedArrayEventListenerFor<T, K> | null,
    options?: boolean | AddEventListenerOptions
  ): void {
    try {
      ;(this.eventTarget ??= new EventTarget()).addEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.addEventListener()')
    }
  }

  /**
   * Removes a listener with the matching event name, identity and capture flag.
   * @param type The event name.
   * @param listener The previously registered listener.
   * @param options The capture flag, directly or within listener options.
   */
  removeEventListener<K extends keyof SequencedArrayEventMap<T>>(
    type: K,
    listener: SequencedArrayEventListenerFor<T, K> | null,
    options?: boolean | EventListenerOptions
  ): void {
    try {
      this.eventTarget?.removeEventListener(
        type,
        listener as EventListenerOrEventListenerObject | null,
        options
      )
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.removeEventListener()')
    }
  }

  /**
   * Synchronously dispatches a typed `CustomEvent` to registered listeners.
   * @param type The event name.
   * @param detail The value exposed as `event.detail`.
   */
  dispatchEvent<K extends keyof SequencedArrayEventMap<T>>(
    type: K,
    detail: SequencedArrayEventMap<T>[K]
  ): void {
    try {
      this.eventTarget?.dispatchEvent(new CustomEvent(type, { detail }))
    } catch (cause) {
      throw unknownError(cause, 'SequencedArray.dispatchEvent()')
    }
  }
}
