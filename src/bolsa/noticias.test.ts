// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { enNY, sesion } from './calendario.ts'
import { afecta, CALENDARIO_HASTA, DATOS, noticiasDelDia, TIPOS_NOTICIA, type TipoNoticia } from './noticias.ts'

/** Todas las noticias de un tipo entre dos días (de sesión), en orden. */
function todas(tipo: TipoNoticia, desde = 20180101, hasta = CALENDARIO_HASTA) {
  const lista: { dia: number; h: number; m: number; t: number }[] = []
  for (let d = new Date(Date.UTC(2017, 11, 31)); ; d = new Date(d.getTime() + 86_400_000)) {
    const dia = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
    if (dia > hasta) break
    if (dia < desde) continue
    for (const n of noticiasDelDia(dia)) if (n.tipo === tipo) lista.push({ dia, h: n.h, m: n.m, t: n.t })
  }
  return lista
}

describe('calendario de noticias', () => {
  it('trae los datos de cada fuente de 2018 a 2027, en orden y sin repetir', () => {
    const cuantas = Object.fromEntries(TIPOS_NOTICIA.map((t) => [t, todas(t).length]))
    expect(cuantas).toEqual({ empleo: 119, inflacion: 119, tasa: 81, inventarios: 521, tasaEuro: 80, inflacionEuro: 120 })
    for (const tipo of TIPOS_NOTICIA) {
      const ts = todas(tipo).map((n) => n.t)
      expect(ts, tipo).toEqual([...ts].sort((a, b) => a - b))
      expect(new Set(ts).size, tipo).toBe(ts.length)
    }
  })

  it('el empleo y la inflación salen a las 8:30, y en octubre de 2025 no salieron', () => {
    for (const tipo of ['empleo', 'inflacion'] as const) {
      for (const n of todas(tipo)) expect([n.h, n.m]).toEqual([8, 30])
      expect(todas(tipo, 20251101, 20251130).length, tipo).toBe(tipo === 'empleo' ? 1 : 0)
    }
    // El empleo de septiembre salió el jueves 20 de noviembre de 2025.
    expect(noticiasDelDia(20251120).map((n) => n.tipo)).toContain('empleo')
  })

  it('la tasa sale a las 14:00, con los recortes de emergencia de marzo de 2020', () => {
    const marzo = todas('tasa', 20200301, 20200331)
    expect(marzo.map((n) => [n.dia, n.h, n.m])).toEqual([
      [20200303, 10, 0],
      [20200316, 17, 0], // domingo 15 a las 17:00: cae en la sesión del lunes, antes de que abra
    ])
    const lunes = sesion('futuros', 20200316)
    expect(lunes && marzo[1].t < lunes.abre).toBe(true)
    expect(marzo[1].t).toBe(enNY(20200315, 17, 0))
  })

  it('los inventarios salen los miércoles a las 10:30, salvo en las semanas de feriado', () => {
    const lista = todas('inventarios')
    const normales = lista.filter((n) => n.h === 10 && n.m === 30)
    expect(normales.length / lista.length).toBeGreaterThan(0.85)
    // Memorial Day de 2024: el jueves 30 de mayo a las 11:00.
    expect(todas('inventarios', 20240527, 20240531).map((n) => [n.dia, n.h])).toEqual([[20240530, 11]])
    // Navidad de 2025: el lunes 29 de diciembre a las 17:00, que cae en la sesión del martes.
    expect(todas('inventarios', 20251222, 20251231).map((n) => [n.dia, n.h])).toEqual([
      [20251230, 17],
      [20251231, 10],
    ])
  })

  it('la tasa europea pasa de 13:45 a 14:15 de Fráncfort en julio de 2022, y se ve en la hora de Nueva York', () => {
    const hora = (dia: number) => todas('tasaEuro', dia, dia).map((n) => `${n.h}:${n.m}`)
    expect(hora(20220609)).toEqual(['7:45'])
    expect(hora(20220721)).toEqual(['8:15'])
    expect(hora(20260319)).toEqual(['9:15']) // EE.UU. ya cambió de horario y Europa todavía no
  })

  it('cada dato sale en el calendario de sus mercados', () => {
    expect(afecta('empleo', 'BTY')).toBe(true)
    expect(afecta('inventarios', 'WT')).toBe(true)
    expect(afecta('inventarios', 'MQ')).toBe(false)
    expect(afecta('tasaEuro', 'EW')).toBe(true)
    expect(afecta('inflacionEuro', 'SP')).toBe(false)
    for (const tipo of TIPOS_NOTICIA) expect(DATOS[tipo].nombre.length).toBeGreaterThan(0)
  })
})
