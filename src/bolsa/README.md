# Bolsa de Stunks: piezas públicas

Lo que la app necesita para leer y mostrar los mercados de la bolsa de Stunks ([decisión 0010](../../docs/decisiones/0010-bolsa-de-stunks.md)). Esta carpeta va bajo la licencia MIT ([LICENSE](LICENSE)); el resto del repo, bajo la AGPL. El generador de los mercados no está aquí.

Nada de esta carpeta depende del navegador: corre igual en Node, Deno y cualquier navegador, sin `Intl` ni datos de zonas horarias.

| Archivo          | Qué tiene                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `operaciones.ts` | El formato de operaciones (OPR1): codificar, decodificar y comprimir                        |
| `mercados.ts`    | Ficha de contrato de los 12 mercados: tick, valor por punto, micro, unidad y primera sesión |
| `calendario.ts`  | Hora de Nueva York, feriados y sesiones de futuros y de cripto                              |
| `mentira.ts`     | Operaciones de mentira con semilla, solo para pruebas                                       |

## Formato OPR1

Un archivo guarda las operaciones de un mercado en un tramo de tiempo: un día completo o un bloque. Todo va en little-endian. Las mismas operaciones dan siempre los mismos bytes; el archivo se puede entregar comprimido con gzip, pero los bytes comprimidos pueden variar entre programas, así que las comparaciones se hacen sin comprimir.

**Encabezado (48 bytes)**

| Byte | Tamaño | Qué                                                          |
| ---- | ------ | ------------------------------------------------------------ |
| 0    | 4      | `OPR1`                                                       |
| 4    | 2      | Versión del generador (u16; 0 si los datos no salen de ahí)  |
| 6    | 2      | Reservado, en 0                                              |
| 8    | 8      | Clave del mercado en ASCII, rellena con ceros                |
| 16   | 4      | Día de la sesión, aaaammdd (u32)                             |
| 20   | 4      | Número de operaciones `n` (u32)                              |
| 24   | 8      | Inicio del tramo, ms UTC, incluido (f64 con valor entero)    |
| 32   | 8      | Fin del tramo, ms UTC, excluido (f64 con valor entero)       |
| 40   | 4      | Precio de la primera operación en ticks (i32; 0 si `n` es 0) |
| 44   | 4      | Reservado, en 0                                              |

**Operaciones.** Tres columnas seguidas, cada una con `n` enteros en varint (LEB128 sin signo, de 7 en 7 bits):

1. Tiempo: milisegundos desde la operación anterior; la primera, desde el inicio del tramo.
2. Precio: ticks desde la operación anterior en zigzag (0, -1, 1, -2, 2… se guardan como 0, 1, 2, 3, 4…); la primera es 0.
3. Cantidad y lado: `q × 2 + c`, donde `c` es 1 si la operación pegó contra la venta (compra agresiva) y 0 si pegó contra la compra.

Las operaciones van en orden de tiempo, dentro del tramo. La cantidad es un entero de 1 o más en la unidad mínima del mercado (`unidad` en la ficha). Un tramo sin operaciones es válido: así un bloque vacío se distingue de uno que falta. Si el formato cambia, cambia la marca (`OPR2`).

## Sesiones

- **Futuros:** la sesión de un día abre a las 18:00 de Nueva York del día anterior y cierra a las 17:00, de domingo en la noche a viernes.
- **Feriados de futuros:** no hay sesión en Año Nuevo, Viernes Santo y Navidad (un feriado fijo en sábado se recorre al viernes y en domingo al lunes; Año Nuevo en sábado no se recorre). Cierran a las 13:00 Martin Luther King, Presidentes, Memorial, Juneteenth (desde 2022), Independencia, Trabajo y Acción de Gracias, y a las 13:15 el viernes después de Acción de Gracias y la Nochebuena de lunes a jueves.
- **Cripto:** abre todos los días, de 18:00 a 18:00 de Nueva York.
- **Horario de verano:** reglas de EE.UU. vigentes desde 2007.
