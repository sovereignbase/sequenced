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

export class Sequenced {
  static readonly Text = SequencedText
  static readonly Array = SequencedArray
  static readonly Map = SequencedMap
}

export { base64urlToActorID } from './utils/base64urlToActorID.js'
