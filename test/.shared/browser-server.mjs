import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const routes = new Map([
  ['/dist/index.js', new URL('../../dist/index.js', import.meta.url)],
  [
    '/sequencer/index.js',
    new URL(
      './dist/index.js',
      pathToFileURL(require.resolve('@sovereignbase/sequencer/package.json'))
    ),
  ],
])
const html =
  '<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"@sovereignbase/sequencer":"/sequencer/index.js"}}</script>'

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1:4174').pathname
  if (path === '/') {
    response.writeHead(200, { 'content-type': 'text/html' }).end(html)
    return
  }
  const file = routes.get(path)
  if (!file) {
    response.writeHead(404).end()
    return
  }
  try {
    response
      .writeHead(200, { 'content-type': 'text/javascript' })
      .end(await readFile(file))
  } catch {
    response
      .writeHead(500)
      .end('Build the package before running browser tests')
  }
}).listen(4174, '127.0.0.1')
