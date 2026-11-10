// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { aTicks, ficha, MERCADOS, precio, sesionDe, textoPrecio, valorTick } from './mercados'

describe('ficha de contrato', () => {
  it('son 12 mercados con claves distintas', () => {
    expect(MERCADOS.map((f) => f.clave)).toEqual([
      'MQ',
      'EP',
      'DJ',
      'PU',
      'CR',
      'OR',
      'PS',
      'BTY',
      'ETR',
      'SOLE',
      'FIRU',
      'CHUPA',
    ])
  })

  it('cada tick vale lo de su contrato, normal y micro', () => {
    const tabla = MERCADOS.filter((f) => f.horario === 'futuros').map((f) => [
      f.clave,
      valorTick(f),
      f.micro ? valorTick(f, true) : null,
    ])
    expect(tabla).toEqual([
      ['MQ', 5, 0.5],
      ['EP', 12.5, 1.25],
      ['DJ', 5, 0.5],
      ['PU', 5, 0.5],
      ['CR', 10, 1],
      ['OR', 10, 1],
      ['PS', 5, null],
    ])
    expect(() => valorTick(ficha('PS'), true)).toThrow('no tiene micro')
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
    expect(textoPrecio(ficha('PU'), 15403)).toBe('1540.3')
    expect(textoPrecio(ficha('CR'), 6003)).toBe('60.03')
    expect(textoPrecio(ficha('PS'), 5050)).toBe('0.05050')
    expect(textoPrecio(ficha('FIRU'), 9000)).toBe('0.009000')
    expect(textoPrecio(ficha('MQ'), -1)).toBe('-0.25')
    expect(precio(ficha('PU'), 3)).toBe(0.3)
  })

  it('de precio a ticks y de regreso', () => {
    for (const f of MERCADOS) {
      for (const t of [1, 7, 12345, 999_999]) expect(aTicks(f, precio(f, t))).toBe(t)
    }
  })

  it('cada mercado existe desde su primera sesión', () => {
    expect(sesionDe(ficha('MQ'), 20180102)).not.toBeNull()
    expect(sesionDe(ficha('SOLE'), 20200331)).toBeNull()
    expect(sesionDe(ficha('SOLE'), 20200401)).not.toBeNull()
    expect(sesionDe(ficha('CHUPA'), 20231231)).toBeNull()
    expect(sesionDe(ficha('CHUPA'), 20240106)).not.toBeNull() // sábado: cripto abre siempre
    expect(sesionDe(ficha('MQ'), 20240106)).toBeNull()
  })

  it('una clave que no existe es un error', () => {
    expect(() => ficha('NQ')).toThrow('No hay un mercado')
  })
})
