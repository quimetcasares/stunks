// SPDX-License-Identifier: MIT
// Constructor de velas de la bolsa de Stunks: de tiempo, de sesión, de ticks, de volumen y de rango,
// todas desde la misma lista de operaciones. Recibe operaciones de una en una (en vivo) o en bloque (histórico)
// y da exactamente las mismas velas de las dos formas. Si en un periodo no hubo operaciones, no hay vela.
import { type Horario, sesionEn } from './calendario.ts'
import type { Operaciones } from './operaciones.ts'

/**
 * Cómo se cortan las velas:
 *  - tiempo: periodos de `ms` contados desde la época UTC (1 s a 1 h; cualquier divisor de una hora).
 *  - dia: una vela por sesión del horario (futuros: 18:00 a 17:00 de Nueva York; cripto: 18:00 a 18:00).
 *  - ticks: cada `n` operaciones.
 *  - volumen: la operación no se parte; va completa a la vela (volumen acumulado incluyéndola - 1) / n, sin decimales.
 *    Así una vela de 2500 junta las velas de 250 con el mismo número entre 10.
 *  - rango: una vela nueva cuando el precio se saldría de `ticks` ticks entre el máximo y el mínimo de la vela.
 * Las de ticks, volumen y rango cuentan desde la primera operación que recibe el constructor: para empezar de cero
 * en cada sesión, se usa un constructor por sesión.
 */
export type Regla =
  | { tipo: 'tiempo'; ms: number }
  | { tipo: 'dia'; horario: Horario }
  | { tipo: 'ticks'; n: number }
  | { tipo: 'volumen'; n: number }
  | { tipo: 'rango'; ticks: number }

const HORA = 3_600_000

/** Los periodos de tiempo que ofrece la app. */
export const PERIODOS = {
  '1s': 1000,
  '5s': 5000,
  '15s': 15_000,
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': HORA,
} as const

export interface Vela {
  id: number // tiempo: inicio del periodo en ms; dia: aaaammdd; ticks, volumen y rango: número de vela desde el inicio
  t: number // ms UTC en que empieza: inicio del periodo, apertura de la sesión o primera operación
  u: number // ms UTC de la última operación
  o: number // precios en ticks
  h: number
  l: number
  c: number
  v: number // volumen, en la unidad mínima del mercado
  vc: number // volumen de las compras agresivas (lado 1)
  ops: number // número de operaciones
}

/** Velas en columnas. */
export interface Velas {
  n: number
  id: Float64Array
  t: Float64Array
  u: Float64Array
  o: Int32Array
  h: Int32Array
  l: Int32Array
  c: Int32Array
  v: Float64Array
  vc: Float64Array
  ops: Uint32Array
}

function columnas(cap: number, n = 0): Velas {
  return {
    n,
    id: new Float64Array(cap),
    t: new Float64Array(cap),
    u: new Float64Array(cap),
    o: new Int32Array(cap),
    h: new Int32Array(cap),
    l: new Int32Array(cap),
    c: new Int32Array(cap),
    v: new Float64Array(cap),
    vc: new Float64Array(cap),
    ops: new Uint32Array(cap),
  }
}

function revisarRegla(r: Regla) {
  const entero = (x: number) => Number.isSafeInteger(x) && x >= 1
  if (r.tipo === 'tiempo' && !(entero(r.ms) && HORA % r.ms === 0))
    throw new Error('Las velas de tiempo van de 1 ms a 1 hora y deben dividir la hora exacta.')
  if (r.tipo === 'ticks' && !entero(r.n)) throw new Error('Las velas de ticks necesitan un número entero de operaciones.')
  if (r.tipo === 'volumen' && !entero(r.n)) throw new Error('Las velas de volumen necesitan un volumen entero.')
  if (r.tipo === 'rango' && !entero(r.ticks)) throw new Error('Las velas de rango necesitan un número entero de ticks.')
}

export class ConstructorVelas {
  private cols: Velas
  private anterior = Number.NEGATIVE_INFINITY // tiempo de la última operación recibida
  private recibidas = 0
  private acumulado = 0
  private sesion = { dia: 0, abre: 0, cierra: 0 }

  readonly regla: Regla

  constructor(regla: Regla, capacidad = 1024) {
    revisarRegla(regla)
    this.regla = regla
    this.cols = columnas(Math.max(1, capacidad))
  }

  get n() {
    return this.cols.n
  }

