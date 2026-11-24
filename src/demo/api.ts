// Cliente de la función demo (stunks-bolsa/supabase/functions/demo). Sin cuenta: el navegador genera un uuid al azar, lo
// guarda y lo manda en x-jugador; la función solo guarda su hash.
import { SUPABASE } from '../config'

export const DEMO_URL: string = import.meta.env.VITE_DEMO_URL ?? (SUPABASE ? `${SUPABASE.url}/functions/v1/demo` : '')

export type Modo = 'reto' | 'libre'
export type Fuente = 'real' | 'stunks'
export type Pista = 'mechas' | 'volumen' | 'brincos' | 'limpia' | 'nose'

export interface Velas {
  o: number[]
  h: number[]
  l: number[]
  c: number[]
  v: number[]
}
export interface Ronda {
  ronda: string
  modo: Modo
  n: number
  de: number
  espera_ms: number
  velas: Velas
}
export type Servida = { estado: 'ok' } & Ronda
export type SinRonda = { estado: 'sin-grupo' | 'sin-reto' | 'terminado' | 'agotado' }

export class ErrorDemo extends Error {
  readonly codigo: string
  readonly estado: number
  readonly espera_ms?: number
  constructor(codigo: string, estado: number, espera_ms?: number) {
    super(codigo)
    this.codigo = codigo
    this.estado = estado
    this.espera_ms = espera_ms
  }
}

const CLAVE = 'stunks.demo.jugador'
let deSesion: string | undefined

export function jugador(): string {
  try {
    let j = localStorage.getItem(CLAVE)
    if (!j || !/^[0-9a-f-]{36}$/i.test(j)) {
      j = crypto.randomUUID()
      localStorage.setItem(CLAVE, j)
    }
    return j
  } catch {
    // Sin localStorage (modo privado estricto): un uuid para esta visita.
    deSesion ??= crypto.randomUUID()
    return deSesion
  }
}

async function llamar<T>(ruta: string, init?: RequestInit): Promise<T> {
  if (!DEMO_URL) throw new ErrorDemo('sin-servidor', 0)
  const r = await fetch(`${DEMO_URL}/${ruta}`, {
    ...init,
    headers: { 'x-jugador': jugador(), ...(init?.body ? { 'content-type': 'application/json' } : {}) },
  })
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new ErrorDemo(cuerpo.error ?? 'error', r.status, cuerpo.espera_ms)
  return cuerpo as T
}

export const pedirRonda = (modo: Modo) => llamar<Servida | SinRonda>(`ronda?modo=${modo}`)
export const responder = (ronda: string, dijo: Fuente) =>
  llamar<{ acerto: boolean; era: Fuente }>('respuesta', { method: 'POST', body: JSON.stringify({ ronda, dijo }) })
export const enviarPista = (ronda: string, pista: Pista) =>
  llamar<{ ok: true }>('pista', { method: 'POST', body: JSON.stringify({ ronda, pista }) })

export interface Agregado {
  comun: {
    total: number
    aciertos: number
    jugadores: number
    hoy_total: number
    hoy_aciertos: number
    min_segundos: number
    tabla: { apodo: string; aciertos: number; total: number }[]
  }
  tu: {
    aciertos: number
    total: number
    apodo: string | null
    lugar: number | null
    reto?: { aciertos: number; mejor_que: number | null; jugaron: number; numero: number }
  }
}
export const pedirAgregado = () => llamar<Agregado>('agregado')
export const ponerApodo = (apodo: string) => llamar<{ ok: true }>('apodo', { method: 'POST', body: JSON.stringify({ apodo }) })
