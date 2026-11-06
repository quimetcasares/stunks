import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { type Dia, decodificar } from './datos'
import { NQ, resolver, T_CIERRE } from './motor'
import { diaDePrueba } from './sintetico'

// Velas de prueba en puntos. La vela 0 es en la que se decide; la entrada es en la apertura de la vela e.
const base = (extra: { t: number; o: number; h: number; l: number; c: number }[]) =>
  diaDePrueba([{ t: 0, o: 100, h: 101, l: 99, c: 100 }, ...extra])

describe('motor de llenados (reglas del juego)', () => {
  it('entra en la apertura de la vela siguiente, 1 tick en contra', () => {
    const D = base([
      { t: 10, o: 100, h: 101, l: 99, c: 100 },
      { t: 20, o: 100, h: 112, l: 99, c: 111 },
    ])
    expect(resolver(D, 1, 1, 10, 10, 1).entrada).toBe(100.25)
    expect(resolver(D, 1, -1, 10, 10, 1).entrada).toBe(99.75)
  })

  it('el stop se llena en el peor precio, con deslizamiento de max(1 tick, 2.65% del stop)', () => {
    const D = base([
      { t: 10, o: 100, h: 100.5, l: 99.5, c: 100 },
      { t: 20, o: 95, h: 96, l: 80, c: 85 }, // abre debajo del stop
    ])
    const r = resolver(D, 1, 1, 4, 8, 1)
    expect(r.tipo).toBe('stop')
    expect(r.js).toBe(2)
    // stop en 96.25; abre en 95, así que se llena en 95 menos max(0.25, 0.106) = 94.75
    expect(r.salida).toBe(94.75)
    expect(r.neto).toBeCloseTo(94.75 - 100.25 - NQ.com / NQ.usd, 9)
  })

  it('el objetivo solo cuenta si el precio lo pasa 1 tick, y nunca en la vela de entrada', () => {
    const toca = base([
      { t: 10, o: 100, h: 120, l: 99, c: 101 }, // vela de entrada: aunque pase el objetivo, no cuenta
      { t: 20, o: 101, h: 110.25, l: 100.5, c: 110 }, // toca justo el objetivo (110.25), no lo pasa
      { t: 30, o: 110, h: 110.5, l: 109, c: 110 }, // ahora sí lo pasa por 1 tick
    ])
    const r = resolver(toca, 1, 1, 50, 10, 1)
    expect(r.tipo).toBe('objetivo')
    expect(r.js).toBe(3)
    expect(r.salida).toBe(110.25)
  })

  it('si el stop y el objetivo caen en la misma vela, cuenta el stop', () => {
    const D = base([
      { t: 10, o: 100, h: 101, l: 99.5, c: 100 },
      { t: 20, o: 100, h: 130, l: 70, c: 100 },
    ])
    expect(resolver(D, 1, 1, 10, 10, 1).tipo).toBe('stop')
  })

  it('sale a las 16:10 ET si no pega nada', () => {
    const D = base([
      { t: 10, o: 100, h: 101, l: 99.5, c: 100.5 },
      { t: T_CIERRE - 5, o: 101, h: 102, l: 100, c: 101.5 },
      { t: T_CIERRE + 5, o: 103, h: 104, l: 102, c: 103 },
    ])
    const r = resolver(D, 1, 1, 50, 50, 2)
    expect(r.tipo).toBe('cierre')
    expect(r.js).toBe(3)
    expect(r.salida).toBe(102.75) // apertura de la vela de las 16:10, 1 tick en contra
    expect(r.usd).toBeCloseTo(2 * ((102.75 - 100.25) * NQ.usd - NQ.com), 9)
  })

  it('cerrar a mano sale en la apertura de la vela siguiente, 1 tick en contra', () => {
    const D = base([
      { t: 10, o: 100, h: 101, l: 99.5, c: 100.5 },
      { t: 20, o: 101, h: 103, l: 100.5, c: 102.5 },
      { t: 30, o: 102.5, h: 103, l: 102, c: 102.75 },
    ])
    const r = resolver(D, 1, 1, 20, 20, 1, NQ, 3)
    expect(r.tipo).toBe('manual')
    expect(r.js).toBe(3)
    expect(r.salida).toBe(102.25)
  })

  it('la jugada al revés es la misma con el lado contrario', () => {
    const D = base([
      { t: 10, o: 100, h: 101, l: 99.5, c: 100.5 },
      { t: 20, o: 100.5, h: 115, l: 100, c: 114 },
    ])
    const ida = resolver(D, 1, 1, 10, 10, 1)
    const vuelta = resolver(D, 1, -1, 10, 10, 1)
    expect(ida.tipo).toBe('objetivo')
    expect(vuelta.tipo).toBe('stop')
  })
})

// Si hay datos reales del NQ en local (practica/datos), compara contra las 3,000 jugadas del motor del juego.
// En GitHub no hay datos del CME, así que ahí se salta.
const carpeta = 'practica/datos/nq/m'
const jugadasJuego = 'practica/pruebas/prueba_motor_js.json'
describe.skipIf(!existsSync(jugadasJuego))('motor contra el juego, con datos reales del NQ en local', () => {
  it('las jugadas del juego salen idénticas (todas las que tengan su mes en local)', () => {
    const jugadas = JSON.parse(readFileSync(jugadasJuego, 'utf8')) as {
      fecha: number
      e: number
      lado: 1 | -1
      stop: number
      obj: number
      tipo: string
      js: number
      neto: number
    }[]
    const meses = new Map<string, Dia[]>()
    let distintas = 0
    let probadas = 0
    for (const x of jugadas) {
      const s = String(x.fecha)
      const m = `${s.slice(0, 4)}-${s.slice(4, 6)}`
      if (!existsSync(join(carpeta, `${m}.bin.gz`))) continue
      if (!meses.has(m)) {
        const u8 = gunzipSync(readFileSync(join(carpeta, `${m}.bin.gz`)))
        meses.set(m, decodificar(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer))
      }
      const D = meses.get(m)?.find((d) => d.fecha === x.fecha && !d.pad)
      if (!D) throw new Error(`falta el día ${x.fecha}`)
      const r = resolver(D, x.e, x.lado, x.stop, x.obj, 1)
      probadas++
      if (r.tipo !== x.tipo || r.js !== x.js || Math.abs(r.neto - x.neto) > 1e-9) distintas++
    }
    console.log(`jugadas del juego probadas: ${probadas} de ${jugadas.length}`)
    expect(probadas).toBeGreaterThan(0)
    expect(distintas).toBe(0)
  })
})
