// Todo lo que identifica a la app vive aquí. Para cambiar el nombre, se cambia en este archivo
// (y en el <title> de index.html).
export const APP = {
  name: 'Stunks',
  version: '0.1.0',
  phase: 0,
  // Fuentes de datos que la página tiene permiso de llamar (también van en public/_headers).
  dataHosts: ['https://api.kraken.com', 'https://api.exchange.coinbase.com'],
} as const

export const DAY_MS = 86_400_000
