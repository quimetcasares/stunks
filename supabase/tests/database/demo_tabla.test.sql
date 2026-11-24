-- Demo "Real or Stunks?", etapa 6: apodos, marcador, tu lugar y tabla de líderes.
-- Corre con `npm run db:probar` (Supabase local); todo se deshace al terminar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into privado.demo_grupos (grupo, inicia, activo) values ('prueba', (now() at time zone 'America/New_York')::date - 2, true);
insert into privado.demo_ventanas (id, grupo, fuente, par, origen, velas)
  select gen_random_uuid(), 'prueba', 'real', i, 'o', '{}'::jsonb from generate_series(1, 80) i;

-- Rondas contestadas: j1 acierta 24 de 30, j2 acierta 15 de 30, j3 solo 3 rondas. Todas en libre.
create function pg_temp.rondas(p_jugador text, p_aciertos integer, p_total integer, p_desde integer) returns void language sql as $$
  insert into privado.demo_rondas (jugador, ventana_id, modo, n, servida_en, respondida_en, dijo, acerto)
  select p_jugador, (select id from (select id, row_number() over (order by par) rn from privado.demo_ventanas) v where rn = p_desde + i),
         'libre', 1 + (i % 10), now() - interval '1 minute', now(), 'real', i <= p_aciertos
  from generate_series(1, p_total) i
$$;
select pg_temp.rondas('j1', 24, 30, 0);
select pg_temp.rondas('j2', 15, 30, 30);
select pg_temp.rondas('j3', 3, 3, 60);

set local role anon;
select throws_ok($$select public.demo_agregado('j1')$$, '42501', null, 'anon no pide el agregado');
select throws_ok($$select public.demo_apodo('j1', 'Ana')$$, '42501', null, 'anon no pone apodos');
reset role;

-- Apodos
select is(public.demo_apodo('j1', 'Ana'), 'ok', 'un apodo válido se guarda');
select is(public.demo_apodo('j2', 'ana'), 'ocupado', 'no se repite aunque cambien las mayúsculas');
select is(public.demo_apodo('j2', 'a'), 'invalido', 'muy corto no vale');
select is(public.demo_apodo('j2', 'tiene  dos espacios'), 'invalido', 'dos espacios seguidos no valen');
select is(public.demo_apodo('j2', 'Stunks'), 'prohibido', 'los nombres reservados no valen');
select is(public.demo_apodo('nuevo', 'Beto'), 'sin-rondas', 'sin rondas contestadas no se reserva un nombre');
select is(public.demo_apodo('j2', 'Beto'), 'ok', 'otro apodo válido');
select is(public.demo_apodo('j3', 'Cris'), 'ok', 'j3 también');

-- Marcador y tabla
select is((public.demo_agregado('j1') -> 'comun' ->> 'total')::int, 63, 'el marcador cuenta todas las respuestas');
select is((public.demo_agregado('j1') -> 'comun' ->> 'aciertos')::int, 42, 'y los aciertos');
select is(
  public.demo_agregado('j1') -> 'comun' -> 'tabla' -> 0 ->> 'apodo', 'Ana',
  'la tabla pone primero a quien más acierta y deja fuera a quien tiene menos de 30 respuestas'
);
select is(jsonb_array_length(public.demo_agregado('j1') -> 'comun' -> 'tabla'), 2, 'j3 (3 respuestas) no sale en la tabla');
select is((public.demo_agregado('j2') -> 'tu' ->> 'lugar')::int, 2, 'tu lugar es el 2 para j2');
select is(public.demo_agregado('j3') -> 'tu' -> 'lugar', 'null'::jsonb, 'sin 30 respuestas no hay lugar');
select ok(
  not (public.demo_agregado('j1') ?| array['fuente', 'ventana_id', 'origen', 'par']) and not ((public.demo_agregado('j1') -> 'comun') ?| array['fuente', 'por_ventana']),
  'el agregado no trae cifras por ventana ni la verdad'
);

-- Resultados por tramo de tiempo (para publicar los dos números sin cambiar lo que cuenta la página).
update privado.demo_rondas set servida_en = respondida_en - interval '1 second' where jugador = 'j3';
select is((select respuestas from privado.demo_por_tramo(3) where tramo = 'menos de 3 s'), 3::bigint, 'las 3 respuestas de 1 s caen en menos de 3 s');
select is((select respuestas from privado.demo_por_tramo(3) where tramo = '3 s o más'), 60::bigint, 'y las otras 60 en 3 s o más');
select is((select respuestas from privado.demo_por_tramo(3) where tramo = 'todas'), 63::bigint, 'todas suman 63');
select throws_ok($$set local role authenticated; select * from privado.demo_por_tramo(3)$$, '42501', null, 'la API no la ejecuta');
reset role;

-- Mínimo para que cuente en el marcador (parámetro de Joaquín; por omisión 0 = cuentan todas).
select is((select valor from privado.demo_config where clave = 'min_cuenta_ms'), 0, 'por omisión cuentan todas las respuestas');
update privado.demo_config set valor = 5000 where clave = 'min_cuenta_ms';
update privado.demo_rondas set servida_en = respondida_en - interval '1 second' where jugador = 'j3';
delete from privado.demo_cache;
select is((public.demo_agregado('j1') -> 'comun' ->> 'total')::int, 60, 'con mínimo de 5 s no cuentan las 3 respuestas de 1 s');
select is((public.demo_agregado('j1') -> 'comun' ->> 'min_segundos')::numeric, 5.0, 'la página puede decir cuántos segundos piden');
select is((public.demo_agregado('j3') -> 'tu' ->> 'total')::int, 0, 'ni cuentan en lo tuyo');

select * from finish();
rollback;
