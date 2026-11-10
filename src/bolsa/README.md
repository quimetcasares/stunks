# Bolsa de Stunks: piezas públicas

Lo que la app necesita para leer y mostrar los mercados de la bolsa de Stunks ([decisión 0010](../../docs/decisiones/0010-bolsa-de-stunks.md)). Esta carpeta va bajo la licencia MIT ([LICENSE](LICENSE)); el resto del repo, bajo la AGPL. El generador de los mercados no está aquí.

Nada de esta carpeta depende del navegador: corre igual en Node, Deno y cualquier navegador, sin `Intl` ni datos de zonas horarias. Los imports llevan la extensión `.ts` para que Deno cargue los archivos tal cual, y solo se usa TypeScript que Node puede correr quitando los tipos (sin propiedades declaradas en el constructor ni `enum`).

| Archivo          | Qué tiene                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `operaciones.ts` | El formato de operaciones (OPR1): codificar, decodificar y comprimir                                    |
| `mercados.ts`    | Ficha de contrato de los 12 mercados: id interno, tick, valor por punto, micro, unidad y primera sesión |
| `calendario.ts`  | Hora de Nueva York, feriados y sesiones de futuros y de cripto                                          |
| `velas.ts`       | Constructor de velas de tiempo, de sesión, de ticks, de volumen y de rango                              |
| `mentira.ts`     | Operaciones de mentira con semilla, solo para pruebas                                                   |
| `noticias.ts`    | Calendario de los datos que mueven a los mercados: fechas y horas reales, nombres de parodia            |

## Formato OPR2

Un archivo guarda las operaciones de un mercado en un tramo de tiempo (un día completo o un bloque) y las noticias de ese día. Todo va en little-endian. Las mismas operaciones dan siempre los mismos bytes; el archivo se puede entregar comprimido con gzip, pero los bytes comprimidos pueden variar entre programas, así que las comparaciones se hacen sin comprimir.

**Encabezado (48 bytes)**

| Byte | Tamaño | Qué                                                                                                                                                  |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | 4      | `OPR2`                                                                                                                                               |
| 4    | 2      | Versión del generador (u16; 0 si los datos no salen de ahí)                                                                                          |
| 6    | 2      | Reservado, en 0                                                                                                                                      |
| 8    | 8      | Id del mercado en ASCII, rellena con ceros (en la bolsa, el id interno de su ficha, de B01 a B12, que no cambia aunque cambien el nombre o la clave) |
| 16   | 4      | Día de la sesión, aaaammdd (u32)                                                                                                                     |
| 20   | 4      | Número de operaciones `n` (u32)                                                                                                                      |
| 24   | 8      | Inicio del tramo, ms UTC, incluido (f64 con valor entero)                                                                                            |
| 32   | 8      | Fin del tramo, ms UTC, excluido (f64 con valor entero)                                                                                               |
| 40   | 4      | Precio de la primera operación en ticks (i32; 0 si `n` es 0)                                                                                         |
| 44   | 4      | Número de noticias `m` (u32)                                                                                                                         |

**Operaciones.** Tres columnas seguidas, cada una con `n` enteros en varint (LEB128 sin signo, de 7 en 7 bits):

1. Tiempo: milisegundos desde la operación anterior; la primera, desde el inicio del tramo.
2. Precio: ticks desde la operación anterior en zigzag (0, -1, 1, -2, 2… se guardan como 0, 1, 2, 3, 4…); la primera es 0.
3. Cantidad y lado: `q × 2 + c`, donde `c` es 1 si la operación pegó contra la venta (compra agresiva) y 0 si pegó contra la compra.

Las operaciones van en orden de tiempo, dentro del tramo. La cantidad es un entero de 1 o más en la unidad mínima del mercado (`unidad` en la ficha). Un tramo sin operaciones es válido: así un bloque vacío se distingue de uno que falta. Si el formato cambia, cambia la marca (`OPR3`).

**Noticias.** Después de las operaciones, `m` registros, en orden de tiempo, cada uno con cinco varint:

1. Tiempo de la publicación en milisegundos desde el inicio del tramo, en zigzag (puede ser antes del tramo).
2. Tipo: su lugar en `TIPOS_NOTICIA` (`noticias.ts`).
3. Lo que se esperaba, en centésimas de la unidad del dato y en zigzag (2.5% es 250).
4. El dato anterior, igual.
5. Lo que salió: 0 si todavía no se publica al final del tramo; si no, su valor en zigzag más 1.

Cada tramo lleva todas las noticias de su día con lo que se esperaba y el dato anterior, que se conocen desde antes. Lo que salió solo va si se publica antes del fin del tramo: un resultado nunca llega antes de su hora, ni en el en vivo ni en los días privados.

