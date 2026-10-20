import { expect } from '@playwright/test'
import type { Browser } from '@playwright/test'
import { WebSocketServer, WebSocket as RelaySocket } from 'ws'
import type { Model } from './portable.ts'

export async function runEditors(
  browser: Browser,
  model: Model,
  transport: 'p2p' | 'ws'
): Promise<void> {
  const relay =
    transport === 'ws'
      ? new WebSocketServer({ host: '127.0.0.1', port: 0 })
      : undefined
  if (relay) {
    relay.on('connection', (client) =>
      client.on('message', (packet, binary) => {
        for (const peer of relay.clients)
          if (peer !== client && peer.readyState === RelaySocket.OPEN)
            peer.send(packet, { binary })
      })
    )
    await new Promise<void>((resolve) => relay.once('listening', resolve))
  }
  const address = relay?.address()
  const url =
    address && typeof address !== 'string'
      ? `ws://127.0.0.1:${address.port}`
      : ''
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4174' })
  try {
    const pages = await Promise.all([0, 1, 2].map(() => context.newPage()))
    const channel = `sequenced-${model}-${Date.now()}`
    await Promise.all(
      pages.map(async (page, editor) => {
        await page.goto('/')
        await page.evaluate(
          async ({ model, transport, editor, channel, url }) => {
            const { Sequenced } = await import(
              new URL('/dist/index.js', location.href).href
            )
            const Constructor =
              Sequenced[
                model === 'array' ? 'Array' : model === 'map' ? 'Map' : 'Text'
              ]
            const subject = new Constructor(editor + 1)
            subject.apply([[1], [2], [3]])
            const outgoing: unknown[] = [],
              incoming: unknown[] = []
            const runtime = {
              subject,
              outgoing,
              incoming,
              edits: 0,
              localChecks: 0,
              changeChecks: 0,
              sent: 0,
              received: 0,
              lastActivity: Date.now(),
              errors: [] as string[],
              view:
                model === 'array'
                  ? []
                  : model === 'map'
                    ? new Map()
                    : ('' as any),
              read: (): any =>
                model === 'text' ? subject.toString() : [...subject],
            }
            ;(window as any).editor = runtime
            const equal = (left: unknown, right: unknown) => {
              if (JSON.stringify(left) !== JSON.stringify(right))
                throw new Error(
                  `View mismatch: ${JSON.stringify(left)} != ${JSON.stringify(right)}`
                )
            }
            const checkView = () => {
              const observed =
                model === 'map'
                  ? [...runtime.view].sort(([a], [b]) => a.localeCompare(b))
                  : runtime.view
              const expected =
                model === 'map'
                  ? runtime
                      .read()
                      .sort(([a]: [string, unknown], [b]: [string, unknown]) =>
                        a.localeCompare(b)
                      )
                  : runtime.read()
              equal(observed, expected)
              if (model === 'array') {
                equal(subject.length, expected.length)
                expected.forEach((value: unknown, index: number) =>
                  equal(subject.get(index), value)
                )
              } else if (model === 'map') {
                equal(subject.size, expected.length)
                expected.forEach(([key, value]: [string, unknown]) => {
                  equal(subject.has(key), true)
                  equal(subject.get(key), value)
                })
              } else equal(subject.length, expected.length)
            }
            subject.addEventListener(
              'change',
              ({ detail }: CustomEvent<any>) => {
                try {
                  if (model === 'map') {
                    for (const key of Object.keys(detail))
                      if (detail[key] === undefined) runtime.view.delete(key)
                      else runtime.view.set(key, detail[key])
                  } else
                    for (const [start, end, values] of detail) {
                      if (model === 'array')
                        runtime.view.splice(
                          start,
                          end - start,
                          ...(values ?? [])
                        )
                      else
                        runtime.view =
                          runtime.view.slice(0, start) +
                          (values ?? '') +
                          runtime.view.slice(end)
                    }
                  checkView()
                  runtime.changeChecks++
                } catch (error) {
                  runtime.errors.push(String(error))
                }
              }
            )
            subject.addEventListener(
              'delta',
              ({ detail }: CustomEvent<unknown>) => {
                outgoing.push(JSON.parse(JSON.stringify(detail)))
                runtime.lastActivity = Date.now()
              }
            )
            const wire =
              transport === 'p2p'
                ? new BroadcastChannel(channel)
                : new WebSocket(url)
            if (wire instanceof WebSocket)
              await new Promise<void>((resolve, reject) => {
                wire.onopen = () => resolve()
                wire.onerror = () =>
                  reject(new Error('WebSocket connection failed'))
              })
            wire.onmessage = (event) => {
              incoming.push(
                transport === 'ws' ? JSON.parse(event.data) : event.data
              )
              runtime.lastActivity = Date.now()
            }
            setInterval(
              () => {
                try {
                  for (const packet of outgoing.splice(0)) {
                    if (wire instanceof WebSocket)
                      wire.send(JSON.stringify(packet))
                    else wire.postMessage(packet)
                    runtime.sent++
                    runtime.lastActivity = Date.now()
                  }
                  for (const packet of incoming.splice(0)) {
                    subject.apply(packet)
                    runtime.received++
                    runtime.lastActivity = Date.now()
                    checkView()
                  }
                } catch (error) {
                  runtime.errors.push(String(error))
                }
              },
              7 + editor * 4
            )
          },
          { model, transport, editor, channel, url }
        )
      })
    )
    await Promise.all(
      pages.map((page, editor) =>
        page.evaluate(
          ({ model, editor }) => {
            const runtime = (window as any).editor
            const timer = setInterval(
              () => {
                try {
                  const { subject } = runtime
                  const step = runtime.edits,
                    value = `${editor}:${step}`
                  if (model === 'array') {
                    const expected = [...subject],
                      at = (step + editor) % Math.max(1, expected.length)
                    if (step % 3 === 0 || !expected.length) {
                      subject.push(value)
                      expected.push(value)
                    } else if (step % 3 === 1) {
                      subject.set(at, value)
                      expected[at] = value
                    } else {
                      subject.delete(at)
                      expected.splice(at, 1)
                    }
                    if (
                      JSON.stringify([...subject]) !== JSON.stringify(expected)
                    )
                      throw new Error('Local Array differs from native Array')
                  } else if (model === 'map') {
                    const expected = new Map(subject),
                      key =
                        step % 3 === 0
                          ? `${editor}:${step}`
                          : `shared:${step % 2}`
                    if (step % 3 === 2) {
                      if (subject.delete(key) !== expected.delete(key))
                        throw new Error(
                          'Local Map.delete differs from native Map'
                        )
                    } else {
                      subject.set(key, value)
                      expected.set(key, value)
                    }
                    if (
                      JSON.stringify([...subject]) !==
                      JSON.stringify([...expected])
                    )
                      throw new Error('Local Map differs from native Map')
                  } else {
                    let expected = subject.toString()
                    const at = (step + editor) % (expected.length + 1)
                    if (step % 3 === 0 || !expected.length) {
                      subject.insert(at, value)
                      expected =
                        expected.slice(0, at) + value + expected.slice(at)
                    } else if (step % 3 === 1) {
                      subject.replace(
                        at,
                        Math.min(at + 1, expected.length),
                        value
                      )
                      expected =
                        expected.slice(0, at) + value + expected.slice(at + 1)
                    } else {
                      subject.remove(at, Math.min(at + 1, expected.length))
                      expected = expected.slice(0, at) + expected.slice(at + 1)
                    }
                    if (subject.toString() !== expected)
                      throw new Error('Local Text differs from typed text')
                  }
                  runtime.localChecks++
                } catch (error) {
                  runtime.errors.push(String(error))
                } finally {
                  if (++runtime.edits === 18) clearInterval(timer)
                }
              },
              11 + editor * 6
            )
          },
          { model, editor }
        )
      )
    )
    await expect
      .poll(
        async () =>
          Promise.all(
            pages.map((page) =>
              page.evaluate(() => {
                const state = (window as any).editor
                return (
                  state.edits === 18 &&
                  !state.outgoing.length &&
                  !state.incoming.length &&
                  Date.now() - state.lastActivity > 150
                )
              })
            )
          ),
        { timeout: 15_000 }
      )
      .toEqual([true, true, true])
    const results = await Promise.all(
      pages.map((page) =>
        page.evaluate(() => {
          const state = (window as any).editor
          return {
            value: state.read(),
            edits: state.edits,
            checks: state.localChecks,
            changes: state.changeChecks,
            sent: state.sent,
            received: state.received,
            errors: state.errors,
          }
        })
      )
    )
    for (const result of results) {
      expect(result.errors).toEqual([])
      expect(result.edits).toBe(18)
      expect(result.checks).toBe(18)
      expect(result.changes).toBeGreaterThan(0)
      expect(result.sent).toBeGreaterThan(0)
      expect(result.received).toBeGreaterThan(0)
      expect(result.value).toEqual(results[0].value)
    }
  } finally {
    await context.close()
    if (relay) {
      for (const client of relay.clients) client.terminate()
      await new Promise<void>((resolve, reject) =>
        relay.close((error) => (error ? reject(error) : resolve()))
      )
    }
  }
}
