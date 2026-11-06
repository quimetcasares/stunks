# 0006 · La web publicada usa el mercado de mentira

**Estado:** vigente · **Fecha:** 2026-11-06

## Contexto

Con la F0, `main` y cada PR se publican en Cloudflare Pages, en direcciones que cualquiera puede abrir. Ahí no pueden ir los datos del NQ ([0001](0001-nq-cerrado.md)), y Kraken y Coinbase no se pueden usar sin permiso escrito ([0002](0002-fuentes-cripto.md)). El acceso al NQ por cuenta llega con la F1 y la F2.

## Decisión

- La versión que se publica (`npm run build`) arma en el navegador el mercado de mentira de `src/practica/sintetico.ts` y lo usa en la práctica, con un aviso visible de que son datos de ejemplo.
- La prueba técnica de Kraken y Coinbase no aparece en la web, y `public/_headers` solo deja que la página pida datos a su propio sitio (`connect-src 'self'`).
- En local (`npm run dev`, `practicar.bat`, `npm run build:archivo`) todo sigue igual.
- Una prueba de punta a punta (`e2e/web.spec.ts`) revisa la versión publicada: abre un día, opera y confirma que no sale ninguna petición a otro sitio.

## Consecuencias

- Cada vista previa sirve para probar gráfica, replay y órdenes en compu y cel sin datos reales.
- Cuando el NQ llegue por cuenta (F2), la web lo pedirá a Supabase solo para cuentas con acceso, y esta decisión se reemplaza.
- Si Binance Vision se confirma ([0002](0002-fuentes-cripto.md)), su dominio se agrega a `connect-src`.
