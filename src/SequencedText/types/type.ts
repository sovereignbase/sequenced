import type {
  CRListSnapshot,
  CRListChange,
  CRListAck,
  CRListState,
} from '@sovereignbase/convergent-replicated-list'

/** CRText specific alias for CRListState */
export type CRTextState = CRListState<string>
/** CRText specific alias for CRListSnapshot */
export type CRTextSnapshot = CRListSnapshot<string>
/** CRText specific alias for CRListChange */
export type CRTextChange = CRListChange<string>
/** Partial CRTextSnapshot */
export type CRTextDelta = Partial<CRTextSnapshot>
/** CRText specific alias for CRListAck */
export type CRTextAck = CRListAck

/**
 * Maps `CRText` event names to their corresponding `CustomEvent.detail` payloads.
 */
export type CRTextEventMap = {
  /**
   * Fired after `snapshot()` materializes a detached snapshot.
   */
  snapshot: CRTextSnapshot

  /**
   * Fired after local or merged operations change the visible text projection.
   */
  change: CRTextChange

  /**
   * Fired after a local edit produces a replicable delta payload.
   */
  delta: CRTextDelta

  /**
   * Fired after `acknowledge()` yields a frontier acknowledgement.
   */
  ack: CRTextAck
}

/**
 * Represents a strongly typed `CRText` event listener.
 */
export type CRTextEventListener<K extends keyof CRTextEventMap> =
  | ((event: CustomEvent<CRTextEventMap[K]>) => void)
  | { handleEvent(event: CustomEvent<CRTextEventMap[K]>): void }

/**
 * Resolves an event name to its corresponding listener type.
 */
export type CRTextEventListenerFor<K extends string> =
  K extends keyof CRTextEventMap
    ? CRTextEventListener<K>
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
