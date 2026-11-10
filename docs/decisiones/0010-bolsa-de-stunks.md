# 0010 · La bolsa de Stunks

**Estado:** vigente · **Fecha:** 2026-11-09 · **Reemplaza:** la [0002](0002-fuentes-cripto.md)

## Contexto

La práctica dependía de datos reales. El NQ no se puede mostrar a nadie sin la licencia de distribución de CME ([0001](0001-nq-cerrado.md)), y casi todos los exchanges prohíben usar sus datos en una app como esta ([0002](0002-fuentes-cripto.md)). Además, de velas ya armadas no salen velas de tiempo exactas ni de ticks o de rango, y con datos ajenos no hay un mercado en vivo ni un reto diario iguales para todos.

## Decisión

**Mercados propios.** Stunks trae su propia bolsa: 12 mercados inventados de índices, materias primas, divisas y cripto, con las mismas reglas de contrato que los reales (tick, valor por punto, micros y horario) para que lo aprendido sirva igual. Tiene un histórico desde el 2 de enero de 2018 igual para todos, días privados para Historia y el Reto diario, y un mercado en vivo que todos ven al mismo tiempo (F4).

**Sin datos de nadie.** El generador no usa datos del CME ni de ninguna bolsa. Se calibra con cifras públicas: niveles aproximados de fin de año, volatilidades conocidas y horarios. El camino de cada día es inventado y ningún día copia uno real.

**Operaciones, no velas.** La base es la lista de operaciones de cada día y mercado: hora, precio en ticks, cantidad en la unidad mínima del mercado y lado. De esa lista salen las velas de tiempo, de ticks, de volumen y de rango.

**Qué es público y qué es privado.**

| Pieza                                                                                                   | Dónde        | Licencia                                 |
| ------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------- |
| Formato de operaciones, constructor de velas, ficha de contrato y calendario de sesiones (`src/bolsa/`) | Este repo    | MIT                                      |
| La app y todo lo demás de este repo                                                                     | Este repo    | AGPL-3.0 ([0004](0004-licencia-agpl.md)) |
| Generador, parámetros de cada mercado, eras, noticias y la función que entrega los días                 | Repo privado | Sin licencia pública                     |

`src/bolsa/` va con MIT porque el repo privado copia esos archivos, fijados a un commit y con una prueba que avisa si se desfasan. Así, una contribución de fuera a esa carpeta se puede usar en el generador sin pedir permiso aparte.

Para que nadie adivine el en vivo ni el reto basta con que la clave sea secreta. El generador se cierra por otra razón: es lo que hace única a Stunks, y no se quiere que alguien copie la bolsa.

**Semillas.** Cada día y mercado sale de una semilla HMAC con una clave que solo vive en el servidor. La clave se genera una sola vez y nunca se rota: otra clave sería otra historia. El navegador nunca recibe el generador ni las semillas, solo operaciones ya generadas.

**Determinismo.** La misma semilla da los mismos bytes, medidos antes de comprimir, en Node y en Deno.

**Versiones.** Cada día lleva la versión del generador con la que se armó. Mientras dura la F2 se puede ajustar; al cerrarla se congela la v1 y un día ya publicado nunca cambia. Un ajuste posterior solo aplica a días que no han pasado.

**Entrega.** Una Edge Function de Supabase.

- El histórico, del 2 de enero de 2018 a ayer, se entrega por día completo en un archivo que no cambia. Se genera la primera vez que se pide y se guarda en caché en Storage; nada se genera de antemano.
- Pedirlo requiere una cuenta gratis y tiene límite de peticiones por cuenta. La demo sin cuenta usa unos días de muestra fijos.
- Los días privados y el en vivo se entregan bloque por bloque. Del histórico nunca se entrega el día en curso ni días futuros.

**Cripto.** La pone la bolsa. La web no usa datos de Binance Vision ni de ningún exchange.

## Consecuencias

- La [0002](0002-fuentes-cripto.md) queda reemplazada: no hay demo con datos de exchanges. `docs/terminos-datos.md` se queda como registro de lo que se revisó, y la prueba técnica de Kraken y Coinbase sigue solo en local hasta que se quite.
- La [0006](0006-web-sin-datos-reales.md) sigue hasta que la F3 pase la web a la bolsa.
- Quien clone este repo tiene la app, el formato y las velas, pero no el generador: puede usar el mercado de mentira o, cuando lleguen los lectores de archivos, sus propios datos.
- Las pruebas de determinismo corren en Node y en Deno en cada PR del repo privado.
- La clave tiene un respaldo fuera de los dos repos. Si se perdiera, cambiaría todo día que no esté en caché.
