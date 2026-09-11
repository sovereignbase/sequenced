/**Replica State*/

/**
 * Represents the internal replicated state for a single field.
 */
export type CRStructStateEntry<V> = {
  /**
   * The identifier of the current winning value.
   */
  uuidv7: string

  /**
   * The current winning value.
   */
  value: V

  /**
   * The predecessor identifier for the current winning value.
   */
  predecessor: string

  /**
   * Identifiers known to have been overwritten for the field.
   */
  tombstones: Set<string>
}

/**
 * Represents the internal replicated state of a CR-Struct replica.
 */
export type CRStructState<T extends Record<string, unknown>> = {
  entries: { [K in keyof T]: CRStructStateEntry<T[K]> }
  defaults: T
}

/**Serlialized projection of replica state*/

/**
 * Represents the serialized state for a single field.
 */
export type CRStructSnapshotEntry<V> = {
  /**
   * The identifier of the current winning value.
   */
  uuidv7: string

  /**
   * The serialized current winning value.
   */
  value: V

  /**
   * The predecessor identifier for the current winning value.
   */
  predecessor: string

  /**
   * Serialized overwritten identifiers for the field.
   */
  tombstones: Array<string>
}

/**
 * Represents a serialized snapshot of the full replica state.
 */
export type CRStructSnapshot<T extends Record<string, unknown>> = {
  [K in keyof T]: CRStructSnapshotEntry<T[K]>
}

/**Resolved projection of replica state*/

/**
 * Represents visible field values that changed during a local operation or merge.
 */
export type CRStructChange<T extends Record<string, unknown>> = Partial<T>
/**(T)*/

/**Partial changes to gossip*/

/**
 * Represents a partial serialized state projection exchanged between replicas.
 */
export type CRStructDelta<T extends Record<string, unknown>> = Partial<
  CRStructSnapshot<T>
>

/**A "report" on what the replica has seen*/

/**
 * Represents the current acknowledgement frontier emitted by a replica.
 */
export type CRStructAck<T extends Record<string, unknown>> = Partial<
  Record<keyof T, string>
>

/***/

/**
 * Maps CR-Struct event names to their event payload shapes.
 */
export type CRStructEventMap<T extends Record<string, unknown>> = {
  /** STATE / PROJECTION */
  snapshot: CRStructSnapshot<T>
  change: CRStructChange<T>

  /** GOSSIP / PROTOCOL */
  delta: CRStructDelta<T>
  ack: CRStructAck<T>
}

/**
 * Represents a strongly typed CR-Struct event listener.
 */
export type CRStructEventListener<
  T extends Record<string, unknown>,
  K extends keyof CRStructEventMap<T>,
> =
  | ((event: CustomEvent<CRStructEventMap<T>[K]>) => void)
  | { handleEvent(event: CustomEvent<CRStructEventMap<T>[K]>): void }

/**
 * Resolves an event name to its corresponding listener type.
 */
export type CRStructEventListenerFor<
  T extends Record<string, unknown>,
  K extends string,
> = K extends keyof CRStructEventMap<T>
  ? CRStructEventListener<T, K>
  : EventListenerOrEventListenerObject
