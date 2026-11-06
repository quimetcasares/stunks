# 0007 · El acceso al NQ no tiene tope de cuentas

**Estado:** vigente · **Fecha:** 2026-11-06 · **Reemplaza:** el tope de 10 a 15 cuentas de [0001](0001-nq-cerrado.md)

## Contexto

La [0001](0001-nq-cerrado.md) limitaba el acceso al NQ a 10 o 15 cuentas. Sin licencia de CME, mostrar los datos a cualquier otra persona ya cuenta como distribuir, sea una cuenta o cien; el tope no cambia eso. Lo que protege los datos es que cada acceso se aprueba a mano, la marca por usuario y los enlaces que caducan.

## Decisión

- No hay número máximo de cuentas con acceso al NQ. El administrador aprueba a quien quiera, una por una.
- El panel de administración muestra siempre cuántas cuentas tienen acceso en ese momento, para que el número sea visible al aprobar.
- Todo lo demás de la 0001 sigue igual: el NQ nunca es público, se aprueba a mano, no hay botón de descarga, los enlaces caducan en minutos, hay marca invisible por usuario y alertas de uso raro.

## Consecuencias

- La app no bloquea aprobaciones por cantidad; el control es la decisión del administrador.
- Entre más cuentas tengan acceso, más se parece a un servicio de datos para CME y más fácil es que alguien saque los datos. Si el número crece mucho, toca revisar de nuevo la licencia de distribución.
