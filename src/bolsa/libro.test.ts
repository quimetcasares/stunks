// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { codificarLibro, decodificarLibro, ENCABEZADO_LIBRO, escaleraEn, type Fotos, fotosVacias, type Libro } from './libro.ts'
import { ErrorFormato } from './operaciones.ts'

const DESDE = Date.UTC(2024, 0, 2, 14, 30) // 9:30 de Nueva York
const HASTA = DESDE + 30 * 60_000
const tramo = { mercado: 'B01', dia: 20240102, version: 1, desde: DESDE, hasta: HASTA, niveles: 2 }

const hex = (u8: Uint8Array) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('')

/** Fotos de mentira: el mejor bid camina, el spread casi siempre de 1 y los tamaños cambian de a poco. */
function deMentira(n: number, niveles: number, semilla = 7): Fotos {
  let s = semilla
  const r = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  const f = fotosVacias(n, niveles)
  let t = DESDE
  let bid = 25_600
  for (let k = 0; k < n; k++) {
    t += Math.floor(r() * 300)
    bid += r() < 0.1 ? (r() < 0.5 ? -1 : 1) : 0
    f.t[k] = t
    f.mejorBid[k] = bid
    f.spread[k] = r() < 0.9 ? 1 : 2
    for (let j = 0; j < 2 * niveles; j++) {
      const antes = k > 0 ? f.tamanos[(k - 1) * 2 * niveles + j] : 5 + j
      f.tamanos[k * 2 * niveles + j] = r() < 0.3 ? Math.floor(r() * 40) : antes
    }
  }
  return f
}

describe('formato LIB1', () => {
  it('un caso chico da exactamente estos bytes', () => {
    const f = fotosVacias(2, 2)
    f.t.set([DESDE, DESDE + 100])
    f.mejorBid.set([25_600, 25_601])
    f.spread.set([1, 2])
    // Foto 0: compras 10, 20 · ventas 15, 25. Foto 1: solo cambia la primera venta, a 3.
    f.tamanos.set([10, 20, 15, 25, 10, 20, 3, 25])
    const u8 = codificarLibro({ ...tramo, fotos: f })
    const dv = new DataView(u8.buffer)
    expect(String.fromCharCode(...u8.slice(0, 4))).toBe('LIB1')
    expect(dv.getUint16(6, true)).toBe(2)
    expect(dv.getUint32(20, true)).toBe(2)
    expect(dv.getInt32(40, true)).toBe(25_600)
    // Foto 0: 0 ms · bid +0 · spread 1 (0) · máscara 1111 (15) · 10 20 15 25.
    // Foto 1: 100 ms · bid +1 (2) · spread 2 (1) · máscara 0100 (4) · 3.
    expect(hex(u8.slice(ENCABEZADO_LIBRO))).toBe(['0000000f0a140f19', '640201' + '04' + '03'].join(''))
    // Si esto cambia, cambió el formato: hace falta una versión nueva (LIB2), no editar esta prueba.
    expect(hex(u8.slice(0, ENCABEZADO_LIBRO))).toBe(
      '4c494231010002004230310000000000e6d63401020000000000244da9cc784200009804abcc78420064000000000000',
    )
  })

  it('ida y vuelta con 20 mil fotos de 10 niveles', () => {
    const a: Libro = { ...tramo, niveles: 10, fotos: deMentira(20_000, 10) }
    a.hasta = a.fotos.t[a.fotos.n - 1] + 1
    expect(decodificarLibro(codificarLibro(a))).toEqual(a)
  })

  it('cada foto guarda solo lo que cambió: pocos bytes por foto', () => {
    const a: Libro = { ...tramo, niveles: 10, fotos: deMentira(20_000, 10) }
    a.hasta = a.fotos.t[a.fotos.n - 1] + 1
    const u8 = codificarLibro(a)
    expect((u8.length - ENCABEZADO_LIBRO) / a.fotos.n).toBeLessThan(16)
  })

  it('un tramo sin fotos también se guarda', () => {
    const a: Libro = { ...tramo, fotos: fotosVacias(0, 2) }
    expect(decodificarLibro(codificarLibro(a))).toEqual(a)
  })
})

describe('escalera del DOM', () => {
  it('da la última foto en o antes del momento pedido, con los precios de cada nivel', () => {
    const f = fotosVacias(2, 2)
    f.t.set([DESDE, DESDE + 100])
    f.mejorBid.set([25_600, 25_601])
    f.spread.set([1, 2])
    f.tamanos.set([10, 20, 15, 25, 10, 20, 3, 25])
    const libro: Libro = { ...tramo, fotos: f }
    expect(escaleraEn(libro, DESDE - 1)).toBeNull()
    expect(escaleraEn(libro, DESDE + 99)).toEqual({
      t: DESDE,
      compras: [
        { precio: 25_600, tamano: 10 },
        { precio: 25_599, tamano: 20 },
      ],
      ventas: [
        { precio: 25_601, tamano: 15 },
        { precio: 25_602, tamano: 25 },
      ],
    })
    expect(escaleraEn(libro, DESDE + 100)?.ventas[0]).toEqual({ precio: 25_603, tamano: 3 })
  })
})

describe('errores', () => {
  const base = () => {
    const f = fotosVacias(1, 2)
    f.t[0] = DESDE
    f.mejorBid[0] = 100
    f.spread[0] = 1
    return f
  }

  it('no acepta fotos fuera de orden o del tramo, ni spreads de cero', () => {
    const f = deMentira(3, 2)
    f.t[2] = f.t[0] - 1
    expect(() => codificarLibro({ ...tramo, fotos: f })).toThrow(ErrorFormato)
    const g = base()
    g.t[0] = HASTA
    expect(() => codificarLibro({ ...tramo, fotos: g })).toThrow(ErrorFormato)
    const h = base()
    h.spread[0] = 0
    expect(() => codificarLibro({ ...tramo, fotos: h })).toThrow('spread')
  })

  it('no acepta un tramo mal escrito', () => {
    expect(() => codificarLibro({ ...tramo, niveles: 0, fotos: fotosVacias(0, 1) })).toThrow('niveles')
    expect(() => codificarLibro({ ...tramo, mercado: 'mq', fotos: base() })).toThrow(ErrorFormato)
  })

  it('rechaza archivos que no son LIB1, cortados o con bytes de más', () => {
    const u8 = codificarLibro({ ...tramo, fotos: deMentira(5, 2) })
    const otro = u8.slice()
    otro[3] = 0x32
    expect(() => decodificarLibro(otro)).toThrow('No es un archivo de libro')
    expect(() => decodificarLibro(u8.slice(0, 20))).toThrow('cortado')
    expect(() => decodificarLibro(u8.slice(0, -1))).toThrow('cortado')
    expect(() => decodificarLibro(new Uint8Array([...u8, 0]))).toThrow('Sobran bytes')
  })
})
