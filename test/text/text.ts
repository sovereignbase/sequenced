import { Projection } from '@sovereignbase/sequencer'
import { SequencedText } from '../../src/SequencedText/class.js'
import type { SequencedTextSnapshot } from '../../src/SequencedText/types/type.js'

export { SequencedText }

export function textSnapshot(value: string): SequencedTextSnapshot {
  const projection = new Projection<string>(100)
  try {
    if (value.length) projection.insert(value.split(''), 0)
    return projection.sequence(true)
  } finally {
    projection.destroy()
  }
}

/** Test/benchmark cleanup only: Text currently has no public disposal method. */
export function releaseText(text: SequencedText): void {
  const projection: Projection<string> = Object.getOwnPropertyDescriptor(
    text,
    'projection'
  )!.value
  projection.destroy()
}

export function editText(
  value: string,
  start: number,
  end: number,
  inserted = ''
): string {
  return value.slice(0, start) + inserted + value.slice(end)
}
