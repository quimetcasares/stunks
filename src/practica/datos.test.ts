import { describe, expect, it } from 'vitest'
import { decodificar, fechaTexto, horaNY, segundosDesdeReapertura } from './datos'
import { codificar, diaFalso } from './sintetico'

describe('decodificar (formato NQJ1)', () => {
  it('regresa exactamente los días y las velas que se codificaron', () => {
    const pad = diaFalso(20000102, 946767600, 60000, 300, 1, true)
    const dia = diaFalso(20000103, 946854000, 60400, 500, 2)
    const u8 = codificar([pad, dia])
    const dias = decodificar(u8.buffer as ArrayBuffer)

    expect(dias).toHaveLength(2)
    expect(dias[0].pad).toBe(true)
    expect(dias[1].fecha).toBe(20000103)
    expect(dias[1].t0).toBe(946854000)
    expect(dias[1].n).toBe(500)
    for (let j = 0; j < 500; j++) {
      const v = dia.velas[j]
      const D = dias[1]
      expect([D.t[j], D.o[j], D.h[j], D.l[j], D.c[j], D.g[j], D.vol[j], D.bv[j]]).toEqual([
        v.t,
        v.o,
        v.h,
        v.l,
        v.c,
        v.g,
        v.v,
        v.bv,
      ])
    }
  })

  it('rechaza un archivo que no es NQJ1', () => {
    expect(() => decodificar(new Uint8Array(32).buffer)).toThrow(/formato desconocido/)
    // la clave es la que usa la interfaz para mostrar el aviso en el idioma elegido
    expect(() => decodificar(new Uint8Array(32).buffer)).toThrow(expect.objectContaining({ clave: 'formato' }))
  })
})

describe('horas', () => {
  it('convierte segundos desde la reapertura a hora de Nueva York', () => {
    expect(horaNY(0)).toBe('18:00')
    expect(horaNY(55800)).toBe('09:30')
    expect(horaNY(79800, true)).toBe('16:10:00')
  })

  it('convierte una hora de Nueva York a segundos desde la reapertura', () => {
    expect(segundosDesdeReapertura('18:00')).toBe(0)
    expect(segundosDesdeReapertura('23:30')).toBe(5.5 * 3600)
    expect(segundosDesdeReapertura('09:30')).toBe(55800)
  })

  it('escribe la fecha de la sesión', () => {
    expect(fechaTexto(20261007)).toBe('2026-10-07')
  })
})
