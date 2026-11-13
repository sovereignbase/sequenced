import { SequencedArray } from './SequencedArray/class.js'
import { SequencedMap } from './SequencedMap/class.js'
import { SequencedRegister } from './SequencedRegister/class.js'
import { SequencedStruct } from './SequencedStruct/class.js'
import { SequencedText } from './SequencedText/class.js'
import { SequencedTuple } from './SequencedTuple/class.js'

export type {
  SequencedArray,
  SequencedMap,
  SequencedRegister,
  SequencedStruct,
  SequencedText,
  SequencedTuple,
}

export { SequencedError, type SequencedErrorCode } from './errors/class.js'

export type * from './SequencedMap/types/type.js'
export type * from './SequencedArray/types/type.js'
export type * from './SequencedRegister/types/type.js'
export type * from './SequencedStruct/types/type.js'
export type * from './SequencedText/types/type.js'
export type * from './SequencedTuple/types/type.js'

/** Provides constructors for replicated text, array and map collections. */
export class Sequenced {
  /** Creates a dense array with Array instance methods and replication events. */
  static readonly Array = SequencedArray
  /** Creates a map whose keys are strings or finite numbers. */
  static readonly Map = SequencedMap
  /** */
  static readonly Register = SequencedRegister
  /** */
  static readonly Struct = SequencedStruct
  /** Creates a text document whose positions are UTF-16 code unit offsets. */
  static readonly Text = SequencedText
  /** */
  static readonly Tuple = SequencedTuple
}

export { base64urlToActorID } from './utils/base64urlToActorID.js'
