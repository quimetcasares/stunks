// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { operacionesDeMentira } from './mentira.ts'
import {
  type Archivo,
  aColumnas,
  aLista,
  codificar,
  comprimir,
  decodificar,
  descomprimir,
  ENCABEZADO,
  ErrorFormato,
  leer,
  type NoticiaDelTramo,
  type Operacion,
  vacias,
} from './operaciones.ts'

// Sesión de mentira del 2 de enero de 2024: de las 18:00 del 1 a las 17:00 del 2, hora de Nueva York.
const DESDE = Date.UTC(2024, 0, 1, 23)
const HASTA = Date.UTC(2024, 0, 2, 22)
const tramo = { mercado: 'MQ', dia: 20240102, version: 1, desde: DESDE, hasta: HASTA, noticias: [] as NoticiaDelTramo[] }

const hex = (u8: Uint8Array) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('')

const chicas: Operacion[] = [
  { t: DESDE, p: 25600, q: 1, lado: 1 },
  { t: DESDE + 5, p: 25601, q: 3, lado: -1 },
  { t: DESDE + 5, p: 25599, q: 200, lado: 1 },
]

// El empleo de las 8:30 del 2 de enero (13:30 UTC): 200 mil esperados, 180 mil antes y 256 mil que salieron.
const EMPLEO = Date.UTC(2024, 0, 2, 13, 30)
const empleo: NoticiaDelTramo = { t: EMPLEO, tipo: 0, esperado: 20_000, anterior: 18_000, actual: 25_600 }

describe('formato OPR2', () => {
  it('un caso chico da exactamente estos bytes', () => {
    const u8 = codificar({ ...tramo, ops: aColumnas(chicas), noticias: [empleo] })
    const dv = new DataView(u8.buffer)
    expect(String.fromCharCode(...u8.slice(0, 4))).toBe('OPR2')
    expect(dv.getUint16(4, true)).toBe(1)
    expect(String.fromCharCode(...u8.slice(8, 10))).toBe('MQ')
    expect(dv.getUint32(16, true)).toBe(20240102)
    expect(dv.getUint32(20, true)).toBe(3)
    expect(dv.getFloat64(24, true)).toBe(DESDE)
    expect(dv.getFloat64(32, true)).toBe(HASTA)
    expect(dv.getInt32(40, true)).toBe(25600)
    expect(dv.getUint32(44, true)).toBe(1)
    // Tiempos 0, 5, 0 · precios 0, +1, -2 en zigzag (0, 2, 3) · cantidad por 2 más 1 si es compra (3, 6, 401).
    // Noticia: 14.5 horas desde el inicio en zigzag · tipo 0 · 20000, 18000 y 25600 en zigzag (este, más 1).
    expect(hex(u8.slice(ENCABEZADO))).toBe(
      ['000500', '000203', '03069103', '8089e431', '00', 'c0b802', 'a09902', '819003'].join(''),
    )
    // Si esto cambia, cambió el formato: hace falta una versión nueva (OPR3), no editar esta prueba.
    expect(hex(u8)).toBe(
      '4f505232010000004d51000000000000e6d63401030000000000181674cc78420000f00cc3cc78420064000001000000000500000203030691038089e43100c0b802a09902819003',
    )
  })

  it('todavía lee OPR1, que no trae noticias', () => {
    const opr1 =
      '4f505231010000004d51000000000000e6d63401030000000000181674cc78420000f00cc3cc7842006400000000000000050000020303069103'
    const u8 = new Uint8Array(opr1.match(/../g)?.map((x) => Number.parseInt(x, 16)) ?? [])
    const a = decodificar(u8)
    expect(aLista(a.ops)).toEqual(chicas)
    expect(a.noticias).toEqual([])
  })

  it('un resultado nunca va en un tramo que termina antes de que se publique', () => {
    const antes = { ...tramo, hasta: EMPLEO, ops: vacias() }
    expect(() => codificar({ ...antes, noticias: [empleo] })).toThrow('no puede ir')
    // Lo esperado y el anterior sí van: el calendario del día se conoce desde antes.
    const u8 = codificar({ ...antes, noticias: [{ ...empleo, actual: null }] })
    expect(decodificar(u8).noticias).toEqual([{ ...empleo, actual: null }])
    // Y en el tramo que incluye su minuto, o uno posterior, ya va el resultado.
    const despues = { ...tramo, desde: EMPLEO + 60_000, ops: vacias(), noticias: [empleo] }
    expect(decodificar(codificar(despues)).noticias).toEqual([empleo])
  })

  it('ida y vuelta con noticias negativas, sin publicar y en el mismo minuto', () => {
    const noticias: NoticiaDelTramo[] = [
      { t: EMPLEO, tipo: 0, esperado: -70_000, anterior: 27_500, actual: -2_053_700 },
      { t: EMPLEO, tipo: 1, esperado: 25, anterior: -10, actual: 0 },
      { t: HASTA + 3_600_000, tipo: 4, esperado: -50, anterior: -50, actual: null },
    ]
    const a: Archivo = { ...tramo, ops: aColumnas(chicas), noticias }
    expect(decodificar(codificar(a))).toEqual(a)
  })

  it('ida y vuelta con 50 mil operaciones de mentira', () => {
    const ops = operacionesDeMentira({ semilla: 7, desde: DESDE, hasta: HASTA, p0: 25600, n: 50_000 })
    const a: Archivo = { ...tramo, ops }
    const b = decodificar(codificar(a))
    expect(b).toEqual(a)
  })

  it('mismas operaciones dan los mismos bytes', () => {
    const ops = () => operacionesDeMentira({ semilla: 3, desde: DESDE, hasta: HASTA, p0: 100, n: 5000 })
    expect(codificar({ ...tramo, ops: ops() })).toEqual(codificar({ ...tramo, ops: ops() }))
  })

  it('un tramo sin operaciones también se guarda (un bloque vacío no es un bloque que falta)', () => {
    const u8 = codificar({ ...tramo, ops: vacias() })
    expect(u8.length).toBe(ENCABEZADO)
    expect(decodificar(u8)).toEqual({ ...tramo, ops: vacias() })
  })

  it('aguanta valores en los extremos', () => {
    const extremos: Operacion[] = [
      { t: DESDE, p: -0x80000000, q: 0xffffffff, lado: -1 },
      { t: HASTA - 1, p: 0x7fffffff, q: 1, lado: 1 },
    ]
    const a = { ...tramo, ops: aColumnas(extremos) }
    expect(aLista(decodificar(codificar(a)).ops)).toEqual(extremos)
  })

  it('ocupa menos de 5 bytes por operación antes de comprimir', () => {
    const ops = operacionesDeMentira({ semilla: 11, desde: DESDE, hasta: HASTA, p0: 25600, n: 100_000 })
    const u8 = codificar({ ...tramo, ops })
    expect((u8.length - ENCABEZADO) / ops.n).toBeLessThan(5)
  })
})

