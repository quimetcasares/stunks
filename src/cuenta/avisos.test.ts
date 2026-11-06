import { describe, expect, it } from 'vitest'
import { AVISOS, avisosPendientes } from './avisos'

describe('avisos pendientes', () => {
  it('una cuenta nueva tiene los dos avisos pendientes', () => {
    expect(avisosPendientes([])).toEqual(['privacidad', 'grabacion'])
  })

  it('con las versiones vigentes aceptadas no falta nada', () => {
    expect(
      avisosPendientes([
        { documento: 'privacidad', version: AVISOS.privacidad },
        { documento: 'grabacion', version: AVISOS.grabacion },
      ]),
    ).toEqual([])
  })

  it('una versión vieja no cuenta: hay que aceptar la nueva', () => {
    expect(
      avisosPendientes([
        { documento: 'privacidad', version: '2000-01-01' },
        { documento: 'grabacion', version: AVISOS.grabacion },
      ]),
    ).toEqual(['privacidad'])
  })

  it('las versiones caben en la columna de la base (1 a 20 caracteres)', () => {
    for (const v of Object.values(AVISOS)) expect(v.length).toBeLessThanOrEqual(20)
  })
})
