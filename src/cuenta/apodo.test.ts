import { describe, expect, it } from 'vitest'
import { apodoValido, sugerirApodo } from './apodo'

describe('apodo', () => {
  it('acepta letras, números, guion y guion bajo, de 3 a 20', () => {
    expect(apodoValido('ana_trader')).toBe(true)
    expect(apodoValido('NQ-2026')).toBe(true)
    expect(apodoValido('abc')).toBe(true)
    expect(apodoValido('a'.repeat(20))).toBe(true)
  })

  it('rechaza lo que la base rechazaría', () => {
    expect(apodoValido('ab')).toBe(false)
    expect(apodoValido('a'.repeat(21))).toBe(false)
    expect(apodoValido('con espacio')).toBe(false)
    expect(apodoValido('josé')).toBe(false)
    expect(apodoValido('')).toBe(false)
  })

  it('sugiere un apodo válido a partir del correo o del nombre', () => {
    expect(sugerirApodo('ana.trader@example.com')).toBe('anatrader')
    expect(sugerirApodo('José Pérez')).toBe('Jose_Perez')
    expect(sugerirApodo('yo@example.com')).toBe('')
    expect(apodoValido(sugerirApodo('un-nombre-muy-largo-de-mas-de-veinte@example.com'))).toBe(true)
  })
})
