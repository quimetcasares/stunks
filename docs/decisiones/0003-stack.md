# 0003 · Con qué se arma Stunks

**Estado:** vigente · **Fecha:** 2026-11-06

| Parte                                   | Qué                               | Por qué                                                                                                       |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| App                                     | TypeScript, React y Vite          | Lo más común; fácil encontrar ayuda                                                                           |
| Gráficas                                | Lightweight Charts (Apache 2.0)   | Gratis con atribución; el juego ya la usaba                                                                   |
| Estilo                                  | Biome                             | Formato y revisión en una sola herramienta, rápida                                                            |
| Pruebas                                 | Vitest y Playwright               | Unitarias para el motor y los datos; de punta a punta en compu y cel                                          |
| Hosting                                 | Cloudflare Pages                  | Gratis, con vista previa por cada PR                                                                          |
| Cuentas, base de datos, chat y archivos | Supabase (plan Pro)               | Auth con Google y correo, Postgres con reglas por fila, tiempo real y almacenamiento privado en un solo lugar |
| Errores y uso                           | Sentry y Cloudflare Web Analytics | Avisos de errores; visitas sin cookies                                                                        |

Las pruebas que necesitan base de datos corren contra un Supabase local dentro de GitHub Actions, así que solo hay un proyecto en la nube (producción).
