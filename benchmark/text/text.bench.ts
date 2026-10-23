import { SequencedText } from '../../src/SequencedText/class.js'
import { runBenchmarks } from '../runner.js'
import * as workloads from './workloads.js'

runBenchmarks('Text', SequencedText, workloads)
