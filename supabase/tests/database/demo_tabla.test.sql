-- Demo "Real or Stunks?", etapa 6: apodos, marcador, tu lugar y tablas. Solo Ranked (el reto) cuenta; Free (libre) no.
-- Corre con `npm run db:probar` (Supabase local); todo se deshace al terminar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into privado.demo_grupos (grupo, inicia, activo) values ('prueba', (now() at time zone 'America/New_York')::date - 2, true);
insert into privado.demo_ventanas (id, grupo, fuente, par, origen, velas)
  select gen_random_uuid(), 'prueba', 'real', i, 'o', '{}'::jsonb from generate_series(1, 100) i;

-- Respuestas ya contestadas. En el reto, 10 por día hacia atrás desde hoy; en libre, sin fecha.
create function pg_temp.rondas(p_jugador text, p_modo text, p_aciertos integer, p_total integer, p_desde integer) returns void language sql as $$
  insert into privado.demo_rondas (jugador, ventana_id, modo, reto_fecha, n, servida_en, respondida_en, dijo, acerto)
  select p_jugador, (select id from (select id, row_number() over (order by par) rn from privado.demo_ventanas) v where rn = p_desde + i),
         p_modo,
         case when p_modo = 'reto' then (now() at time zone 'America/New_York')::date - ((i - 1) / 10) end,
         1 + ((i - 1) % 10), now() - interval '1 minute', now(), 'real', i <= p_aciertos
  from generate_series(1, p_total) i
$$;
select pg_temp.rondas('j1', 'reto', 24, 30, 0);
select pg_temp.rondas('j2', 'reto', 15, 30, 30);
select pg_temp.rondas('j3', 'reto', 3, 3, 60);
select pg_temp.rondas('j4', 'libre', 20, 20, 63);
-- Cuánto tardó cada una: j1 7 s, j2 9 s, j3 1 s, j4 (libre) 1 s.
update privado.demo_rondas set servida_en = respondida_en - interval '7 seconds' where jugador = 'j1';
update privado.demo_rondas set servida_en = respondida_en - interval '9 seconds' where jugador = 'j2';
update privado.demo_rondas set servida_en = respondida_en - interval '1 second' where jugador in ('j3', 'j4');

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
select is(public.demo_apodo('j4', 'Dan'), 'ok', 'quien solo jugó Free también puede poner apodo');

-- Marcador: solo Ranked
select is((public.demo_agregado('j1') -> 'comun' ->> 'total')::int, 63, 'el marcador cuenta solo las respuestas de Ranked (las 20 de Free no)');
select is((public.demo_agregado('j1') -> 'comun' ->> 'aciertos')::int, 42, 'y sus aciertos');

-- Tabla histórica (desde 30 respuestas de Ranked)
select is(public.demo_agregado('j1') -> 'comun' -> 'tabla' -> 0 ->> 'apodo', 'Ana', 'la tabla histórica pone primero a quien más acierta');
select is(jsonb_array_length(public.demo_agregado('j1') -> 'comun' -> 'tabla'), 2, 'sin quien tiene menos de 30 de Ranked ni quien solo jugó Free');
select is((public.demo_agregado('j2') -> 'tu' ->> 'lugar')::int, 2, 'tu lugar es el 2 para j2');
select is(public.demo_agregado('j3') -> 'tu' -> 'lugar', 'null'::jsonb, 'sin 30 de Ranked no hay lugar');
select is((public.demo_agregado('j4') -> 'tu' ->> 'total')::int, 0, 'lo de Free no cuenta en lo tuyo');

-- Tabla de hoy (desde el primer día): quienes ya hicieron los 10 de hoy y tienen apodo; a igualdad, el menor tiempo total
select is(jsonb_array_length(public.demo_agregado('j1') -> 'comun' -> 'tabla_hoy'), 2, 'la tabla de hoy tiene a quien terminó los 10 (j3 con 3 no)');
select is(public.demo_agregado('j1') -> 'comun' -> 'tabla_hoy' -> 0 ->> 'apodo', 'Ana', 'con los mismos aciertos va primero quien tardó menos en total');
select is((public.demo_agregado('j1') -> 'comun' -> 'tabla_hoy' -> 0 ->> 'segundos')::int, 70, 'con su tiempo total');
select is(public.demo_agregado('j1') -> 'comun' -> 'tabla_hoy' -> 1 ->> 'apodo', 'Beto', 'y después el otro');

-- Lo tuyo del reto de hoy
select is((public.demo_agregado('j1') -> 'tu' -> 'reto' ->> 'aciertos')::int, 10, 'tu puntaje del reto de hoy');
select is((public.demo_agregado('j1') -> 'tu' -> 'reto' ->> 'numero')::int, 3, 'el número del reto cuenta desde el primer día del primer grupo');
select is((public.demo_agregado('j1') -> 'tu' -> 'reto' ->> 'mejor_que')::int, 0, 'con otro igual de bien no le ganas a nadie');

select ok(
  not (public.demo_agregado('j1') ?| array['fuente', 'ventana_id', 'origen', 'par'])
    and not ((public.demo_agregado('j1') -> 'comun') ?| array['fuente', 'por_ventana']),
  'el agregado no trae cifras por ventana ni la verdad'
);

-- Por modo y tramo de tiempo (para publicar los números sin cambiar lo que cuenta la página)
select is((select respuestas from privado.demo_por_tramo(3) where modo = 'reto' and tramo = 'menos de 3 s'), 3::bigint, 'Ranked: 3 respuestas de menos de 3 s');
select is((select respuestas from privado.demo_por_tramo(3) where modo = 'reto' and tramo = '3 s o más'), 60::bigint, 'Ranked: 60 de 3 s o más');
select is((select respuestas from privado.demo_por_tramo(3) where modo = 'reto' and tramo = 'todas'), 63::bigint, 'Ranked: 63 en total');
select is((select respuestas from privado.demo_por_tramo(3) where modo = 'libre' and tramo = 'todas'), 20::bigint, 'Free se guarda aparte: 20');
set local role authenticated;
select throws_ok($$select * from privado.demo_por_tramo(3)$$, '42501', null, 'la API no la ejecuta');
reset role;

select * from finish();
rollback;