**OPR1** es lo mismo sin noticias (los bytes 44 a 47 en 0). El lector lo sigue aceptando.

## Velas

Todas salen de la misma lista de operaciones. El constructor las recibe de una en una (en vivo) o en bloque (histórico) y da exactamente las mismas velas de las dos formas. Si en un periodo no hubo operaciones, no hay vela.

- **Tiempo:** 1 s, 5 s, 15 s, 1 min, 5 min, 15 min y 1 h, contados desde la época UTC (cualquier divisor de una hora queda alineado con las horas de Nueva York).
- **Sesión:** una vela por día de sesión; empieza en la apertura de las 18:00.
- **Ticks:** cada `n` operaciones.
- **Volumen:** la operación no se parte. Va completa a la vela número (volumen acumulado incluyéndola - 1) / `n`, sin decimales; una operación grande puede brincarse números. Así la vela de 2500 junta las de 250 con el mismo número entre 10, igual que en el juego.
- **Rango:** se abre una vela nueva cuando la operación haría que el máximo y el mínimo de la vela se separaran más de `n` ticks.

Las velas de ticks, volumen y rango cuentan desde la primera operación que recibe el constructor; para empezar de cero en cada sesión se usa un constructor por sesión.

## Sesiones

- **Futuros:** la sesión de un día abre a las 18:00 de Nueva York del día anterior y cierra a las 17:00, de domingo en la noche a viernes.
- **Feriados de futuros:** no hay sesión en Año Nuevo, Viernes Santo y Navidad (un feriado fijo en sábado se recorre al viernes y en domingo al lunes; Año Nuevo en sábado no se recorre). Cierran a las 13:00 Martin Luther King, Presidentes, Memorial, Juneteenth (desde 2022), Independencia, Trabajo y Acción de Gracias, y a las 13:15 el viernes después de Acción de Gracias y la Nochebuena de lunes a jueves.
- **Cripto:** abre todos los días, de 18:00 a 18:00 de Nueva York.
- **Horario de verano:** reglas de EE.UU. vigentes desde 2007.

## Noticias

`noticias.ts` tiene las fechas y horas (de Nueva York) de los datos que mueven a los mercados, de 2018 a lo ya publicado del año siguiente. Lo que sale en cada dato, lo que se esperaba y el anterior son inventados: los pone el generador de la bolsa, que no es público. Los nombres son de parodia y en inglés.

| Tipo            | Nombre                               | Fuente real y hora                                                   |
| --------------- | ------------------------------------ | -------------------------------------------------------------------- |
| `empleo`        | Non-Farm Paychecks                   | BLS, Employment Situation, 8:30                                      |
| `inflacion`     | Consumer Prize Index (YoY)           | BLS, Consumer Price Index, 8:30                                      |
| `tasa`          | Fed Fun Rate                         | Fed, decisión del FOMC, 14:00 (y los recortes de emergencia de 2020) |
| `inventarios`   | Crude Oil Stash                      | EIA, Weekly Petroleum Status Report, miércoles 10:30 salvo feriados  |
| `tasaEuro`      | Bunk Deposit Rate                    | BCE, decisión de política monetaria, 13:45 o 14:15 de Fráncfort      |
| `inflacionEuro` | Ewro Area Consumer Prize Flash (YoY) | Eurostat, estimación rápida de la inflación, 11:00 de Luxemburgo     |

Lo que se publica de las 17:00 en adelante cae en la sesión siguiente: si sale con el mercado cerrado (como el recorte de la Fed del domingo 15 de marzo de 2020), esa sesión abre con hueco. Los datos que no salieron (los de octubre de 2025, con el gobierno cerrado) no están.

**Carga anual.** Una vez al año, cuando las fuentes publican el calendario del año siguiente (en general entre agosto y diciembre), se agregan sus fechas a `noticias.ts` y se sube `CALENDARIO_HASTA`:

- BLS: https://www.bls.gov/schedule/news_release/empsit.htm y .../cpi.htm (el archivo de lo ya publicado: https://www.bls.gov/bls/news-release/empsit.htm y .../cpi.htm).
- Fed: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
- EIA: https://www.eia.gov/petroleum/supply/weekly/schedule.php (miércoles 10:30, salvo las semanas de su tabla).
- BCE: https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html (pasar la hora de Fráncfort a la de Nueva York).
- Eurostat: calendario de los euro indicators, "Flash estimate inflation euro area" (11:00 de Luxemburgo).

Las fechas ya pasadas también se corrigen si una fuente movió o canceló un dato.
