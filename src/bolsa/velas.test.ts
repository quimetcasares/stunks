// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { sesion } from './calendario'
import { azar, operacionesDeMentira } from './mentira'
import { aColumnas, type Operaciones } from './operaciones'
import { armarVelas, ConstructorVelas, PERIODOS, type Regla, type Velas } from './velas'

const T0 = Date.UTC(2024, 0, 2, 14, 30) // 9:30 de Nueva York

/** Operaciones escritas a mano: [ms desde T0, precio, cantidad, lado]. */
const ops = (filas: [number, number, number, 1 | -1][]) =>
  aColumnas(filas.map(([dt, p, q, lado]) => ({ t: T0 + dt, p, q, lado })))

/** Velas como filas [o, h, l, c, v, vc, ops], para comparar fácil. */
const filas = (v: Velas) => Array.from({ length: v.n }, (_, k) => [v.o[k], v.h[k], v.l[k], v.c[k], v.v[k], v.vc[k], v.ops[k]])

describe('velas a mano', () => {
  const cinco = ops([
    [0, 100, 1, 1],
    [10_000, 103, 2, -1],
    [59_999, 99, 1, 1],
    [60_000, 101, 5, 1],
    [185_000, 98, 1, -1],
  ])

  it('de 1 minuto: sin vela en el minuto que no tuvo operaciones', () => {
    const v = armarVelas(cinco, { tipo: 'tiempo', ms: PERIODOS['1m'] })
    expect(filas(v)).toEqual([
      [100, 103, 99, 99, 4, 2, 3],
      [101, 101, 101, 101, 5, 5, 1],
      [98, 98, 98, 98, 1, 0, 1],
    ])
    expect(Array.from(v.t)).toEqual([T0, T0 + 60_000, T0 + 180_000])
    expect(Array.from(v.u)).toEqual([T0 + 59_999, T0 + 60_000, T0 + 185_000])
  })

  it('de ticks: cada 2 operaciones', () => {
    const v = armarVelas(cinco, { tipo: 'ticks', n: 2 })
    expect(filas(v)).toEqual([
      [100, 103, 100, 103, 3, 1, 2],
      [99, 101, 99, 101, 6, 6, 2],
      [98, 98, 98, 98, 1, 0, 1],
    ])
    expect(Array.from(v.t)).toEqual([T0, T0 + 59_999, T0 + 185_000])
  })

  it('de volumen: la operación no se parte y va a la vela (acumulado - 1) / 250', () => {
    const v = armarVelas(
      ops([
        [0, 10, 100, 1],
        [1, 11, 100, 1],
        [2, 12, 100, -1], // acumulado 300: vela 1
        [3, 13, 300, 1], // acumulado 600: vela 2
        [4, 14, 10, -1], // acumulado 610: vela 2
      ]),
      { tipo: 'volumen', n: 250 },
    )
    expect(Array.from(v.id)).toEqual([0, 1, 2])
    expect(filas(v)).toEqual([
      [10, 11, 10, 11, 200, 200, 2],
      [12, 12, 12, 12, 100, 0, 1],
      [13, 14, 13, 14, 310, 300, 2],
    ])
  })

  it('de volumen: una operación grande se brinca números de vela', () => {
    const v = armarVelas(
      ops([
        [0, 10, 100, 1],
        [1, 11, 600, 1], // acumulado 700: vela 2; la 1 no existe
      ]),
      { tipo: 'volumen', n: 250 },
    )
    expect(Array.from(v.id)).toEqual([0, 2])
  })

  it('de rango: vela nueva cuando el precio se saldría de 4 ticks', () => {
    const v = armarVelas(
      ops([
        [0, 100, 1, 1],
        [1, 102, 1, 1],
        [2, 104, 1, 1],
        [3, 105, 1, 1], // 100 a 105 son 5 ticks: vela nueva
        [4, 101, 1, -1],
        [5, 100, 1, -1], // 105 a 100: vela nueva
      ]),
      { tipo: 'rango', ticks: 4 },
    )
    expect(filas(v).map((f) => f.slice(0, 4))).toEqual([
      [100, 104, 100, 104],
      [105, 105, 101, 101],
      [100, 100, 100, 100],
    ])
  })

  it('de sesión: una vela por día de futuros, que empieza en la apertura de las 18:00', () => {
    const domingo = Date.UTC(2024, 2, 10, 23) // domingo 19:00 de Nueva York: sesión del lunes 11
    const lunes = Date.UTC(2024, 2, 11, 20, 59) // lunes 16:59
    const lunesNoche = Date.UTC(2024, 2, 11, 22) // lunes 18:00: sesión del martes 12
    const lista = aColumnas([
      { t: domingo, p: 10, q: 1, lado: 1 },
      { t: lunes, p: 12, q: 1, lado: 1 },
      { t: lunesNoche, p: 11, q: 1, lado: -1 },
    ])
    const v = armarVelas(lista, { tipo: 'dia', horario: 'futuros' })
    expect(Array.from(v.id)).toEqual([20240311, 20240312])
    expect(Array.from(v.t)).toEqual([sesion('futuros', 20240311)?.abre, sesion('futuros', 20240312)?.abre])
    const sabado = aColumnas([{ t: Date.UTC(2024, 2, 9, 15), p: 10, q: 1, lado: 1 }])
    expect(() => armarVelas(sabado, { tipo: 'dia', horario: 'futuros' })).toThrow('fuera de sesión')
    expect(armarVelas(sabado, { tipo: 'dia', horario: 'cripto' }).n).toBe(1)
  })

  it('agregar dice si abrió una vela nueva o actualizó la última', () => {
    const b = new ConstructorVelas({ tipo: 'ticks', n: 2 })
    const nuevas = Array.from({ length: cinco.n }, (_, i) => b.agregar(cinco.t[i], cinco.p[i], cinco.q[i], cinco.lado[i]))
    expect(nuevas).toEqual([true, false, true, false, true])
    expect(b.ultima()).toEqual({ id: 2, t: T0 + 185_000, u: T0 + 185_000, o: 98, h: 98, l: 98, c: 98, v: 1, vc: 0, ops: 1 })
  })

  it('no acepta operaciones fuera de orden ni reglas sin sentido', () => {
    const b = new ConstructorVelas({ tipo: 'ticks', n: 2 })
    b.agregar(T0 + 10, 1, 1, 1)
    expect(() => b.agregar(T0 + 9, 1, 1, 1)).toThrow('en orden')
    expect(() => b.agregar(T0 + 10, 1, 0, 1)).toThrow('1 o más')
    expect(() => new ConstructorVelas({ tipo: 'tiempo', ms: 7000 })).toThrow('dividir la hora')
    expect(() => new ConstructorVelas({ tipo: 'tiempo', ms: 2 * 3_600_000 })).toThrow()
    expect(() => new ConstructorVelas({ tipo: 'ticks', n: 0 })).toThrow()
    expect(() => new ConstructorVelas({ tipo: 'volumen', n: 2.5 })).toThrow()
    expect(() => new ConstructorVelas({ tipo: 'rango', ticks: 0 })).toThrow()
  })
})

