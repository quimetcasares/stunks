# 0013 · La bolsa se entrega por tramos de 30 minutos, con su libro

**Estado:** vigente · **Fecha:** 2026-11-11 · **Cambia:** de la [0010](0010-bolsa-de-stunks.md), la entrega del histórico por día completo y el límite por cuenta

## Contexto

Los futuros de la bolsa ya salen de un libro de órdenes simulado: cada operación pasa por un libro de 10 niveles por lado, que se guarda en formato LIB1 (`src/bolsa/libro.ts`). Un día completo de un futuro con su libro cuesta más CPU de la que una Edge Function de Supabase da por petición (2 s), así que ya no se puede entregar el día entero de una vez.

## Decisión

- El histórico se entrega por **tramos de 30 minutos**: el tramo k de un día va de su apertura (18:00 de Nueva York) más 30·k minutos a 30 minutos después, recortado al cierre. Un día normal de futuros tiene 46 tramos; uno de cripto, 48; una sesión corta, menos. La app saca los tramos del calendario público (`src/bolsa/calendario.ts`).
- Cada tramo tiene sus operaciones (OPR2, con las noticias del tramo) y, en los futuros, su libro (LIB1). La cripto no tiene libro: su tick es diminuto frente a lo que se mueve el precio. También va por tramos, para que todo sea igual.
- La entrega por día completo se quita: la app todavía no la usaba.
- Cada tramo, como antes cada día, se genera la primera vez que se pide, se guarda en caché y nunca cambia.
- El límite por cuenta pasa a **3,000 tramos por hora** (`pedir_tramo_bolsa`). Las operaciones y el libro cuentan por separado. Siete futuros con libro repetidos a 60x son unas 1,700 por hora.

## Consecuencias

- `pedir_dia_bolsa` (120 días por hora) se queda hasta que la función deje de usarla, y luego se quita en otra migración.
- La F3 pide los tramos que va necesitando la repetición y adelanta el siguiente.
- La salida de datos de Supabase se cobra: el tamaño comprimido de cada tramo se mide antes de la F3.
