# Cambios

Formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/).

## [0.1.0] · 2026-11-06

### Agregado

- Práctica local con datos del NQ (`practicar.bat`): replay de 1x a 100x desde la reapertura, la apertura de NY o cualquier hora; gráficas de 2500 y 250 de volumen; día al azar y modo a ciegas.
- Órdenes de compra y venta con stop y objetivo, cierre a mano, PnL en vivo y marcador contra la jugada al revés.
- Motor de llenados idéntico al del juego (3,000 de 3,000 jugadas iguales).
- Diario de jugadas en el navegador.
- Base profesional: Biome, pruebas con Vitest y Playwright, revisión automática en GitHub Actions, Dependabot, plantillas de PR e issues, licencia AGPL y decisiones escritas.

### Cambiado

- El nombre de la app pasó de Edge or Luck a Stunks.

## [0.0.1] · 2026-11-05

### Agregado

- Fase 0: prueba técnica que baja un día completo de trades de Kraken (218,259 trades en 3 min 50 s) y las velas de 1 minuto de Coinbase desde el navegador.
