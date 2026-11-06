import type { Candle, TradeTape } from '../data/types'

export interface DayStats {
  open: number
  high: number
  low: number
  close: number
  volume: number
  buyPct: number | null // solo con trades (lado conocido)
  firstT: number
  lastT: number
  memoryBytes: number
  /** Cierre por minuto, para la gráfica chiquita. */
  line: { t: number; c: number }[]
}

export function tapeStats(tape: TradeTape): DayStats | null {
  const { n, t, p, q, s } = tape
  if (n === 0) return null
  let high = -Infinity
  let low = Infinity
  let volume = 0
  let buyVol = 0
  const line: { t: number; c: number }[] = []
  let minute = -1
  for (let i = 0; i < n; i++) {
    const price = p[i]
    if (price > high) high = price
    if (price < low) low = price
    volume += q[i]
    if (s[i] === 1) buyVol += q[i]
    const m = Math.floor(t[i] / 60_000)
    if (m !== minute) {
      line.push({ t: m * 60_000, c: price })
      minute = m
    } else {
      line[line.length - 1].c = price
    }
  }
  return {
    open: p[0],
    high,
    low,
    close: p[n - 1],
    volume,
    buyPct: volume > 0 ? (buyVol / volume) * 100 : null,
    firstT: t[0],
    lastT: t[n - 1],
    memoryBytes: n * (8 + 8 + 8 + 1),
    line,
  }
}

export function candleStats(candles: Candle[]): DayStats | null {
  if (candles.length === 0) return null
  let high = -Infinity
  let low = Infinity
  let volume = 0
  for (const k of candles) {
    if (k.h > high) high = k.h
    if (k.l < low) low = k.l
    volume += k.v
  }
  return {
    open: candles[0].o,
    high,
    low,
    close: candles[candles.length - 1].c,
    volume,
    buyPct: null,
    firstT: candles[0].t,
    lastT: candles[candles.length - 1].t,
    memoryBytes: candles.length * 6 * 8,
    line: candles.map((k) => ({ t: k.t, c: k.c })),
  }
}
