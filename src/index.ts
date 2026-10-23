import { SequencedText } from './SequencedText/class.js'
import { SequencedArray } from './SequencedArray/class.js'
import { SequencedMap } from './SequencedMap/class.js'
export type { SequencedArray, SequencedMap, SequencedText }

export { SequencedError, type SequencedErrorCode } from './errors/class.js'

export type {
  SerializableKey,
  SequencedMapEntry,
  SequencedMapChange,
  SequencedMapDelta,
  SequencedMapSnapshot,
  SequencedMapEventMap,
  SequencedMapEventListener,
} from './SequencedMap/types/type.js'
export type {
  SequencedArrayChange,
  SequencedArrayDelta,
  SequencedArraySnapshot,
  SequencedArrayEventMap,
  SequencedArrayEventListener,
  SequencedArrayEventListenerFor,
} from './SequencedArray/types/type.js'
export type {
  SequencedTextChange,
  SequencedTextSnapshot,
  SequencedTextEventMap,
  SequencedTextEventListener,
  SequencedTextEventListenerFor,
} from './SequencedText/types/type.js'

/** Provides constructors for replicated text, array and map collections. */
export class Sequenced {
  /** Creates a text document whose positions are UTF-16 code unit offsets. */
  static readonly Text = SequencedText
  /** Creates a dense array with Array instance methods and replication events. */
  static readonly Array = SequencedArray
  /** Creates a map whose keys are strings or finite numbers. */
  static readonly Map = SequencedMap
}

export { base64urlToActorID } from './utils/base64urlToActorID.js'
