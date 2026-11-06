// Coinbase Exchange: velas de 1 minuto pedidas directo por el navegador del usuario.
// Docs: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles
// Máximo 300 velas por petición; límite público ~10 peticiones por segundo.

import { DAY_MS } from '../config'
import { type Candle, type FetchOpts, sleep } from './types'

const BASE = 'https://api.exchange.coinbase.com/products'
const CHUNK_MIN = 300
const GAP_MS = 150

export const COINBASE_MARKETS = [
  { id: 'BTC-USD', label: 'BTC/USD' },
  { id: 'ETH-USD', label: 'ETH/USD' },
] as const

export interface CoinbaseDayResult {
  candles: Candle[]
  requests: number
  elapsedMs: number
  complete: boolean
}

export async function coinbaseCandles1mDay(
  product: string,
  dayStartMs: number,
  { signal, onProgress }: FetchOpts = {},
): Promise<CoinbaseDayResult> {
  const dayEnd = Math.min(dayStartMs + DAY_MS, Date.now())
  const t0 = performance.now()
  const byTime = new Map<number, Candle>()
  let requests = 0

  for (let start = dayStartMs; start < dayEnd; start += CHUNK_MIN * 60_000) {
    if (requests > 0) await sleep(GAP_MS, signal)
    const end = Math.min(start + (CHUNK_MIN - 1) * 60_000, dayEnd - 60_000)
    const url =
      `${BASE}/${product}/candles?granularity=60` + `&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`

    let res = await fetch(url, { signal })
    requests++
    if (res.status === 429) {
      await sleep(1500, signal)
      res = await fetch(url, { signal })
      requests++
    }
    if (!res.ok) throw new Error(`Coinbase respondió HTTP ${res.status}`)

    // [tiempo (s), mínimo, máximo, apertura, cierre, volumen], del más nuevo al más viejo
    const rows = (await res.json()) as [number, number, number, number, number, number][]
    for (const [ts, l, h, o, c, v] of rows) {
      const t = ts * 1000
      if (t >= dayStartMs && t < dayStartMs + DAY_MS) byTime.set(t, { t, o, h, l, c, v })
    }
    onProgress?.({
      requests,
      items: byTime.size,
      coveredMs: Math.min(end + 60_000, dayEnd) - dayStartMs,
      totalMs: dayEnd - dayStartMs,
      elapsedMs: performance.now() - t0,
      waitingMs: 0,
    })
  }

  return {
    candles: [...byTime.values()].sort((a, b) => a.t - b.t),
    requests,
    elapsedMs: performance.now() - t0,
    complete: dayStartMs + DAY_MS <= Date.now(),
  }
}