// ─── Propiedades con operaciones de mentira ─────────────────────────────────

const s = sesion('futuros', 20240102)
if (!s) throw new Error('falta la sesión de prueba')
const mentira = operacionesDeMentira({ semilla: 42, desde: s.abre, hasta: s.cierra, p0: 25_600, n: 20_000 })

const REGLAS: Regla[] = [
  { tipo: 'tiempo', ms: PERIODOS['1s'] },
  { tipo: 'tiempo', ms: PERIODOS['1m'] },
  { tipo: 'tiempo', ms: PERIODOS['1h'] },
  { tipo: 'dia', horario: 'futuros' },
  { tipo: 'ticks', n: 7 },
  { tipo: 'volumen', n: 250 },
  { tipo: 'volumen', n: 2500 },
  { tipo: 'rango', ticks: 4 },
]

const nombre = (r: Regla) => JSON.stringify(r)

/** Revisa cada vela contra las operaciones que le tocaron. */
function revisar(ops: Operaciones, r: Regla, v: Velas) {
  let i = 0
  let acumulado = 0
  for (let k = 0; k < v.n; k++) {
    const fin = i + v.ops[k]
    expect(v.ops[k]).toBeGreaterThan(0)
    if (k > 0) expect(v.id[k]).toBeGreaterThan(v.id[k - 1])
    let h = -Infinity
    let l = Infinity
    let vol = 0
    let compra = 0
    for (let j = i; j < fin; j++) {
      h = Math.max(h, ops.p[j])
      l = Math.min(l, ops.p[j])
      vol += ops.q[j]
      if (ops.lado[j] === 1) compra += ops.q[j]
      acumulado += ops.q[j]
      if (r.tipo === 'tiempo') expect(Math.floor(ops.t[j] / r.ms) * r.ms).toBe(v.id[k])
      if (r.tipo === 'volumen') expect(Math.floor((acumulado - 1) / r.n)).toBe(v.id[k])
    }
    expect([v.o[k], v.h[k], v.l[k], v.c[k], v.v[k], v.vc[k], v.u[k]]).toEqual([
      ops.p[i],
      h,
      l,
      ops.p[fin - 1],
      vol,
      compra,
      ops.t[fin - 1],
    ])
    expect(v.t[k]).toBeLessThanOrEqual(ops.t[i])
    if (r.tipo === 'ticks' && k < v.n - 1) expect(v.ops[k]).toBe(r.n)
    if (r.tipo === 'rango') {
      expect(h - l).toBeLessThanOrEqual(r.ticks)
      if (k < v.n - 1) expect(Math.max(h, ops.p[fin]) - Math.min(l, ops.p[fin])).toBeGreaterThan(r.ticks)
    }
    i = fin
  }
  expect(i).toBe(ops.n)
}

