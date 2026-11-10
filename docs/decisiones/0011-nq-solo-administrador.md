# 0011 · El NQ queda solo para el administrador

**Estado:** vigente · **Fecha:** 2026-11-09 · **Reemplaza:** la [0007](0007-nq-sin-tope.md) y, de la [0001](0001-nq-cerrado.md) y la [0008](0008-cuentas.md), el acceso al NQ para otras cuentas y el chat

## Contexto

La [0001](0001-nq-cerrado.md) y la [0007](0007-nq-sin-tope.md) abrían el NQ a cuentas aprobadas a mano: se pedía por chat, con marca por usuario y enlaces que caducan. Con la bolsa de Stunks ([0010](0010-bolsa-de-stunks.md)) todos practican con mercados propios, y mostrar el NQ a cualquier otra persona sigue siendo distribuir datos de CME, sea una cuenta o cien.

## Decisión

- Solo la cuenta del administrador tiene acceso al NQ. No hay solicitud de acceso, marca por usuario ni enlaces que caducan.
- El chat con el administrador y su traducción salen de la F1.
- El bucket privado `nq` se queda solo para el administrador, y usarlo se pospone hasta después de la F8.
- La práctica local con el NQ (`practicar.bat`) sigue igual.
- Abrir el NQ a otras personas requiere la licencia de distribución de CME, como dice la [0001](0001-nq-cerrado.md).

## Consecuencias

- Un PR aparte quita de la base, con su migración y sus pruebas pgTAP, las tablas `accesos_nq` y `mensajes`, las funciones `pedir_acceso_nq` y `decidir_acceso_nq`, y la regla que deja leer el bucket `nq` a cuentas aprobadas.
- En ese mismo PR cambian los textos de la app y el aviso de privacidad que hablan del chat y del acceso al NQ, con una versión nueva del aviso ([0009](0009-avisos.md)).
