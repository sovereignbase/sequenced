import type { Gossip, Sequence, U32List } from '@sovereignbase/sequencer'

export type SequencedTextSnapshot = Readonly<[meta: U32List, data: string]>

export type SequencedTextChange = ReadonlyArray<
  Readonly<[selectionStart: number, selectionEnd: number, characters?: string]>
>

/**
 * Maps `SequencedText` event names to their corresponding `CustomEvent.detail` payloads.
 */
export type SequencedTextEventMap = {
  /**
   * Fired after `snapshot()` materializes a detached snapshot.
   */
  snapshot: Sequence<string>

  /**
   * Fired after local or merged operations change the visible text projection.
   */
  change: SequencedTextChange

  /**
   * Fired after a local edit produces a replicable delta payload.
   */
  delta: Gossip<string>
}

/**
 * Represents a strongly typed `SequencedText` event listener.
 */
export type SequencedTextEventListener<K extends keyof SequencedTextEventMap> =
  | ((event: CustomEvent<SequencedTextEventMap[K]>) => void)
  | { handleEvent(event: CustomEvent<SequencedTextEventMap[K]>): void }

/**
 * Resolves an event name to its corresponding listener type.
 */
export type SequencedTextEventListenerFor<K extends string> =
  K extends keyof SequencedTextEventMap
    ? SequencedTextEventListener<K>
    : EventListenerOrEventListenerObject

/**
 * Describes a linear text selection in UTF-16 code unit offsets.
 */
export type TextSelection = {
  /**
   * The inclusive selection anchor offset.
   */
  selectionStart: number

  /**
   * The exclusive selection focus offset.
   */
  selectionEnd: number
}

/**
 * Describes a text insertion derived from DOM editing input.
 */
export type InsertOperation = {
  /**
   * The insertion offset in the current text projection.
   */
  index: number

  /**
   * The characters to insert.
   */
  characters: string
}

/**
 * Describes a text removal derived from DOM editing input.
 */
export type RemoveOperation = {
  /**
   * The first offset to remove.
   */
  index: number

  /**
   * The number of characters to remove.
   */
  removeCount: number
}

/**
 * Represents the CR-Text operations translated from a single DOM input event.
 */
export type DOMTranslation = {
  /**
   * The translated insertion operation, if any.
   */
  insert: InsertOperation | false

  /**
   * The translated removal operation, if any.
   */
  remove: RemoveOperation | false
}
