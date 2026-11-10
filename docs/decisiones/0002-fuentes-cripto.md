# 0002 · De dónde salen los datos de cripto

**Estado:** reemplazada por la [0010](0010-bolsa-de-stunks.md) · **Fecha:** 2026-11-06

## Contexto

La demo pública necesita datos que se puedan mostrar. Se revisaron los términos de cinco fuentes (detalle en `docs/terminos-datos.md`).

| Fuente         | Resultado                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Kraken         | Prohíbe apps de terceros que usen sus datos sin permiso escrito (Global Terms §9)                                                             |
| Coinbase       | Prohíbe usar sus datos para "an application intended for use by end users" y mostrarlos a terceros (Market Data Terms, 7-ago-2026, §2 y §3.2) |
| OKX            | Solo uso personal, incluso sin llave de API (§9.4, §3.2a)                                                                                     |
| Bybit          | Bloquea EE.UU.                                                                                                                                |
| Binance Vision | CC BY-NC-SA 4.0; permite "non-monetized open educational projects" (Dataset Terms v1.0, 26-ago-2026, §4.1)                                    |

## Decisión

- Binance Vision es la única fuente candidata para la demo pública, porque Stunks es gratis, educativo y de código abierto.
- Antes de publicarla falta: leer el texto exacto del §8.3 ("consumer-facing software") y confirmar que `data-api.binance.vision` entra en "associated endpoints".
- Se pone la atribución "Datos: Binance Vision" donde se muestren.
- Kraken y Coinbase solo con permiso escrito (marketdata@kraken.com, marketdata@coinbase.com).

## Consecuencias

- Si Binance no se confirma, la demo usa el mercado de mentira.
- Stunks nunca guarda ni sirve datos de exchanges: los pide el navegador de cada usuario.
