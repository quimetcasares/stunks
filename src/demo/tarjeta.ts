// Tarjeta para compartir, estilo Wordle y sin spoilers: solo si le atinó o no en cada gráfica, el puntaje y el número del reto.
// Nunca dice cuál era real ni la fuente, ni lleva ninguna dato de las ventanas; se arma en el navegador con lo que ya contestó.
export const URL_DEMO = 'https://stunks.app/real-or-stunks'

export const cuadritos = (resultados: boolean[]) => resultados.map((b) => (b ? '🟩' : '🟥')).join('')

export function textoParaCompartir(resultados: boolean[], numero: number | null, url = URL_DEMO): string {
  const aciertos = resultados.filter(Boolean).length
  const titulo = numero ? `Real or Stunks? #${numero}` : 'Real or Stunks?'
  return `${titulo} ${aciertos}/${resultados.length}\n${cuadritos(resultados)}\nCan you tell real ETH from a made-up market?\n${url}`
}

/** SVG de 600 x 340 con los cuadritos, para guardar o compartir como imagen. */
export function tarjetaSvg(resultados: boolean[], numero: number | null): string {
  const aciertos = resultados.filter(Boolean).length
  const lado = 44
  const hueco = 8
  const ancho = resultados.length * (lado + hueco) - hueco
  const x0 = (600 - ancho) / 2
  const cuadros = resultados
    .map(
      (b, i) =>
        `<rect x="${x0 + i * (lado + hueco)}" y="170" width="${lado}" height="${lado}" rx="8" fill="${b ? '#089981' : '#f23645'}"/>`,
    )
    .join('')
  const titulo = numero ? `Real or Stunks? #${numero}` : 'Real or Stunks?'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340" role="img" aria-label="${titulo}: ${aciertos} of ${resultados.length}">` +
    `<rect width="600" height="340" rx="18" fill="#131722"/>` +
    `<text x="300" y="70" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="30" font-weight="800" fill="#ffc531">${titulo}</text>` +
    `<text x="300" y="140" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="54" font-weight="800" fill="#f0f3fa">${aciertos} / ${resultados.length}</text>` +
    cuadros +
    `<text x="300" y="270" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="20" fill="#d1d4dc">Can you tell real ETH from a made-up market?</text>` +
    `<text x="300" y="305" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="18" fill="#787b86">stunks.app/real-or-stunks</text>` +
    `</svg>`
  )
}

/** La tarjeta como PNG (en el navegador). */
export async function tarjetaPng(resultados: boolean[], numero: number | null): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([tarjetaSvg(resultados, numero)], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 1200
    c.height = 680
    c.getContext('2d')?.drawImage(img, 0, 0, 1200, 680)
    return await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('png'))), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}
