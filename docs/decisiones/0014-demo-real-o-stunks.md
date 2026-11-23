# 0014 · Demo "Real or Stunks?" con velas de una cadena pública

**Estado:** vigente · **Fecha:** 2026-11-23 · **Cambia:** de la [0010](0010-bolsa-de-stunks.md), la frase "no hay demo con datos de exchanges"; de la [0006](0006-web-sin-datos-reales.md), que la web no muestre datos reales

## Contexto

La meta de la Bolsa de Stunks es que un mercado inventado no se distinga de uno real. La mejor forma de mostrarlo es un juego: una hora de velas de 1 minuto, una real y otra de la Bolsa, y quien juega adivina cuál es cuál. Si los aciertos quedan cerca de 50%, el mercado inventado se comporta como uno real.

Para que cualquiera pueda jugar hace falta una contraparte real que se pueda mostrar. El NQ no se puede ([0001](0001-nq-cerrado.md)) y los exchanges centralizados prohíben usar sus datos en una app como esta ([0002](0002-fuentes-cripto.md)). Las operaciones que se hacen en un intercambio descentralizado quedan escritas en una cadena pública y no tienen dueño.

## Decisión

- La demo muestra solo cripto: una hora de velas de 1 minuto armadas con operaciones de ETH/USDC de un intercambio descentralizado, contra una hora de Ethereal (ETR), el mercado inventado de la Bolsa. Si el flujo de operaciones real es muy delgado para velas de 1 minuto, se usan velas de 5 minutos.
- Las velas reales se arman una vez, fuera del repositorio, a partir de las operaciones públicas de la cadena. Lo que llega al navegador son velas derivadas: sin fechas, sin niveles de precio (todo relativo a la primera apertura), sin el nombre del intercambio ni del pool, y con el volumen en escala relativa.
- Cada ventana real se empareja con una de ETR del mismo año, la misma hora de arranque y la misma clase de día (entre semana o fin de semana). Las dos salen con el mismo formato y por la misma ruta.
- La respuesta se revisa en el servidor: el navegador nunca recibe cuál es cuál antes de contestar, y el tiempo mínimo viendo lo cuenta el servidor.
- Antes de abrirla, una prueba privada con 100 respuestas del dueño del proyecto debe quedar entre 40% y 60% de aciertos, la misma regla de las pruebas a ciegas de la Bolsa. Si queda fuera, la demo espera hasta que ETR se arregle con cifras públicas.
- No hay datos del NQ, del CME ni de ningún exchange centralizado en la demo, en el repositorio ni en la web. No hay premios.
- Juego abierto, sin cuenta, con apodo. No se guarda la IP.

## Consecuencias

- La frase "no hay demo con datos de exchanges" de la 0010 queda así: no hay demo con datos de exchanges centralizados; la única demo usa operaciones públicas de una cadena, derivadas como se describe arriba. La 0006 sigue para la práctica de la app; la demo es la excepción.
- Las velas reales no se suben al repositorio. Las ventanas de ETR salen del generador, que sigue privado.
- Ajustar ETR para acercarlo a ETH solo se hace con cifras públicas, y la prueba privada usa un periodo distinto al que sirvió de diagnóstico.
- La demo no obliga a congelar la v1: sus ventanas son un grupo fijo prearmado, no días publicados.
- La interfaz de la demo y su revisión de respuestas se construyen en las etapas que siguen a la prueba privada, cada una en su propio cambio.
