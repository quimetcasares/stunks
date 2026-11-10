// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import {
  desfaseNY,
  diaDeLaSemana,
  enNY,
  feriado,
  horaNY,
  pascua,
  type Sesion,
  sesion,
  sesionEn,
  sesiones,
  sumarDias,
} from './calendario.ts'
import { azar } from './mentira.ts'

const z = (iso: string) => Date.parse(iso)

describe('hora de Nueva York', () => {
  it('cambia de horario a las 2:00 del segundo domingo de marzo y del primer domingo de noviembre', () => {
    expect(desfaseNY(z('2024-03-10T06:59:59.999Z'))).toBe(-5)
    expect(desfaseNY(z('2024-03-10T07:00:00Z'))).toBe(-4)
    expect(desfaseNY(z('2024-11-03T05:59:59.999Z'))).toBe(-4)
    expect(desfaseNY(z('2024-11-03T06:00:00Z'))).toBe(-5)
  })

  it('da lo mismo que la zona America/New_York en 5,000 instantes de 2018 a 2035', () => {
    // Intl solo sirve de referencia aquí; el calendario no lo usa.
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const r = azar(2018)
    const desde = z('2018-01-01T00:00:00Z')
    const hasta = z('2036-01-01T00:00:00Z')
    for (let k = 0; k < 5000; k++) {
      const ms = desde + Math.floor(r() * (hasta - desde))
      const p = Object.fromEntries(fmt.formatToParts(ms).map((x) => [x.type, Number(x.value)]))
      const ny = horaNY(ms)
      expect([ny.dia, ny.h, ny.m, ny.s]).toEqual([p.year * 10000 + p.month * 100 + p.day, p.hour, p.minute, p.second])
    }
  })

  it('pasa una hora de Nueva York a UTC en invierno, en verano y en los días de cambio', () => {
    expect(enNY(20240110, 9, 30)).toBe(z('2024-01-10T14:30:00Z'))
    expect(enNY(20240710, 9, 30)).toBe(z('2024-07-10T13:30:00Z'))
    expect(enNY(20240310, 18)).toBe(z('2024-03-10T22:00:00Z'))
    expect(enNY(20241103, 18)).toBe(z('2024-11-03T23:00:00Z'))
  })
})

describe('fechas', () => {
  it('Pascua cae donde debe', () => {
    expect([2018, 2019, 2020, 2024, 2025, 2030].map(pascua)).toEqual([20180401, 20190421, 20200412, 20240331, 20250420, 20300421])
  })

  it('suma días cruzando meses, años y bisiestos', () => {
    expect(sumarDias(20240228, 1)).toBe(20240229)
    expect(sumarDias(20240229, 1)).toBe(20240301)
    expect(sumarDias(20231231, 1)).toBe(20240101)
    expect(sumarDias(20240101, -1)).toBe(20231231)
    expect(diaDeLaSemana(20240101)).toBe(1)
  })
})

