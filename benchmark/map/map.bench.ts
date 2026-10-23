import { SequencedMap } from '../../src/SequencedMap/class.js'
import { runBenchmarks } from '../runner.js'
import * as workloads from './workloads.js'

runBenchmarks('Map', SequencedMap, workloads)
