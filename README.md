# Stunks

Trading simulator with replay. Drop into any date and time, run it from 1x to 100x, trade with a stop and a target, and the score against the opposite trade tells you whether you have an edge or just got lucky.

Free and open source (AGPL-3.0). Current version: **0.1.0**. Roadmap: [docs/roadmap.md](docs/roadmap.md) (project docs are in Spanish).

Live at https://stunks.app (with a fake market until the Stunks Exchange and its 12 made-up markets arrive). The app is in English, or in Spanish when the browser is set to Spanish; the ES/EN button switches it.

## What it does today

- Replay of 2500 and 250 volume candles, from 1x to 100x or one candle at a time.
- Starts at the 18:00 ET reopen, at the New York open, at a chosen time or at random.
- Random day and blind mode (no date and no real prices).
- Buy and sell with a stop and a target in points, manual exit and live P&L.
- Realistic fills: entry 1 tick against you, stops with slippage, and targets only when price trades 1 tick through.
- Score against the opposite trade and a trade journal in the browser.

## Running it

Requires Node.js 22.

```
npm install
npm run dev
```

### Practice with local NQ data

CME futures data is licensed and is not included in this repository (see [decision 0001](docs/decisiones/0001-nq-cerrado.md)). With your own data in `practica/datos/nq/` (NQJ1 format, one file per month), `practicar.bat` starts a local server at http://127.0.0.1:8642/app/ with Python.

Shortcuts: Space play/pause · → one candle · C buy · V sell · X close.

## Commands

| Command                  | What it does                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`            | Development server at http://localhost:5173                                                                         |
| `npm run ci`             | Style, types, unit tests and build, same as on GitHub                                                               |
| `npm test`               | Unit tests (Vitest)                                                                                                 |
| `npm run e2e`            | End-to-end tests on desktop and mobile (Playwright) with a fake market; the account tests need `npm run db:iniciar` |
| `npm run format`         | Formatting and import order (Biome)                                                                                 |
| `npm run build`          | `dist/` for Cloudflare Pages, with the fake market                                                                  |
| `npm run build:practica` | `practica/app/` for local practice                                                                                  |
| `npm run probar:motor`   | Checks the fill engine against the game's 3,000 trades (needs local data)                                           |
| `npm run db:iniciar`     | Local Supabase with the migrations (needs Docker; ports 45320 to 45329)                                             |
| `npm run db:probar`      | Row-level security tests (pgTAP) and database lint                                                                  |
| `npm run db:reiniciar`   | Wipes the local database and applies the migrations again                                                           |
| `npm run db:parar`       | Stops the local Supabase                                                                                            |
| `npm run db:tipos`       | Regenerates the database types in `src/cuenta/tipos-db.ts`                                                          |

### Database

Accounts and their accepted notices live in Supabase ([decision 0008](docs/decisiones/0008-cuentas.md)); chat and NQ access for other accounts were removed ([decision 0011](docs/decisiones/0011-nq-solo-administrador.md)). Locally, `npm run db:iniciar` starts Supabase with Docker and applies the migrations in `supabase/migrations/`; `npm run db:probar` runs the row-level security tests.

Production only changes through migrations: on every PR that touches `supabase/migrations/`, the `Migraciones` workflow shows what would be applied, and merging into `main` applies it. Nothing is changed by hand in the production database.

## Layout

```
src/
  bolsa/             public pieces of the Stunks Exchange (MIT)
    operaciones.ts   OPR1 trade format
    mercados.ts      contract specs of the 12 markets
    calendario.ts    New York time, holidays and sessions
    velas.ts         time, session, tick, volume and range candles
  cuenta/            sign-in, session, nickname and account deletion (Supabase)
  practica/          replay, charts, orders and fill engine
    datos.ts         NQJ1 format reader
    motor.ts         fill rules
    graficas.ts      2500 and 250 charts with Lightweight Charts
    sintetico.ts     fake market for tests and the web
  data/              crypto sources (Kraken, Coinbase) for the technical test
  components/        logo, small chart and technical test
  i18n.ts            English and Spanish texts
e2e/                 end-to-end tests
supabase/
  migrations/        database changes (tables, row-level rules and functions)
  tests/             pgTAP tests of the row-level rules
herramientas/        local server, fake market generator and engine comparison
docs/decisiones/     architecture and data decisions
```

## Data and disclaimer

Stunks does not serve data from CME or any exchange: its markets are made up ([decision 0010](docs/decisiones/0010-bolsa-de-stunks.md)) and the NQ stays local ([decision 0011](docs/decisiones/0011-nq-solo-administrador.md)). Until the exchange arrives, the published web uses a fake market ([decision 0006](docs/decisiones/0006-web-sin-datos-reales.md)). The local technical test still requests crypto data from Kraken and Coinbase from the browser; terms in [docs/terminos-datos.md](docs/terminos-datos.md).

What Stunks stores with accounts and what is recorded from practice: [privacy notice](https://stunks.app/privacidad) and [recording notice](https://stunks.app/grabacion) ([decision 0009](docs/decisiones/0009-avisos.md)). Contact: contacto@stunks.app.

Educational simulator. It is not investment advice and gives no signals. Simulated results do not guarantee real results.

Charts by [Lightweight Charts](https://www.tradingview.com/lightweight-charts/) from TradingView.

## License

Copyright (C) 2026 Joaquín Casares García. Distributed under the [GNU Affero General Public License v3.0](LICENSE), except `src/bolsa/`, which is under the [MIT license](src/bolsa/LICENSE) ([decision 0010](docs/decisiones/0010-bolsa-de-stunks.md)).