describe('velas con 20 mil operaciones de mentira', () => {
  for (const r of REGLAS) {
    it(`cada vela cuadra con sus operaciones: ${nombre(r)}`, () => {
      revisar(mentira, r, armarVelas(mentira, r))
    })

    it(`de una en una, en bloque y en pedazos dan lo mismo: ${nombre(r)}`, () => {
      const enBloque = armarVelas(mentira, r)
      const unaPorUna = new ConstructorVelas(r, 1)
      for (let i = 0; i < mentira.n; i++) unaPorUna.agregar(mentira.t[i], mentira.p[i], mentira.q[i], mentira.lado[i])
      expect(unaPorUna.velas()).toEqual(enBloque)

      const azarCortes = azar(9)
      const enPedazos = new ConstructorVelas(r)
      for (let i = 0; i < mentira.n; ) {
        const hasta = Math.min(mentira.n, i + 1 + Math.floor(azarCortes() * 500))
        enPedazos.agregarTodas(mentira, i, hasta)
        i = hasta
      }
      expect(enPedazos.velas()).toEqual(enBloque)
    })
  }

  it('el volumen total de las velas es el de las operaciones', () => {
    const total = mentira.q.reduce((a, q) => a + q, 0)
    for (const r of REGLAS) expect(armarVelas(mentira, r).v.reduce((a, x) => a + x, 0)).toBe(total)
  })

  it('las velas de 2500 juntan las de 250 con el mismo número entre 10', () => {
    const v250 = armarVelas(mentira, { tipo: 'volumen', n: 250 })
    const v2500 = armarVelas(mentira, { tipo: 'volumen', n: 2500 })
    const juntas: number[][] = []
    let anterior = -1
    for (let k = 0; k < v250.n; k++) {
      const g = Math.floor(v250.id[k] / 10)
      const fila = [g, v250.o[k], v250.h[k], v250.l[k], v250.c[k], v250.v[k], v250.vc[k], v250.ops[k]]
      if (g !== anterior) juntas.push(fila)
      else {
        const x = juntas[juntas.length - 1]
        x[2] = Math.max(x[2], fila[2])
        x[3] = Math.min(x[3], fila[3])
        x[4] = fila[4]
        x[5] += fila[5]
        x[6] += fila[6]
        x[7] += fila[7]
      }
      anterior = g
    }
    expect(juntas).toEqual(
      Array.from({ length: v2500.n }, (_, k) => [
        v2500.id[k],
        v2500.o[k],
        v2500.h[k],
        v2500.l[k],
        v2500.c[k],
        v2500.v[k],
        v2500.vc[k],
        v2500.ops[k],
      ]),
    )
  })
})
