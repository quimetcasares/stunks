import { describe, expect, it } from 'vitest'
import { cuadritos, tarjetaSvg, textoParaCompartir } from './tarjeta'

const r = [true, false, true, true, false, true, true, true, false, true]

describe('tarjeta sin spoilers', () => {
  it('el texto lleva puntaje, cuadritos y la dirección, y nada más', () => {
    const t = textoParaCompartir(r, 12, 'https://stunks.app/real-or-stunks')
    expect(t).toBe(
      `Real or Stunks? #12 7/10\n🟩🟥🟩🟩🟥🟩🟩🟩🟥🟩\nCan you tell real ETH from a made-up market?\nhttps://stunks.app/real-or-stunks`,
    )
    expect(cuadritos([true, false])).toBe('🟩🟥')
  })
  it('sin número de reto no inventa uno', () => {
    expect(textoParaCompartir([true], null)).toMatch(/^Real or Stunks\? 1\/1/)
  })
  it('el SVG tiene un cuadro por gráfica y ningún dato de las ventanas', () => {
    const svg = tarjetaSvg(r, 3)
    expect(svg.match(/<rect x=/g)).toHaveLength(10)
    expect(svg).toContain('7 / 10')
    expect(svg.startsWith('<svg')).toBe(true)
    for (const prohibido of ['dydx', 'ETR', 'Ethereal', 'ventana']) expect(svg).not.toContain(prohibido)
  })
})
