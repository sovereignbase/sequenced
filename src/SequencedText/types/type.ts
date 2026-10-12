import type { Gossip, U32List } from '@sovereignbase/sequencer'

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
  snapshot: SequencedTextSnapshot

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
