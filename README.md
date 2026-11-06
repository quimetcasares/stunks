# Stunks

Simulador de trading con replay. Caes en cualquier fecha y hora, lo corres de 1x a 100x, operas con stop y objetivo, y el marcador contra la jugada al revés te dice si tienes ventaja o si fue suerte.

Gratis y de código abierto (AGPL-3.0). Versión actual: **0.1.0**. Plan de trabajo: [docs/roadmap.md](docs/roadmap.md).

En línea: https://stunks.app (con un mercado de mentira; el NQ llega con las cuentas).

## Qué hace hoy

- Replay de velas de 2500 y 250 de volumen, de 1x a 100x o vela por vela.
- Empieza en la reapertura de las 18:00 ET, en la apertura de Nueva York, a una hora elegida o al azar.
- Día al azar y modo a ciegas (sin fecha ni precios reales).
- Compra y venta con stop y objetivo en puntos, cierre a mano y PnL en vivo.
- Llenados realistas: entrada 1 tick en contra, stop con deslizamiento y objetivo solo si el precio lo pasa por 1 tick.
- Marcador contra la jugada al revés y diario de jugadas en el navegador.

## Correrlo

Requiere Node.js 22.

```
npm install
npm run dev
```

### Práctica con datos locales del NQ

Los datos de futuros del CME tienen licencia y no se incluyen en este repositorio (ver [decisión 0001](docs/decisiones/0001-nq-cerrado.md)). Con datos propios en `practica/datos/nq/` (formato NQJ1, un archivo por mes), `practicar.bat` arma un servidor local en http://127.0.0.1:8642/app/ con Python.

Atajos: Espacio play/pausa · → una vela · C comprar · V vender · X cerrar.

## Comandos

| Comando                  | Qué hace                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`            | Servidor de desarrollo en http://localhost:5173                                                                                |
| `npm run ci`             | Estilo, tipos, pruebas unitarias y build, igual que en GitHub                                                                  |
| `npm test`               | Pruebas unitarias (Vitest)                                                                                                     |
| `npm run e2e`            | Pruebas de punta a punta en compu y cel (Playwright), con un mercado de mentira; las de cuentas necesitan `npm run db:iniciar` |
| `npm run format`         | Formato y orden de imports (Biome)                                                                                             |
| `npm run build`          | `dist/` para Cloudflare Pages, con el mercado de mentira                                                                       |
| `npm run build:practica` | `practica/app/` para la práctica local                                                                                         |
| `npm run probar:motor`   | Compara el motor contra las 3,000 jugadas del juego (necesita datos locales)                                                   |
| `npm run db:iniciar`     | Supabase local con las migraciones (necesita Docker; puertos 55321 a 55329)                                                    |
| `npm run db:probar`      | Pruebas de reglas por fila (pgTAP) y lint de la base                                                                           |
| `npm run db:reiniciar`   | Borra la base local y vuelve a aplicar las migraciones                                                                         |
| `npm run db:parar`       | Apaga el Supabase local                                                                                                        |
| `npm run db:tipos`       | Vuelve a generar los tipos de la base en `src/cuenta/tipos-db.ts`                                                              |

### Base de datos

Cuentas, chat y acceso al NQ viven en Supabase ([decisión 0008](docs/decisiones/0008-cuentas.md)). En local, `npm run db:iniciar` levanta un Supabase con Docker y aplica las migraciones de `supabase/migrations/`; `npm run db:probar` corre las pruebas de reglas por fila.

Producción solo cambia con migraciones: en cada PR que toca `supabase/migrations/`, el workflow `Migraciones` muestra qué se aplicaría, y al fusionar en `main` las aplica. Nada se cambia a mano en la base de producción.

## Estructura

```
src/
  cuenta/            entrar, sesión, apodo y borrar la cuenta (Supabase)
  practica/          replay, gráficas, órdenes y motor de llenados
    datos.ts         lector del formato NQJ1
    motor.ts         reglas de llenado
    graficas.ts      gráficas de 2500 y 250 con Lightweight Charts
    sintetico.ts     mercado de mentira para las pruebas y la web
  data/              fuentes de cripto (Kraken, Coinbase) para la prueba técnica
  components/        logo, gráfica chica y prueba técnica
e2e/                 pruebas de punta a punta
supabase/
  migrations/        cambios a la base (tablas, reglas por fila y funciones)
  tests/             pruebas pgTAP de las reglas por fila
herramientas/        servidor local, generador del mercado de mentira y comparación del motor
docs/decisiones/     decisiones de arquitectura y de datos
```

## Datos y aviso

Stunks nunca guarda ni sirve datos de mercado: los datos de cripto los pide el navegador de cada usuario y los del NQ se quedan en local. La web publicada usa un mercado de mentira (ver [decisión 0006](docs/decisiones/0006-web-sin-datos-reales.md)). Detalle de términos en [docs/terminos-datos.md](docs/terminos-datos.md).

Qué datos guarda Stunks con las cuentas y qué se graba de la práctica: [aviso de privacidad](https://stunks.app/privacidad) y [aviso de grabación](https://stunks.app/grabacion) ([decisión 0009](docs/decisiones/0009-avisos.md)). Contacto: contacto@stunks.app.

Simulador educativo. No es asesoría de inversión ni da señales. Los resultados simulados no garantizan resultados reales.

Gráficas con [Lightweight Charts](https://www.tradingview.com/lightweight-charts/) de TradingView.

## Licencia

Copyright (C) 2026 Joaquín Casares García. Distribuido bajo la [GNU Affero General Public License v3.0](LICENSE).
