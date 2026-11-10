# 0012 · Público de EE.UU. y realismo de la Bolsa

**Estado:** vigente · **Fecha:** 2026-11-10 · **Cambia:** de la [0010](0010-bolsa-de-stunks.md), los nombres de los mercados, el Peso y cuándo se congela la v1

## Contexto

Stunks nació en español, pero la mayoría de quienes operan futuros y de las prop firms están en EE.UU. Para que la app se sienta hecha para ese público, la Bolsa tiene que sentirse como un mercado de verdad, de la forma del día hasta el libro de órdenes, y los mercados deben tener nombres que funcionen en inglés.

## Decisión

### Idioma

- La app sale en inglés. Si el navegador está en español, sale en español, y el botón ES/EN la cambia (la elección se guarda).
- Todo texto nuevo de la app va con llaves de traducción, en los dos idiomas. Los textos que todavía no las tienen se pasan en la F3.
- El README del repo va en inglés.

### Mercados

Los nombres son iguales en los dos idiomas:

| Nombre                   | Clave | Micro | Antes                 |
| ------------------------ | ----- | ----- | --------------------- |
| Madsaq 100               | MQ    | MMQ   |                       |
| Substandard & Poor's 500 | SP    | MSP   | Estándar & Pobres, EP |
| Down Jones 30            | DJ    | MDJ   |                       |
| Flea 2000                | FL    | MFL   | Pulga 2000, PU        |
| West Texas Intermediocre | WT    | MWT   | Petróleo, CR          |
| Fool's Gold              | FG    | MFG   | Oro, OR               |
| Ewro                     | EW    | MEW   | reemplaza al Peso     |
| Bitcoyote                | BTY   |       |                       |
| Ethereal                 | ETR   |       | Etéreo                |
| Solami                   | SLMI  |       | Solecito, SOLE        |
| Fidocoin                 | FIDO  |       | Firulais, FIRU        |
| Chupacabras              | CHUPA |       |                       |

- **Ewro:** del tamaño de los futuros del euro (125,000 euros por contrato, 12,500 el micro, tick de 0.00005). El micro comparte las operaciones del grande, así que se mueve del mismo tick.
- **Id interno fijo:** cada mercado tiene un id que no cambia (B01 a B12). La semilla del generador y los archivos de operaciones usan el id, no la clave: un mercado se puede renombrar sin que cambie ningún día.
- **Firmas de la F6:** Step Stool Capital, Funded Express y No Excuses Funding.

### Realismo de la Bolsa

La F2 sigue hasta que la Bolsa se sienta como un mercado real:

1. **Forma:** cada mercado con su ritmo (horas activas, apertura y mezcla de tipos de día).
2. **Noticias:** las fechas y horas de los datos de EE.UU. (empleo, inflación, tasa de interés, inventarios de petróleo) y de la zona euro (tasa del banco central e inflación) salen de los calendarios públicos; el dato, lo que se esperaba y el dato anterior son inventados. El mercado se mueve según la sorpresa. Un resultado nunca se entrega antes de su hora. Los días privados (Historia y reto) usan un calendario inventado con el mismo patrón.
3. **Estructura:** niveles con memoria (máximos y mínimos de ayer, de la noche y de la primera hora, números redondos, VWAP), rotaciones y zona de valor.
4. **Libro de órdenes** con participantes, del que salen las operaciones y el DOM.

Nada de esto puede regalar ventaja: estrategias simples, corridas con costos sobre todo el histórico, no pueden ganar más de lo que da el azar.

### La v1 se congela antes del lanzamiento

La v1 ya no se congela al terminar la calibración, sino antes de que entren jugadores, cuando la Bolsa pase sus pruebas. Mientras tanto, todo lo generado es de ensayo y se puede borrar.

## Consecuencias

- La ficha pública (`src/bolsa/mercados.ts`) cambia de claves y nombres y gana el id interno; el encabezado de OPR1 guarda el id del mercado.
- Las fechas de las noticias pueden ir en el repo público; el generador de los resultados va en el privado. El calendario del año siguiente se carga una vez al año, cuando se publica.
- La F3 suma el calendario del día en la app (hora, nombre, lo que se esperaba y el dato anterior; a la hora exacta sale el titular con el número) y el DOM.
