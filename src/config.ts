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

/**
 * Supabase para las cuentas (docs/decisiones/0008-cuentas.md). La llave es la publicable: va en la
 * página por diseño y lo que protege los datos son las reglas por fila.
 *  - Web publicada: el proyecto de producción.
 *  - `npm run dev` y las pruebas: el Supabase local (`npm run db:iniciar`).
 *  - Práctica local y archivo: sin cuentas.
 */
export const SUPABASE: { url: string; llave: string } | null =
  import.meta.env.MODE === 'production'
    ? { url: 'https://mqzgmccfykqkkxyunssp.supabase.co', llave: 'sb_publishable__1bsrdmn105h1WUKbTIP6w_VhyTDC1N' }
    : import.meta.env.MODE === 'development'
      ? { url: 'http://127.0.0.1:45321', llave: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' }
      : null

export const DAY_MS = 86_400_000