describe('sesiones de futuros', () => {
  const horas = (s: Sesion | null) => s && [new Date(s.abre).toISOString(), new Date(s.cierra).toISOString(), s.corta]

  it('abre a las 18:00 del día anterior y cierra a las 17:00, también el lunes y con cambio de horario', () => {
    expect(horas(sesion('futuros', 20240308))).toEqual(['2024-03-07T23:00:00.000Z', '2024-03-08T22:00:00.000Z', false])
    expect(horas(sesion('futuros', 20240311))).toEqual(['2024-03-10T22:00:00.000Z', '2024-03-11T21:00:00.000Z', false])
  })

  it('no hay sesión en fin de semana', () => {
    expect(sesion('futuros', 20240309)).toBeNull()
    expect(sesion('futuros', 20240310)).toBeNull()
  })

  it('cierra Año Nuevo, Viernes Santo y Navidad, recorridos al lunes o al viernes', () => {
    expect(sesion('futuros', 20240101)).toBeNull()
    expect(sesion('futuros', 20240329)).toBeNull() // Viernes Santo
    expect(sesion('futuros', 20180330)).toBeNull()
    expect(sesion('futuros', 20230102)).toBeNull() // Año Nuevo en domingo
    expect(sesion('futuros', 20221226)).toBeNull() // Navidad en domingo
    expect(sesion('futuros', 20211224)).toBeNull() // Navidad en sábado
    expect(sesion('futuros', 20211231)).not.toBeNull() // Año Nuevo en sábado no se recorre al viernes
  })

  it('después de un día cerrado abre a las 18:00 del día cerrado', () => {
    expect(horas(sesion('futuros', 20221227))?.[0]).toBe('2022-12-26T23:00:00.000Z')
  })

  it('cierra a las 13:00 en los feriados cortos y a las 13:15 en las vísperas', () => {
    expect(horas(sesion('futuros', 20240115))).toEqual(['2024-01-14T23:00:00.000Z', '2024-01-15T18:00:00.000Z', true]) // MLK
    expect(horas(sesion('futuros', 20241128))?.[1]).toBe('2024-11-28T18:00:00.000Z') // Acción de Gracias
    expect(horas(sesion('futuros', 20241129))?.[1]).toBe('2024-11-29T18:15:00.000Z')
    expect(horas(sesion('futuros', 20241224))?.[1]).toBe('2024-12-24T18:15:00.000Z')
    expect(feriado(20260703)?.id).toBe('independencia') // el 4 de julio de 2026 es sábado
  })

  it('Juneteenth cuenta desde 2022', () => {
    expect(feriado(20210618)).toBeNull()
    expect(feriado(20220620)?.id).toBe('juneteenth') // el 19 cayó en domingo
    expect(feriado(20230619)?.id).toBe('juneteenth')
  })

  it('2024 tiene 259 sesiones: 262 días hábiles menos 3 cerrados', () => {
    expect(sesiones('futuros', 20240101, 20241231)).toHaveLength(259)
  })

  it('las sesiones de 2018 a 2030 van en orden, sin encimarse y con 23 horas o menos', () => {
    const lista = sesiones('futuros', 20180101, 20301231)
    for (let i = 0; i < lista.length; i++) {
      const s = lista[i]
      expect(s.abre).toBeLessThan(s.cierra)
      expect(s.cierra - s.abre).toBeLessThanOrEqual(23 * 3_600_000)
      if (i > 0) expect(lista[i - 1].cierra).toBeLessThanOrEqual(s.abre)
    }
  })

  it('sabe qué sesión está abierta en un instante', () => {
    expect(sesionEn('futuros', z('2024-03-10T23:00:00Z'))?.dia).toBe(20240311) // domingo 19:00 en Nueva York
    expect(sesionEn('futuros', z('2024-03-08T22:30:00Z'))).toBeNull() // viernes 17:30
    expect(sesionEn('futuros', z('2024-03-06T21:30:00Z'))?.dia).toBe(20240306) // miércoles 16:30
    expect(sesionEn('futuros', z('2024-03-06T22:30:00Z'))).toBeNull() // 17:30: pausa de 17:00 a 18:00
    expect(sesionEn('futuros', z('2024-03-09T15:00:00Z'))).toBeNull() // sábado
  })
})

describe('sesiones de cripto', () => {
  it('hay sesión todos los días, de 18:00 a 18:00, aunque el día dure 23 o 25 horas', () => {
    expect(sesiones('cripto', 20240101, 20241231)).toHaveLength(366)
    const marzo = sesion('cripto', 20240310)
    const noviembre = sesion('cripto', 20241103)
    expect(marzo && (marzo.cierra - marzo.abre) / 3_600_000).toBe(23)
    expect(noviembre && (noviembre.cierra - noviembre.abre) / 3_600_000).toBe(25)
  })

  it('las 18:00 en punto ya son del día siguiente', () => {
    expect(sesionEn('cripto', z('2024-03-09T23:00:00Z'))?.dia).toBe(20240310)
    expect(sesionEn('cripto', z('2024-03-09T22:59:59.999Z'))?.dia).toBe(20240309)
  })
})