  /** Agrega una operación. Regresa true si abrió una vela nueva y false si actualizó la última. */
  agregar(t: number, p: number, q: number, lado: number): boolean {
    if (t < this.anterior) throw new Error('Las operaciones deben llegar en orden de tiempo.')
    if (!(q >= 1)) throw new Error('La cantidad debe ser 1 o más.')
    this.anterior = t
    const c = this.cols
    const k = c.n - 1
    const r = this.regla
    let id = 0
    let inicio = t
    switch (r.tipo) {
      case 'tiempo':
        id = Math.floor(t / r.ms) * r.ms
        inicio = id
        break
      case 'dia':
        id = this.diaDe(t, r.horario)
        inicio = this.sesion.abre
        break
      case 'ticks':
        id = Math.floor(this.recibidas / r.n)
        break
      case 'volumen':
        id = Math.floor((this.acumulado + q - 1) / r.n)
        break
      case 'rango':
        id = k < 0 ? 0 : Math.max(c.h[k], p) - Math.min(c.l[k], p) > r.ticks ? c.id[k] + 1 : c.id[k]
        break
    }
    this.recibidas++
    this.acumulado += q
    const compra = lado === 1 ? q : 0

    if (k >= 0 && c.id[k] === id) {
      if (p > c.h[k]) c.h[k] = p
      if (p < c.l[k]) c.l[k] = p
      c.c[k] = p
      c.u[k] = t
      c.v[k] += q
      c.vc[k] += compra
      c.ops[k]++
      return false
    }

    if (c.n === c.id.length) this.crecer()
    const d = this.cols
    const j = d.n++
    d.id[j] = id
    d.t[j] = inicio
    d.u[j] = t
    d.o[j] = d.h[j] = d.l[j] = d.c[j] = p
    d.v[j] = q
    d.vc[j] = compra
    d.ops[j] = 1
    return true
  }

  /** Agrega en orden las operaciones de `desde` a `hasta` (excluido). */
  agregarTodas(ops: Operaciones, desde = 0, hasta = ops.n) {
    for (let i = desde; i < hasta; i++) this.agregar(ops.t[i], ops.p[i], ops.q[i], ops.lado[i])
  }

  vela(i: number): Vela {
    if (i < 0 || i >= this.cols.n) throw new Error(`No hay vela ${i}.`)
    const c = this.cols
    return {
      id: c.id[i],
      t: c.t[i],
      u: c.u[i],
      o: c.o[i],
      h: c.h[i],
      l: c.l[i],
      c: c.c[i],
      v: c.v[i],
      vc: c.vc[i],
      ops: c.ops[i],
    }
  }

  /** La última vela, que puede seguir cambiando con las operaciones que lleguen. */
  ultima(): Vela | null {
    return this.cols.n > 0 ? this.vela(this.cols.n - 1) : null
  }

  /** Copia de todas las velas hasta ahora. */
  velas(): Velas {
    const c = this.cols
    const n = c.n
    return {
      n,
      id: c.id.slice(0, n),
      t: c.t.slice(0, n),
      u: c.u.slice(0, n),
      o: c.o.slice(0, n),
      h: c.h.slice(0, n),
      l: c.l.slice(0, n),
      c: c.c.slice(0, n),
      v: c.v.slice(0, n),
      vc: c.vc.slice(0, n),
      ops: c.ops.slice(0, n),
    }
  }

  private diaDe(t: number, horario: Horario) {
    const s = this.sesion
    if (t >= s.abre && t < s.cierra) return s.dia
    const nueva = sesionEn(horario, t)
    if (!nueva) throw new Error(`La operación de ${new Date(t).toISOString()} cae fuera de sesión.`)
    this.sesion = { dia: nueva.dia, abre: nueva.abre, cierra: nueva.cierra }
    return nueva.dia
  }

  private crecer() {
    const c = this.cols
    const m = columnas(c.id.length * 2, c.n)
    m.id.set(c.id)
    m.t.set(c.t)
    m.u.set(c.u)
    m.o.set(c.o)
    m.h.set(c.h)
    m.l.set(c.l)
    m.c.set(c.c)
    m.v.set(c.v)
    m.vc.set(c.vc)
    m.ops.set(c.ops)
    this.cols = m
  }
}

/** Todas las velas de una lista de operaciones, de una vez. */
export function armarVelas(ops: Operaciones, regla: Regla): Velas {
  const cap = regla.tipo === 'ticks' ? Math.ceil(ops.n / regla.n) : 1024
  const b = new ConstructorVelas(regla, cap)
  b.agregarTodas(ops)
  return b.velas()
}
