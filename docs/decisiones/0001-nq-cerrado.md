# 0001 · Los datos del NQ nunca son públicos

**Estado:** vigente; el tope de cuentas lo reemplaza la [0007](0007-nq-sin-tope.md) · **Fecha:** 2026-11-06

## Contexto

Los datos del NQ (velas de 250 de volumen desde 2011) son datos de CME comprados a un proveedor. La guía de CME para información histórica (PM21_MD002/0924) dice que cualquiera que distribuya información histórica necesita una licencia de distribución, sin excepción por ser gratis, educativo o poca cantidad, y que mostrarla dentro de una plataforma también cuenta como distribuir.

## Decisión

- El NQ nunca va en el repo, ni en la página pública, ni en un endpoint abierto.
- En local vive en `practica/datos/` (ignorado por git).
- En la plataforma, solo lo ven cuentas aprobadas a mano (gente conocida), con un tope de 10 a 15 cuentas, sin botón de descarga, con enlaces que caducan en minutos, marca invisible por usuario y alertas de uso raro.
- Abrirlo a desconocidos requiere la licencia de CME.

## Consecuencias

- Las pruebas automáticas y la integración continua usan un mercado de mentira (`src/practica/sintetico.ts`).
- La demo pública usa cripto (ver 0002).
- No se puede impedir al 100% que alguien con acceso saque los datos de su navegador; la marca por usuario permite saber de qué cuenta salieron.
