import { SequencedArray } from '../../src/SequencedArray/class.js'
import { runBenchmarks } from '../runner.js'
import * as workloads from './workloads.js'

runBenchmarks('Array', SequencedArray, workloads)
