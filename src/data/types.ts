// Formato interno único: igual para cripto y para los datos que cada usuario cargue después.
// Tiempos en milisegundos UTC. Lado: 1 = compra agresiva, -1 = venta agresiva, 0 = desconocido.

export interface TradeTape {
  source: string
  market: string
  n: number
  t: Float64Array
  p: Float64Array
  q: Float64Array
  s: Int8Array
}

export interface Candle {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface FetchProgress {
  requests: number
  items: number
  coveredMs: number
  totalMs: number
  elapsedMs: number
  waitingMs: number
}

export interface FetchOpts {
  signal?: AbortSignal
  onProgress?: (p: FetchProgress) => void
}

/** Arreglos que crecen solos, para no guardar millones de objetos sueltos. */
export class TapeBuilder {
  n = 0
  private cap = 1 << 15
  private t = new Float64Array(this.cap)
  private p = new Float64Array(this.cap)
  private q = new Float64Array(this.cap)
  private s = new Int8Array(this.cap)

  push(t: number, p: number, q: number, s: number) {
    if (this.n === this.cap) this.grow()
    const i = this.n++
    this.t[i] = t
    this.p[i] = p
    this.q[i] = q
    this.s[i] = s
  }

  private grow() {
    this.cap *= 2
    const t = new Float64Array(this.cap)
    const p = new Float64Array(this.cap)
    const q = new Float64Array(this.cap)
    const s = new Int8Array(this.cap)
    t.set(this.t)
    p.set(this.p)
    q.set(this.q)
    s.set(this.s)
    this.t = t
    this.p = p
    this.q = q
    this.s = s
  }

  finish(source: string, market: string): TradeTape {
    const n = this.n
    return {
      source,
      market,
      n,
      t: this.t.slice(0, n),
      p: this.p.slice(0, n),
      q: this.q.slice(0, n),
      s: this.s.slice(0, n),
    }
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelado', 'AbortError'))
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(id)
      reject(new DOMException('Cancelado', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
