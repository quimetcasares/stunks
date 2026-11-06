import { useRef, useState } from 'react'
import { DAY_MS } from '../config'
import { COINBASE_MARKETS, coinbaseCandles1mDay } from '../data/coinbase'
import { KRAKEN_MARKETS, krakenTradesDay } from '../data/kraken'
import type { FetchProgress } from '../data/types'
import { useI18n } from '../i18n'
import { dayStartUtc, fmtInt, fmtMB, fmtNum, fmtSeconds, fmtTimeUtc, isoDay } from '../lib/format'
import { candleStats, type DayStats, tapeStats } from '../lib/stats'
import { Sparkline } from './Sparkline'

type Source = 'kraken' | 'coinbase'

interface RunResult {
  id: number
  source: Source
  marketLabel: string
  day: string
  dayStart: number
  items: number
  requests: number
  elapsedMs: number
  complete: boolean
  stats: DayStats | null
}

type Status =
  | { kind: 'idle' }
  | { kind: 'running'; progress: FetchProgress | null }
  | { kind: 'done'; run: RunResult }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }

const marketsFor = (s: Source) => (s === 'kraken' ? KRAKEN_MARKETS : COINBASE_MARKETS)

export function TechTest() {
  const { t, lang } = useI18n()
  const today = isoDay(Date.now())
  const [source, setSource] = useState<Source>('kraken')
  const [marketIdx, setMarketIdx] = useState(0)
  const [day, setDay] = useState(isoDay(Date.now() - DAY_MS))
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [history, setHistory] = useState<RunResult[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const running = status.kind === 'running'

  async function run() {
    const market = marketsFor(source)[marketIdx]
    const dayStart = dayStartUtc(day)
    if (!Number.isFinite(dayStart)) return
    const ac = new AbortController()
    abortRef.current = ac
    setStatus({ kind: 'running', progress: null })
    const onProgress = (progress: FetchProgress) => setStatus({ kind: 'running', progress })

    try {
      let r: RunResult
      if (source === 'kraken') {
        const res = await krakenTradesDay(market.id, dayStart, { signal: ac.signal, onProgress })
        r = {
          id: Date.now(),
          source,
          marketLabel: market.label,
          day,
          dayStart,
          items: res.tape.n,
          requests: res.requests,
          elapsedMs: res.elapsedMs,
          complete: res.complete,
          stats: tapeStats(res.tape),
        }
      } else {
        const res = await coinbaseCandles1mDay(market.id, dayStart, { signal: ac.signal, onProgress })
        r = {
          id: Date.now(),
          source,
          marketLabel: market.label,
          day,
          dayStart,
          items: res.candles.length,
          requests: res.requests,
          elapsedMs: res.elapsedMs,
          complete: res.complete,
          stats: candleStats(res.candles),
        }
      }
      setStatus({ kind: 'done', run: r })
      setHistory((h) => [r, ...h].slice(0, 20))
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setStatus({ kind: 'cancelled' })
      else setStatus({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    } finally {
      abortRef.current = null
    }
  }

  const progress = status.kind === 'running' ? status.progress : null
  const pct = progress && progress.totalMs > 0 ? Math.min(100, (progress.coveredMs / progress.totalMs) * 100) : 0

  return (
    <section className="card" aria-labelledby="test-title">
      <div className="card-head">
        <h2 id="test-title">{t.testTitle}</h2>
        <span className="pill">{t.phase} 0</span>
      </div>
      <p className="muted">{t.testIntro}</p>

      <div className="controls">
        <label>
          <span>{t.source}</span>
          <select
            value={source}
            disabled={running}
            onChange={(e) => {
              setSource(e.target.value as Source)
              setMarketIdx(0)
            }}
          >
            <option value="kraken">{t.krakenTrades}</option>
            <option value="coinbase">{t.coinbaseCandles}</option>
          </select>
        </label>
        <label>
          <span>{t.market}</span>
          <select value={marketIdx} disabled={running} onChange={(e) => setMarketIdx(+e.target.value)}>
            {marketsFor(source).map((m, i) => (
              <option key={m.id} value={i}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.dayUtc}</span>
          <input
            type="date"
            value={day}
            max={today}
            min="2015-01-01"
            disabled={running}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
        </label>
        <div className="buttons">
          {running ? (
            <button type="button" className="btn ghost" onClick={() => abortRef.current?.abort()}>
              {t.cancel}
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={run} data-testid="download">
              {t.download}
            </button>
          )}
        </div>
      </div>

      {status.kind === 'running' && (
        <div className="progress-block" aria-live="polite">
          <div className="progress">
            <div className="bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-meta">
            <span>
              {progress?.waitingMs ? t.waitingLimit : t.downloading} {fmtNum(pct, lang, 0)}%
            </span>
            <span>
              {fmtInt(progress?.items ?? 0, lang)} {source === 'kraken' ? t.trades : t.candles} ·{' '}
              {fmtInt(progress?.requests ?? 0, lang)} {t.requests.toLowerCase()} · {fmtSeconds(progress?.elapsedMs ?? 0, lang)}
            </span>
          </div>
        </div>
      )}

      {status.kind === 'cancelled' && <p className="note">{t.cancelled}</p>}
      {status.kind === 'error' && (
        <p className="note error">
          {t.error}: {status.message}
        </p>
      )}
      {status.kind === 'done' && <Result run={status.run} />}

      {history.length > 0 && (
        <div className="history">
          <h3>{t.history}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.colSource}</th>
                  <th>{t.colDay}</th>
                  <th className="num">{t.colItems}</th>
                  <th className="num">{t.colReq}</th>
                  <th className="num">{t.colTime}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {h.source === 'kraken' ? 'Kraken' : 'Coinbase'} · {h.marketLabel}
                    </td>
                    <td>{h.day}</td>
                    <td className="num">
                      {fmtInt(h.items, lang)} {h.source === 'kraken' ? t.trades : t.candles}
                    </td>
                    <td className="num">{fmtInt(h.requests, lang)}</td>
                    <td className="num">{fmtSeconds(h.elapsedMs, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function Result({ run }: { run: RunResult }) {
  const { t, lang } = useI18n()
  const s = run.stats
  if (!s) return <p className="note">{t.noData}</p>
  const isTrades = run.source === 'kraken'
  const priceDigits = s.close >= 1000 ? 1 : 2
  const up = s.close >= s.open

  return (
    <div className="result" data-testid="result">
      <div className="headline">
        <strong data-testid="items">{fmtInt(run.items, lang)}</strong> {isTrades ? t.trades : t.candles} {t.in}{' '}
        <strong data-testid="elapsed">{fmtSeconds(run.elapsedMs, lang)}</strong>
        <span className="muted">
          {' '}
          · {run.marketLabel} · {run.day}
        </span>
      </div>

      {isTrades && run.complete && <p className="note ok">✓ {t.passed}</p>}
      {!run.complete && <p className="note">{t.dayIncomplete}</p>}

      <Sparkline line={s.line} dayStart={run.dayStart} />

      <dl className="stats">
        <Stat label={t.requests} value={fmtInt(run.requests, lang)} />
        <Stat label={t.speed} value={`${fmtInt(run.items / (run.elapsedMs / 1000), lang)}${t.perSec}`} />
        <Stat label={t.memory} value={fmtMB(s.memoryBytes, lang)} />
        <Stat label={t.open} value={fmtNum(s.open, lang, priceDigits)} />
        <Stat label={t.high} value={fmtNum(s.high, lang, priceDigits)} />
        <Stat label={t.low} value={fmtNum(s.low, lang, priceDigits)} />
        <Stat
          label={t.close}
          value={`${fmtNum(s.close, lang, priceDigits)} (${up ? '+' : ''}${fmtNum(((s.close - s.open) / s.open) * 100, lang, 2)}%)`}
          tone={up ? 'up' : 'down'}
        />
        <Stat label={t.volume} value={fmtNum(s.volume, lang, 2)} />
        {s.buyPct !== null && <Stat label={t.aggressiveBuys} value={`${fmtNum(s.buyPct, lang, 1)}%`} />}
        <Stat label={t.firstLast} value={`${fmtTimeUtc(s.firstT)} / ${fmtTimeUtc(s.lastT)}`} />
      </dl>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd className={tone}>{value}</dd>
    </div>
  )
}
