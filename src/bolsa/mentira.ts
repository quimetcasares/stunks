// SPDX-License-Identifier: MIT
// Operaciones de mentira para las pruebas: una caminata al azar con semilla.
// No es el generador de la bolsa y no copia ningún mercado real.
import { type Operaciones, vacias } from './operaciones'

/** Generador pseudoaleatorio con semilla (mulberry32): mismas semillas, mismos números. */
export function azar(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface OpcionesMentira {
  semilla: number
  desde: number // ms UTC, incluido
  hasta: number // ms UTC, excluido
  p0: number // precio inicial en ticks
  n: number
}

/** `n` operaciones en orden dentro del tramo, con brincos de -1 a 1 tick y tamaños de 1 a 20 (casi siempre chicos). */
export function operacionesDeMentira({ semilla, desde, hasta, p0, n }: OpcionesMentira): Operaciones {
  const r = azar(semilla)
  const ops = vacias(n)
  for (let i = 0; i < n; i++) ops.t[i] = desde + Math.floor(r() * (hasta - desde))
  ops.t.sort()
  let p = p0
  for (let i = 0; i < n; i++) {
    p = Math.max(1, p + Math.floor(r() * 3) - 1)
    ops.p[i] = p
    ops.q[i] = 1 + Math.floor(r() ** 4 * 20)
    ops.lado[i] = r() < 0.5 ? 1 : -1
  }
  return ops
}
