// Todo lo que identifica a la app vive aquí. Para cambiar el nombre, se cambia en este archivo
// (y en el <title> de index.html).
export const APP = {
  name: 'Stunks',
  version: '0.1.0',
  phase: 0,
  // Exchanges que llama la prueba técnica. Solo en local: la web publicada no llama a ninguno
  // y public/_headers no los permite (ver docs/decisiones/0006-web-sin-datos-reales.md).
  dataHosts: ['https://api.kraken.com', 'https://api.exchange.coinbase.com'],
} as const

/**
 * Verdadero en la versión que se publica en Cloudflare Pages (`npm run build`).
 * Ahí no hay datos del NQ ni llamadas a exchanges: la práctica usa el mercado de mentira.
 */
export const WEB = import.meta.env.MODE === 'production'

export const DAY_MS = 86_400_000
