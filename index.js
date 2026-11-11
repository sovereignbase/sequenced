import { Sequenced } from './dist/index.js'

const tuple = new Sequenced.Tuple(0, [
  'ossi',
  false,
  10,
  { markku: 'jaakoppi' },
])

console.log(tuple)

tuple.set(1, true)

console.log(tuple)
