# 0005 · El motor de llenados es el del juego

**Estado:** vigente · **Fecha:** 2026-11-06

## Decisión

`src/practica/motor.ts` usa exactamente las reglas del juego y de `banco/motor.py`:

- Entra en la apertura de la vela siguiente, 1 tick en contra.
- El stop se llena en el peor entre el nivel y la apertura de la vela, más max(1 tick, 2.65% del stop).
- El objetivo solo cuenta si el precio lo pasa 1 tick, y nunca en la vela de entrada. Stop y objetivo en la misma vela: cuenta el stop.
- Sin stop ni objetivo, sale a las 16:10 ET, 1 tick en contra.
- Nuevo: cerrar a mano sale en la apertura de la vela siguiente, 1 tick en contra.

## Comprobación

`npm run probar:motor` compara contra 3,000 jugadas del motor del juego con los datos reales del NQ: el 6-nov-2026 dio 3,000 de 3,000 idénticas. Las reglas también tienen pruebas unitarias con velas de mentira (`motor.test.ts`), que corren en GitHub.
