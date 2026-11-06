// Kraken: el navegador del usuario pide los trades directo a la API pública.
// La app no guarda ni sirve estos datos.
// Docs: https://docs.kraken.com/api/docs/rest-api/get-recent-trades
// Límite seguro para Trades: 1 petición por segundo por IP y por par.

import { DAY_MS } from '../config'
import { type FetchOpts, sleep, TapeBuilder, type TradeTape } from './types'

const TRADES_URL = 'https://api.kraken.com/0/public/Trades'
const PAGE = 1000
const GAP_MS = 1050

export const KRAKEN_MARKETS = [
  { id: 'XBTUSD', label: 'BTC/USD' },
  { id: 'ETHUSD', label: 'ETH/USD' },
] as const

// [precio, volumen, tiempo (s), lado b/s, tipo m/l, misc, id]
type KrakenRow = [string, string, number, 'b' | 's', string, string, number]
interface KrakenResp {
  error: string[]
  result?: Record<string, KrakenRow[] | string> & { last: string }
}

export interface KrakenDayResult {
  tape: TradeTape
  requests: number
  elapsedMs: number
  complete: boolean
}

export async function krakenTradesDay(
  pair: string,
  dayStartMs: number,
  { signal, onProgress }: FetchOpts = {},
): Promise<KrakenDayResult> {
  const dayEnd = dayStartMs + DAY_MS
  const t0 = performance.now()
  const builder = new TapeBuilder()
  // `since` acepta nanosegundos; así no perdemos los trades del primer segundo.
  let since = (BigInt(Math.floor(dayStartMs)) * 1_000_000n).toString()
  let lastId = -1
  let lastTime = dayStartMs
  let requests = 0
  let retries = 0
  let lastStart = 0
  let done = false

  const report = (waitingMs = 0) =>
    onProgress?.({
      requests,
      items: builder.n,
      coveredMs: Math.min(lastTime, dayEnd) - dayStartMs,
      totalMs: Math.min(dayEnd, Date.now()) - dayStartMs,
      elapsedMs: performance.now() - t0,
      waitingMs,
    })

  while (!done) {
    const wait = lastStart + GAP_MS - performance.now()
    if (wait > 0) await sleep(wait, signal)
    lastStart = performance.now()

    const res = await fetch(`${TRADES_URL}?pair=${pair}&since=${since}&count=${PAGE}`, { signal })
    requests++

    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && retries < 8) {
        retries++
        report(2000 * retries)
        await sleep(2000 * retries, signal)
        continue
      }
      throw new Error(`Kraken respondió HTTP ${res.status}`)
    }

    const json = (await res.json()) as KrakenResp
    if (json.error?.length) {
      const msg = json.error.join(', ')
      if (/rate limit|too many/i.test(msg) && retries < 8) {
        retries++
        report(2000 * retries)
        await sleep(2000 * retries, signal)
        continue
      }
      throw new Error(`Kraken: ${msg}`)
    }
    retries = 0

    const result = json.result!
    const key = Object.keys(result).find((k) => k !== 'last')
    const rows = (key ? result[key] : []) as KrakenRow[]

    for (const r of rows) {
      const id = r[6]
      if (id <= lastId) continue // por si una página repite el último trade
      lastId = id
      const tm = r[2] * 1000
      if (tm < dayStartMs) continue
      if (tm >= dayEnd) {
        done = true
        break
      }
      builder.push(tm, +r[0], +r[1], r[3] === 'b' ? 1 : -1)
      lastTime = tm
    }

    since = result.last
    // Menos de una página completa = llegamos al trade más reciente que existe.
    if (rows.length < PAGE) done = true
    report()
  }

  return {
    tape: builder.finish('kraken', pair),
    requests,
    elapsedMs: performance.now() - t0,
    complete: dayEnd <= Date.now(),
  }
}
