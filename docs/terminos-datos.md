# Términos de datos y nombre (revisado el 5 y 6 de nov-2026)

Esto es una lista de lo que dicen los términos, no una opinión legal.

## Datos del CME (NQ, MNQ, ES y demás futuros)

No se pueden poner en la página pública, aunque sea gratis. La guía de CME para información histórica (PM21_MD002/0924, 2024) dice:

- "Any entity that distributes Historical Information must hold a Historical Distribution License for each applicable Designated Contract Market (DCM)."
- Para sitios públicos: "the distributor must hold the Distribution License for Historical Information."
- No trae excepción por ser gratis, por uso educativo ni por poca cantidad. "Histórico" solo significa datos de más de 8 horas.
- Si además se pueden descargar (CSV, API), aplica otra licencia. La tarifa es anual, al distribuidor; el monto no viene publicado (marketdata@cmegroup.com).

Falta revisar también los términos de Databento, pero con lo de CME ya basta.

Lo que sí se puede: que cada usuario cargue sus propios datos en su navegador. No salen de su computadora y la página no los guarda ni los sirve.

Guía: https://www.cmegroup.com/market-data/distributor/files/cme-group-data-licensing-policy-guidelines-historical-information-distribution.pdf

## Cripto

Que la app sea gratis ayuda poco: las cláusulas de Kraken y OKX no dependen de cobrar.

|                               | Kraken                                                                                                               | Coinbase Exchange                                                                                                                          | OKX                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Uso                           | "only for your own benefit"; prohíbe "distribute or otherwise commercially exploit" (Global Terms §8-9)              | "exclusively for you or your entity's personal or research purposes" (§2)                                                                  | "solely for your own personal, non-commercial trading" (§9.4)          |
| Apps de terceros              | Prohíbe "develop any third-party applications that interact with Our Content without our prior written consent" (§9) | "may not be used to build an application intended for use by end users" (§2); prohíbe mostrar datos o gráficas derivadas a terceros (§3.2) | Prohíbe "resell, redistribute, publish, display... to any third party" |
| Límite del endpoint de trades | 1 petición por segundo, por IP y por par                                                                             | 10 por segundo por IP, ráfagas de hasta 15                                                                                                 | 100 cada 2 segundos                                                    |
| Veredicto                     | Amarillo tirando a rojo. Se puede pedir permiso por escrito: marketdata@kraken.com                                   | Rojo sin permiso escrito (marketdata@coinbase.com)                                                                                         | Rojo, incluso sin llave de API (§3.2a)                                 |

Coinbase (Market Data Terms, 7-ago-2026, https://www.coinbase.com/legal/market_data): la licencia es solo para uso personal o de investigación y "may not be used to build an application intended for use by end users" (§2); prohíbe mostrar los datos o gráficas derivadas a terceros sin permiso escrito (§3.2). Veredicto: rojo sin permiso escrito (marketdata@coinbase.com).

Binance Vision (CC BY-NC-SA 4.0) permite "proyectos educativos abiertos no monetizados". Con Stunks gratis podría servir, pero hay que revisar qué tan "abierto" tiene que ser el proyecto y qué implica el "share-alike" con código cerrado.

Fuentes:

- https://www.kraken.com/legal/global-terms (actualizada el 30-oct-2026)
- https://support.kraken.com/articles/206548367-What-are-the-REST-API-rate-limits-
- https://docs.cdp.coinbase.com/exchange/rest-api/rate-limits.md
- https://www.okx.com/en-us/help/okx-api-agreement (actualizada el 28-jul-2026)
- https://data.binance.vision/Binance_Vision-Terms_of_Use.pdf

## Nombre: Stunks (6-nov-2026)

- **Tomados**: stunks.com (desde 2018, vence el 26-ene-2027) y stunks.lol (desde abr-2026).
- **Libres** (consulta RDAP del 6-nov-2026, puede cambiar): stunks.app, stunks.io, stunks.trade y stunks.gg.
- No encontré una app de trading llamada "Stunks". Hay nombres parecidos por el meme: la app de iOS "Stonks: Buy High Sell Low" y el token "Stonks (STNK)".
- IMPI sin revisar: https://marcia.impi.gob.mx/marcas/search/quick

Se descartó "Edge or Luck": el .com estaba tomado y ya existía un proyecto con el mismo nombre y casi la misma idea.
