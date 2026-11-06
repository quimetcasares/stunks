// Motor de llenados: las mismas reglas que el juego (y que banco/motor.py).
// - Entra en la apertura de la vela siguiente, 1 tick en contra.
// - Stop al tocar: se llena en el peor entre el nivel y la apertura de la vela, más max(1 tick, 2.65% del stop).
// - Objetivo: solo si el precio pasa 1 tick más allá, y nunca en la vela de entrada. Stop y objetivo en la misma vela: cuenta el stop.
// - Si no pega ninguno: sale a las 16:10 ET (apertura de esa vela, o cierre de la última), 1 tick en contra.
// - Nuevo en Stunks: cerrar a mano = sale en la apertura de la vela siguiente, 1 tick en contra.

import type { Dia } from './datos'

export interface Mercado {
  clave: string
  micro: string
  tick: number
  usd: number // dólares por punto del micro
  com: number // comisión por contrato, ida y vuelta
}

export const NQ: Mercado = { clave: 'NQ', micro: 'MNQ', tick: 0.25, usd: 2, com: 1.5 }
export const T_CIERRE = 79800 // 16:10 ET
export const DESLIZ = 0.0265

export type TipoSalida = 'stop' | 'objetivo' | 'cierre' | 'manual'

export interface Resultado {
  lado: 1 | -1
  e: number
  js: number // vela en la que sale
  tipo: TipoSalida
  entrada: number
  salida: number
  stop: number
  obj: number
  bruto: number // puntos
  neto: number // puntos, ya con comisión
  R: number
  usd: number
  mfe: number
  mae: number
  seg: number
}

/** Primera vela que empieza a las 16:10 ET o después (o D.n si no hay). */
export function velaDeCierre(D: Dia) {
  for (let j = 0; j < D.n; j++) if (D.t[j] >= T_CIERRE) return j
  return D.n
}

export function resolver(
  D: Dia,
  e: number,
  lado: 1 | -1,
  stopPts: number,
  objPts: number,
  contratos: number,
  mk: Mercado = NQ,
  cerrarEn?: number,
): Resultado {
  const TICK = mk.tick
  const entrada = (D.o[e] + lado) * TICK
  const stop = entrada - lado * stopPts
  const obj = entrada + lado * objPts
  const desl = Math.max(TICK, DESLIZ * stopPts)
  let x = velaDeCierre(D)
  const manual = cerrarEn !== undefined && cerrarEn < x
  if (manual) x = Math.max(e, cerrarEn!)

  let mfe = 0
  let mae = 0
  let tipo: TipoSalida = manual ? 'manual' : 'cierre'
  let salida: number | null = null
  let js = x - 1
  for (let j = e; j < x; j++) {
    const H = D.h[j] * TICK
    const L = D.l[j] * TICK
    const O = D.o[j] * TICK
    const tocaStop = lado > 0 ? L <= stop : H >= stop
    const tocaObj = j > e && (lado > 0 ? H >= obj + TICK : L <= obj - TICK)
    if (tocaStop) {
      salida = lado > 0 ? Math.min(stop, O) - desl : Math.max(stop, O) + desl
      tipo = 'stop'
      js = j
      mae = Math.max(mae, stopPts)
      break
    }
    if (tocaObj) {
      salida = obj
      tipo = 'objetivo'
      js = j
      mfe = Math.max(mfe, objPts)
      mae = Math.max(mae, lado > 0 ? entrada - L : H - entrada)
      break
    }
    mfe = Math.max(mfe, lado > 0 ? H - entrada : entrada - L)
    mae = Math.max(mae, lado > 0 ? entrada - L : H - entrada)
  }
  if (salida === null) {
    salida = (x < D.n ? D.o[x] * TICK : D.c[D.n - 1] * TICK) - lado * TICK
    js = Math.min(x, D.n - 1)
  }
  const bruto = (salida - entrada) * lado
  const neto = bruto - mk.com / mk.usd
  return {
    lado,
    e,
    js,
    tipo,
    entrada,
    salida,
    stop,
    obj,
    bruto,
    neto,
    R: neto / stopPts,
    usd: contratos * (bruto * mk.usd - mk.com),
    mfe,
    mae: Math.max(0, mae),
    seg: D.t[js] - D.t[e],
  }
}
