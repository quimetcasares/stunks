import { afterEach, describe, expect, it, vi } from 'vitest'
import { DAY_MS } from '../config'
import { krakenTradesDay } from './kraken'

const dia = Date.parse('2026-11-04T00:00:00Z')
const s = (ms: number) => ms / 1000

// [precio, volumen, tiempo (s), lado, tipo, misc, id]
const fila = (id: number, ms: number, lado: 'b' | 's' = 'b') => ['80000.0', '0.01', s(ms), lado, 'l', '', id]

describe('krakenTradesDay', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('junta las páginas, quita repetidos y corta en el fin del día', async () => {
    const pagina1 = Array.from({ length: 1000 }, (_, i) => fila(i + 1, dia - 5000 + i * 10))
    const pagina2 = [
      fila(1000, dia + 4990), // repetido de la página anterior
      fila(1001, dia + 60_000, 's'),
      fila(1002, dia + DAY_MS + 1), // ya es del día siguiente
    ]
    const respuestas = [pagina1, pagina2]
    const llamadas: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        llamadas.push(url)
        const filas = respuestas.shift() ?? []
        return new Response(JSON.stringify({ error: [], result: { XXBTZUSD: filas, last: '1' } }))
      }),
    )
    vi.useFakeTimers()
    const promesa = krakenTradesDay('XBTUSD', dia)
    await vi.runAllTimersAsync()
    const r = await promesa
    vi.useRealTimers()

    expect(llamadas).toHaveLength(2)
    expect(llamadas[0]).toContain(`since=${BigInt(dia) * 1_000_000n}`)
    // de la página 1 solo cuentan los trades desde la medianoche: ids 501 a 1000
    expect(r.tape.n).toBe(500 + 1)
    expect(r.tape.s[r.tape.n - 1]).toBe(-1)
    expect(r.complete).toBe(true)
  })

  it('reintenta cuando Kraken dice que hay demasiadas peticiones', async () => {
    const respuestas = [
      { error: ['EGeneral:Too many requests'] },
      { error: [], result: { XXBTZUSD: [fila(1, dia + 1000)], last: '1' } },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(respuestas.shift()))),
    )
    vi.useFakeTimers()
    const promesa = krakenTradesDay('XBTUSD', dia)
    await vi.runAllTimersAsync()
    const r = await promesa
    vi.useRealTimers()
    expect(r.requests).toBe(2)
    expect(r.tape.n).toBe(1)
  })
})
