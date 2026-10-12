import type { Gossip, U32List } from '@sovereignbase/sequencer'

/**
 * Represents a text document's replication state as structural metadata and
 * concatenated UTF-16 content. The metadata preserves ordering and causality.
 *
 * Snapshots returned by `toJSON()` use a numeric array for the metadata.
 */
export type SequencedTextSnapshot = Readonly<[meta: U32List, data: string]>

/**
 * Represents an ordered list of edits to the visible text.
 *
 * Each edit replaces the half-open range `[selectionStart, selectionEnd)` with
 * `characters`, or removes the range when `characters` is omitted. Equal start
 * and end positions represent an insertion. Positions are UTF-16 code unit
 * offsets into the text as it exists immediately before each edit is applied.
 */
export type SequencedTextChange = ReadonlyArray<
  Readonly<[selectionStart: number, selectionEnd: number, characters?: string]>
>

/**
 * Maps document event names to their `CustomEvent.detail` payloads.
 */
export type SequencedTextEventMap = {
  /**
   * Dispatched by `snapshot()` with the document's replication state.
   */
  snapshot: SequencedTextSnapshot

  /**
   * Dispatched with ordered edits to the visible text. The list may be empty
   * when applied or merged state leaves the visible text unchanged.
   */
  change: SequencedTextChange

  /**
   * Dispatched with gossip produced by a local edit or as a reply to applied
   * or merged state. Inserted content is represented as UTF-16 code units.
   */
  delta: Gossip<string>
}

/**
 * Represents a callback or listener object for the specified document event.
 *
 * @typeParam K The event name that determines the event's `detail` type.
 */
export type SequencedTextEventListener<K extends keyof SequencedTextEventMap> =
  | ((event: CustomEvent<SequencedTextEventMap[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedTextEventMap[K]>): void }

/**
 * Resolves a document event name to its typed listener, or uses a DOM event
 * listener for an unrecognized event name.
 *
 * @typeParam K The event name to resolve.
 */
export type SequencedTextEventListenerFor<K extends string> =
  K extends keyof SequencedTextEventMap
    ? SequencedTextEventListener<K>
    : EventListenerOrEventListenerObject