describe('gzip', () => {
  it('comprime y descomprime sin cambiar nada', async () => {
    const ops = operacionesDeMentira({ semilla: 5, desde: DESDE, hasta: HASTA, p0: 25600, n: 20_000 })
    const u8 = codificar({ ...tramo, ops })
    const gz = await comprimir(u8)
    expect(gz[0]).toBe(0x1f)
    expect(gz.length).toBeLessThan(u8.length)
    expect(await descomprimir(gz)).toEqual(u8)
    expect((await leer(gz)).ops).toEqual(ops)
  })

  it('si ya viene descomprimido lo deja igual', async () => {
    const u8 = codificar({ ...tramo, ops: aColumnas(chicas) })
    expect(await descomprimir(u8)).toEqual(u8)
  })
})

describe('errores', () => {
  const codificarLista = (lista: Operacion[], extra: Partial<typeof tramo> = {}) =>
    codificar({ ...tramo, ...extra, ops: aColumnas(lista) })

  it('no acepta operaciones fuera de orden ni fuera del tramo', () => {
    expect(() => codificarLista([chicas[1], chicas[0]])).toThrow(ErrorFormato)
    expect(() => codificarLista([{ ...chicas[0], t: DESDE - 1 }])).toThrow(ErrorFormato)
    expect(() => codificarLista([{ ...chicas[0], t: HASTA }])).toThrow(ErrorFormato)
  })

  it('no acepta valores que no caben', () => {
    expect(() => aColumnas([{ ...chicas[0], t: DESDE + 0.5 }])).toThrow(ErrorFormato)
    expect(() => aColumnas([{ ...chicas[0], p: 2.5 }])).toThrow(ErrorFormato)
    expect(() => aColumnas([{ ...chicas[0], p: 2 ** 31 }])).toThrow(ErrorFormato)
    expect(() => aColumnas([{ ...chicas[0], q: 0 }])).toThrow(ErrorFormato)
    expect(() => aColumnas([{ ...chicas[0], q: 2 ** 32 }])).toThrow(ErrorFormato)
    expect(() => aColumnas([{ ...chicas[0], lado: 0 as 1 }])).toThrow(ErrorFormato)
  })

  it('no acepta un tramo mal escrito', () => {
    expect(() => codificarLista(chicas, { mercado: 'mq' })).toThrow(ErrorFormato)
    expect(() => codificarLista(chicas, { mercado: 'DEMASIADOLARGO' })).toThrow(ErrorFormato)
    expect(() => codificarLista(chicas, { version: 70_000 })).toThrow(ErrorFormato)
    expect(() => codificarLista([], { desde: HASTA, hasta: DESDE })).toThrow(ErrorFormato)
  })

  it('no acepta noticias fuera de orden ni con valores que no son centésimas enteras', () => {
    const mal = (noticias: NoticiaDelTramo[]) => () => codificar({ ...tramo, ops: vacias(), noticias })
    expect(mal([{ ...empleo, t: EMPLEO + 1 }, empleo])).toThrow(ErrorFormato)
    expect(mal([{ ...empleo, esperado: 2.5 }])).toThrow(ErrorFormato)
    expect(mal([{ ...empleo, tipo: 300 }])).toThrow(ErrorFormato)
  })

  it('rechaza archivos que no son OPR2 ni OPR1, cortados o con bytes de más', () => {
    const u8 = codificarLista(chicas)
    const otro = u8.slice()
    otro[3] = 0x33
    expect(() => decodificar(otro)).toThrow('No es un archivo de operaciones')
    expect(() => decodificar(u8.slice(0, 20))).toThrow('cortado')
    expect(() => decodificar(u8.slice(0, -1))).toThrow('cortado')
    expect(() => decodificar(new Uint8Array([...u8, 0]))).toThrow('Sobran bytes')
  })

  it('rechaza un archivo cuyas operaciones se salen del tramo', () => {
    const u8 = codificarLista(chicas)
    const dv = new DataView(u8.buffer)
    dv.setFloat64(32, DESDE + 5, true) // el tramo termina antes de la segunda operación
    expect(() => decodificar(u8)).toThrow('fuera del tramo')
  })
})
