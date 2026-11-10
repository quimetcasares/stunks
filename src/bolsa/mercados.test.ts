// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { aTicks, ficha, fichaPorId, MERCADOS, precio, sesionDe, textoPrecio, valorTick } from './mercados.ts'

describe('ficha de contrato', () => {
  it('son 12 mercados con claves distintas', () => {
    expect(MERCADOS.map((f) => f.clave)).toEqual([
      'MQ',
      'SP',
      'DJ',
      'FL',
      'WT',
      'FG',
      'EW',
      'BTY',
      'ETR',
      'SLMI',
      'FIDO',
      'CHUPA',
    ])
  })

  it('cada uno tiene su id interno fijo, de B01 a B12', () => {
    expect(MERCADOS.map((f) => f.id)).toEqual(MERCADOS.map((_, i) => `B${String(i + 1).padStart(2, '0')}`))
    expect(fichaPorId('B07').clave).toBe('EW')
    expect(() => fichaPorId('B13')).toThrow('No hay un mercado')
  })

  it('cada tick vale lo de su contrato, normal y micro', () => {
    const tabla = MERCADOS.filter((f) => f.horario === 'futuros').map((f) => [
      f.clave,
      valorTick(f),
      f.micro ? valorTick(f, true) : null,
    ])
    expect(tabla).toEqual([
      ['MQ', 5, 0.5],
      ['SP', 12.5, 1.25],
      ['DJ', 5, 0.5],
      ['FL', 5, 0.5],
      ['WT', 10, 1],
      ['FG', 10, 1],
      ['EW', 6.25, 0.625],
    ])
    expect(() => valorTick(ficha('BTY'), true)).toThrow('no tiene micro')
  })

  it('los decimales alcanzan justo para el tick', () => {
    for (const f of MERCADOS) {
      const escalado = f.tick * 10 ** f.decimales
      expect(Math.abs(escalado - Math.round(escalado))).toBeLessThan(1e-9)
      if (f.decimales > 0) expect(Math.abs(escalado / 10 - Math.round(escalado / 10))).toBeGreaterThan(1e-9)
    }
  })

  it('muestra los precios exactos, sin errores de punto flotante', () => {
    expect(textoPrecio(ficha('MQ'), 25601)).toBe('6400.25')
    expect(textoPrecio(ficha('DJ'), 24800)).toBe('24800')
    expect(textoPrecio(ficha('FL'), 15403)).toBe('1540.3')
    expect(textoPrecio(ficha('WT'), 6003)).toBe('60.03')
    expect(textoPrecio(ficha('EW'), 24001)).toBe('1.20005')
    expect(textoPrecio(ficha('FIDO'), 9000)).toBe('0.009000')
    expect(textoPrecio(ficha('CHUPA'), 61234)).toBe('0.00061234')
    expect(textoPrecio(ficha('MQ'), -1)).toBe('-0.25')
    expect(precio(ficha('FL'), 3)).toBe(0.3)
  })

  it('de precio a ticks y de regreso', () => {
    for (const f of MERCADOS) {
      for (const t of [1, 7, 12345, 999_999]) expect(aTicks(f, precio(f, t))).toBe(t)
    }
  })

  it('cada mercado existe desde su primera sesión', () => {
    expect(sesionDe(ficha('MQ'), 20180102)).not.toBeNull()
    expect(sesionDe(ficha('SLMI'), 20200331)).toBeNull()
    expect(sesionDe(ficha('SLMI'), 20200401)).not.toBeNull()
    expect(sesionDe(ficha('CHUPA'), 20231231)).toBeNull()
    expect(sesionDe(ficha('CHUPA'), 20240106)).not.toBeNull() // sábado: cripto abre siempre
    expect(sesionDe(ficha('MQ'), 20240106)).toBeNull()
  })

  it('una clave que no existe es un error', () => {
    expect(() => ficha('NQ')).toThrow('No hay un mercado')
  })
})
