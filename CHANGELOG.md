# Cambios

Formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Agregado

- Versión web para Cloudflare Pages: la práctica corre con un mercado de mentira y un aviso, mientras llega el acceso al NQ por cuenta.
- Publicación en https://stunks.pages.dev: `main` se publica sola y cada PR tiene su vista previa. Con esto queda lista la F0.
- Dirección propia: https://stunks.app.
- Cuentas: entrar con Google o con un link al correo, sin contraseñas; elegir apodo, salir y borrar la cuenta con todo lo suyo.

### Cambiado

- La web publicada ya no muestra la prueba técnica ni puede pedir datos a Kraken o Coinbase; en local sigue igual.
- Toda la app cambia de idioma con el botón ES/EN, también la práctica: textos, avisos, fechas y lo que se dibuja en las gráficas. Sin elección guardada, arranca en el idioma del navegador.

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
