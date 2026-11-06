// Mercado de mentira en el mismo formato que los datos del NQ (NQJ1).
// Sirve para las pruebas automáticas, la integración continua y la web publicada:
// el repo público nunca lleva datos del CME.

import type { Dia } from './datos'

export interface VelaFalsa {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
  bv: number
  g: number
}

export interface DiaFalso {
  fecha: number
  t0: number
  pad: boolean
  base: number
  velas: VelaFalsa[]
}

/** Generador pseudoaleatorio con semilla (mulberry32), para que las pruebas salgan igual siempre. */
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

/** Un día de velas de 250 con caminata al azar, en ticks. Precio inicial en ticks (precio * 4). */
export function diaFalso(fecha: number, t0: number, inicio: number, n: number, semilla: number, pad = false): DiaFalso {
  const r = azar(semilla)
  const velas: VelaFalsa[] = []
  let c = inicio
  let t = 0
  const paso = Math.floor(82800 / n)
  for (let j = 0; j < n; j++) {
    t += 1 + Math.floor(r() * paso * 2 - 1)
    t = Math.min(t, 82800 + j)
    const o = c + Math.round((r() - 0.5) * 2)
    const cierre = o + Math.round((r() - 0.5) * 24)
    const h = Math.max(o, cierre) + Math.floor(r() * 8)
    const l = Math.min(o, cierre) - Math.floor(r() * 8)
    const bv = Math.floor(r() * 250)
    velas.push({ t, o, h, l, c: cierre, v: 250, bv, g: Math.floor(j / 10) })
    c = cierre
  }
  return { fecha, t0, pad, base: velas[0].o, velas }
}

/** Codifica días en el formato NQJ1, sin comprimir. */
export function codificar(dias: DiaFalso[]): Uint8Array {
  const total = dias.reduce((a, d) => a + d.velas.length, 0)
  const tam = 16 + 20 * dias.length + total * (2 * 7 + 1)
  const buf = new ArrayBuffer(tam)
  const dv = new DataView(buf)
  const u8 = new Uint8Array(buf)
  u8.set([0x4e, 0x51, 0x4a, 0x31], 0) // 'NQJ1'
  dv.setUint16(4, dias.length, true)
  dv.setUint16(6, 1, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, 0, true)
  dias.forEach((d, i) => {
    const p = 16 + 20 * i
    dv.setUint32(p, d.fecha, true)
    dv.setUint32(p + 4, d.t0, true)
    dv.setUint32(p + 8, d.velas.length, true)
    dv.setInt32(p + 12, d.base, true)
    dv.setUint8(p + 16, d.pad ? 1 : 0)
  })
  let off = 16 + 20 * dias.length
  const columna = (escribir: (d: DiaFalso, j: number) => number, bytes: 1 | 2, conSigno: boolean) => {
    for (const d of dias) {
      for (let j = 0; j < d.velas.length; j++) {
        const x = escribir(d, j)
        if (bytes === 1) dv.setUint8(off, x)
        else if (conSigno) dv.setInt16(off, x, true)
        else dv.setUint16(off, x, true)
        off += bytes
      }
    }
  }
  const prev = (d: DiaFalso, j: number) => (j === 0 ? d.base : d.velas[j - 1].c)
  columna((d, j) => d.velas[j].t - (j === 0 ? 0 : d.velas[j - 1].t), 2, false)
  columna((d, j) => d.velas[j].c - prev(d, j), 2, true)
  columna((d, j) => d.velas[j].o - prev(d, j), 2, true)
  columna((d, j) => d.velas[j].h - Math.max(d.velas[j].o, d.velas[j].c), 2, false)
  columna((d, j) => Math.min(d.velas[j].o, d.velas[j].c) - d.velas[j].l, 2, false)
  columna((d, j) => d.velas[j].v, 2, false)
  columna((d, j) => d.velas[j].bv, 2, false)
  columna((d, j) => d.velas[j].g - (j === 0 ? 0 : d.velas[j - 1].g), 1, false)
  return u8
}

/** Un Dia (como lo usa el motor) armado a mano, para pruebas chiquitas. Precios en puntos. */
export function diaDePrueba(velas: { t: number; o: number; h: number; l: number; c: number }[]): Dia {
  const n = velas.length
  const arr = (f: (v: (typeof velas)[number]) => number) => Int32Array.from(velas, f)
  return {
    fecha: 20000103,
    t0: 946854000,
    pad: false,
    n,
    t: arr((v) => v.t),
    o: arr((v) => Math.round(v.o * 4)),
    h: arr((v) => Math.round(v.h * 4)),
    l: arr((v) => Math.round(v.l * 4)),
    c: arr((v) => Math.round(v.c * 4)),
    g: Int32Array.from(velas, (_, j) => Math.floor(j / 10)),
    vol: new Int32Array(n).fill(250),
    bv: new Int32Array(n).fill(125),
  }
}

/** Un mes del mercado de mentira: aaaa-mm y sus días (el primero es el último del mes anterior, marcado como relleno). */
export interface MesFalso {
  m: string
  dias: DiaFalso[]
}

/**
 * Días hábiles de enero y febrero de 2001 (fechas de mentira a propósito), siempre iguales.
 * Lo usan las pruebas de punta a punta y la web publicada (ver docs/decisiones/0006-web-sin-datos-reales.md).
 */
export function mercadoDeMentira(): MesFalso[] {
  const todos: DiaFalso[] = []
  let precio = 60000 // en ticks: 15,000 puntos
  let semilla = 7
  for (let mes = 1; mes <= 2; mes++) {
    for (let d = 1; d <= 28; d++) {
      const dow = new Date(Date.UTC(2001, mes - 1, d)).getUTCDay()
      if (dow === 0 || dow === 6) continue
      const t0 = Date.UTC(2001, mes - 1, d - 1, 23, 0, 0) / 1000 // 18:00 ET del día anterior
      const D = diaFalso(2001_00_00 + mes * 100 + d, t0, precio, 600, semilla++)
      precio = D.velas[D.velas.length - 1].c
      todos.push(D)
    }
  }
  return [1, 2].map((mes) => {
    const delMes = todos.filter((D) => Math.floor(D.fecha / 100) % 100 === mes)
    const i0 = todos.indexOf(delMes[0])
    const dias = i0 > 0 ? [{ ...todos[i0 - 1], pad: true }, ...delMes] : delMes
    return { m: `2001-${String(mes).padStart(2, '0')}`, dias }
  })
}
