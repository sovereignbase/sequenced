import { SequencedArray } from './SequencedArray/class.js'
import { SequencedMap } from './SequencedMap/class.js'
import { SequencedSet } from './SequencedSet/class.js'
import { SequencedText } from './SequencedText/class.js'
import { SequencedTuple } from './SequencedTuple/class.js'

export type * from './.types/type.js'
export type * from './SequencedArray/class.js'
export type * from './SequencedMap/class.js'
export type * from './SequencedSet/class.js'
export type * from './SequencedText/class.js'
export type * from './SequencedTuple/class.js'

export { SequencedError, type SequencedErrorCode } from './.errors/class.js'

/** Provides constructors for replicated text, array and map collections. */
export class Sequenced {
  /** Creates a dense array with Array instance methods and replication events. */
  static readonly Array = SequencedArray
  /** Creates a map whose keys are strings or finite numbers. */
  static readonly Map = SequencedMap
  /** Creates a set whose values are strings or finite numbers. */
  static readonly Set = SequencedSet
  /** Creates a text document whose positions are UTF-16 code unit offsets. */
  static readonly Text = SequencedText
  /** */
  static readonly Tuple = SequencedTuple
}

export { base64urlToActorID } from './utils/base64urlToActorID.js'
