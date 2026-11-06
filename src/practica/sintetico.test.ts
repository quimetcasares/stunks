import { describe, expect, it } from 'vitest'
import { decodificar } from './datos'
import { codificar, mercadoDeMentira } from './sintetico'

describe('mercadoDeMentira', () => {
  it('sale igual cada vez', () => {
    expect(mercadoDeMentira()).toEqual(mercadoDeMentira())
  })

  it('trae enero y febrero de 2001, solo días hábiles, con el día de relleno al inicio de febrero', () => {
    const [ene, feb] = mercadoDeMentira()
    expect(ene.m).toBe('2001-01')
    expect(feb.m).toBe('2001-02')
    expect(ene.dias.some((D) => D.pad)).toBe(false)
    expect(feb.dias[0].pad).toBe(true)
    expect(feb.dias[0].fecha).toBe(ene.dias[ene.dias.length - 1].fecha)
    for (const D of [...ene.dias, ...feb.dias]) {
      const dow = new Date(Date.UTC(2001, (Math.floor(D.fecha / 100) % 100) - 1, D.fecha % 100)).getUTCDay()
      expect(dow).toBeGreaterThan(0)
      expect(dow).toBeLessThan(6)
    }
  })

  it('cada mes se puede codificar y leer como los datos reales', () => {
    for (const { dias } of mercadoDeMentira()) {
      const leidos = decodificar(codificar(dias).buffer as ArrayBuffer)
      expect(leidos.map((D) => D.fecha)).toEqual(dias.map((D) => D.fecha))
      expect(leidos.map((D) => D.n)).toEqual(dias.map((D) => D.velas.length))
    }
  })
})
