import { parentPort, workerData } from 'node:worker_threads'
import { scenario } from './scenario.mjs'
parentPort.postMessage(scenario(workerData))
