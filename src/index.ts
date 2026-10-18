import { SequencedText } from './SequencedText/class.js'
import { SequencedArray } from './SequencedArray/class.js'

export { SequencedArray }
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
}
