-- Demo "Real or Stunks?": pool, rondas, tiempo mínimo, una respuesta por ronda, reto del día, juego libre y límite por IP.
-- Corre con `npm run db:probar` (Supabase local); todo se deshace al terminar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

-- ─── Sin grupo activo ────────────────────────────────────────────────────────────────────────────────────────────────
select is(public.demo_servir('j1', 'reto', 0) ->> 'estado', 'sin-grupo', 'sin grupo activo no hay gráfica');

-- ─── Un grupo de prueba con la forma del real: 30 días de 10 (5 y 5) y 100 de reserva, 200 parejas ─────────────────────
insert into privado.demo_grupos (grupo, inicia, activo)
  values ('prueba', (now() at time zone 'America/New_York')::date, true);
-- Parejas: i de 0 a 199; real del par i y stunks del par i. Día d lleva reales de los pares 5d..5d+4 y stunks de 5(d+1)..5(d+1)+4.
insert into privado.demo_ventanas (id, grupo, fuente, par, reto_dia, reto_pos, origen, velas)
select gen_random_uuid(), 'prueba', f.fuente, i + 1,
       case when f.fuente = 'real' and i < 150 then i / 5 when f.fuente = 'stunks' and i >= 5 and i < 155 then (i - 5) / 5 end,
       case when f.fuente = 'real' and i < 150 then i % 5 when f.fuente = 'stunks' and i >= 5 and i < 155 then 5 + (i - 5) % 5 end,
       'origen ' || f.fuente || i,
       jsonb_build_object('marca', f.fuente || i)
from generate_series(0, 199) i, (values ('real'), ('stunks')) as f (fuente);

select is((select count(*) from privado.demo_ventanas where reto_dia is not null), 300::bigint, 'el horario tiene 300 ventanas');
select is((select count(*) from privado.demo_ventanas where reto_dia is null), 100::bigint, 'y 100 de reserva');

-- ─── Nadie de fuera toca las tablas ni las funciones ───────────────────────────────────────────────────────────────────
set local role anon;
select throws_ok('select * from privado.demo_ventanas', '42501', null, 'anon no lee el pool');
select throws_ok($$select public.demo_servir('j1', 'reto', 0)$$, '42501', null, 'anon no sirve rondas');
select throws_ok($$select public.demo_responder(gen_random_uuid(), 'j1', 'real', 0)$$, '42501', null, 'anon no responde');
reset role;
set local role authenticated;
select throws_ok('select * from privado.demo_rondas', '42501', null, 'una cuenta no lee las rondas');
select throws_ok($$select public.demo_limite('x', 10)$$, '42501', null, 'una cuenta no usa el límite');
reset role;
set local role service_role;
select lives_ok($$select public.demo_limite('hash', 5)$$, 'la llave de servicio sí ejecuta las funciones');
reset role;

-- ─── Reto del día ────────────────────────────────────────────────────────────────────────────────────────────────────
select is(public.demo_servir('j1', 'reto', 100000) ->> 'estado', 'ok', 'el reto sirve la primera gráfica');
select is((public.demo_servir('j1', 'reto', 100000) ->> 'n')::int, 1, 'recargar entrega la misma ronda (n = 1)');
select is(
  (select count(*) from privado.demo_rondas where jugador = 'j1'), 1::bigint, 'y no se crea otra fila al recargar'
);
select ok(
  not (public.demo_servir('j1', 'reto', 100000) ?| array['fuente', 'ventana_id', 'grupo', 'origen', 'par', 'reto_dia']),
  'la respuesta de /ronda no trae la verdad, el id de la ventana, el grupo, la pareja ni el día'
);

-- Tiempo mínimo: antes del mínimo no se acepta y la ronda sigue abierta.
select is(
  public.demo_responder((select ronda from privado.demo_rondas where jugador = 'j1'), 'j1', 'real', 100000) ->> 'estado',
  'pronto',
  'antes del tiempo mínimo no se acepta'
);
select is((select respondida_en is null from privado.demo_rondas where jugador = 'j1'), true, 'y la ronda sigue abierta');
select is(
  public.demo_responder((select ronda from privado.demo_rondas where jugador = 'j1'), 'otro', 'real', 0) ->> 'estado',
  'no-existe',
  'una ronda de otro jugador responde como si no existiera'
);
select is(
  public.demo_responder((select ronda from privado.demo_rondas where jugador = 'j1'), 'j1', 'real', 0) ->> 'estado',
  'ok',
  'con el mínimo cumplido se acepta'
);
select is(
  public.demo_responder((select ronda from privado.demo_rondas where jugador = 'j1'), 'j1', 'stunks', 0) ->> 'estado',
  'ya',
  'una sola respuesta por ronda'
);
select is(
  (select acerto from privado.demo_rondas where jugador = 'j1')
    = ((select dijo from privado.demo_rondas where jugador = 'j1') = (select w.fuente from privado.demo_rondas r join privado.demo_ventanas w on w.id = r.ventana_id where r.jugador = 'j1')),
  true,
  'acerto sale de comparar lo que dijo con la verdad de la ventana'
);

-- "¿Qué la delató?": una vez y solo después de contestar.
select is(public.demo_pista((select ronda from privado.demo_rondas where jugador = 'j1'), 'j1', 'mechas'), true, 'la pista se guarda tras contestar');
select is(public.demo_pista((select ronda from privado.demo_rondas where jugador = 'j1'), 'j1', 'volumen'), false, 'pero una sola vez');

-- Las 10 del reto salen en el orden del horario y al terminar ya no hay más.
do $$
declare
  r jsonb;
begin
  for i in 2..10 loop
    r := public.demo_servir('j1', 'reto', 0);
    perform public.demo_responder((r ->> 'ronda')::uuid, 'j1', 'real', 0);
  end loop;
end;
$$;
select is(
  (select array_agg(w.velas ->> 'marca' order by r.n) from privado.demo_rondas r join privado.demo_ventanas w on w.id = r.ventana_id where r.jugador = 'j1')
    = (select array_agg(velas ->> 'marca' order by reto_pos) from privado.demo_ventanas where reto_dia = 0),
  true,
  'las 10 gráficas del reto son las del día 0, en el orden del horario'
);
select is(public.demo_servir('j1', 'reto', 0) ->> 'estado', 'terminado', 'después de las 10 el reto está terminado');
select is(
  (select array_agg(w.velas ->> 'marca' order by r.n) from privado.demo_rondas r join privado.demo_ventanas w on w.id = r.ventana_id where r.jugador = 'j2'),
  null,
  'otro jugador todavía no tiene nada'
);
select is(
  (public.demo_servir('j2', 'reto', 0) -> 'velas' ->> 'marca') = (select velas ->> 'marca' from privado.demo_ventanas where reto_dia = 0 and reto_pos = 0),
  true,
  'otro jugador recibe la misma primera gráfica del reto'
);

-- ─── Juego libre ─────────────────────────────────────────────────────────────────────────────────────────────────────
do $$
declare
  r jsonb;
begin
  for i in 1..10 loop
    r := public.demo_servir('j3', 'libre', 0);
    perform public.demo_responder((r ->> 'ronda')::uuid, 'j3', 'real', 0);
  end loop;
end;
$$;
select is(
  (select count(*) from privado.demo_rondas r join privado.demo_ventanas w on w.id = r.ventana_id where r.jugador = 'j3' and w.fuente = 'real'),
  5::bigint,
  'una tanda libre lleva 5 reales'
);
select is(
  (select count(distinct w.par) from privado.demo_rondas r join privado.demo_ventanas w on w.id = r.ventana_id where r.jugador = 'j3'),
  10::bigint,
  'y no lleva dos ventanas de la misma pareja'
);
select is(
  (select count(*) from privado.demo_rondas r join privado.demo_ventanas w on w.id = r.ventana_id where r.jugador = 'j3' and w.reto_dia is not null),
  0::bigint,
  'el juego libre no toca las ventanas del reto de hoy ni de días futuros'
);

-- Con el reto de hoy un día atrás, las ventanas del día 0 entran al juego libre.
update privado.demo_grupos set inicia = inicia - 1 where grupo = 'prueba';
select is(
  (select count(*) from privado.demo_ventanas where reto_dia is null or reto_dia < 1),
  110::bigint,
  'al pasar el día, las 10 del reto anterior se suman a las 100 de reserva'
);
update privado.demo_grupos set inicia = inicia + 1 where grupo = 'prueba';

-- El juego libre no espera: ni espera_ms ni 'pronto' aunque se pida un mínimo enorme (el mínimo es solo del reto).
select is((public.demo_servir('j5', 'libre', 100000) ->> 'espera_ms')::int, 0, 'el juego libre no trae espera');
select is(
  public.demo_responder((select ronda from privado.demo_rondas where jugador = 'j5'), 'j5', 'real', 100000) ->> 'estado', 'ok',
  'y se contesta al instante'
);
select is(
  (select extract(epoch from respondida_en - servida_en) >= 0 from privado.demo_rondas where jugador = 'j5'), true,
  'pero se guarda cuánto tardó'
);

-- ─── Reserva agotada ─────────────────────────────────────────────────────────────────────────────────────────────────
delete from privado.demo_ventanas where reto_dia is null;
select is(public.demo_servir('j4', 'libre', 0) ->> 'estado', 'agotado', 'sin ventanas libres se dice agotado, sin error');

-- ─── Límite por IP ───────────────────────────────────────────────────────────────────────────────────────────────────
select is(public.demo_limite('ip1', 2), true, 'primera llamada dentro del límite');
select is(public.demo_limite('ip1', 2), true, 'segunda dentro');
select is(public.demo_limite('ip1', 2), false, 'la tercera se pasa');
select is(public.demo_limite('ip2', 2), true, 'otra IP cuenta aparte');

-- ─── Tope de corridas de Ranked por huella de IP (parámetro) ──────────────────────────────────────────────────────────
update privado.demo_config set valor = 2 where clave = 'tope_corridas_ip';
select is(public.demo_servir('t1', 'reto', 0, 'ipA') ->> 'estado', 'ok', 'primera corrida de la huella A');
select is(public.demo_servir('t2', 'reto', 0, 'ipA') ->> 'estado', 'ok', 'segunda corrida de la huella A');
select is(public.demo_servir('t3', 'reto', 0, 'ipA') ->> 'estado', 'tope', 'la tercera corrida de la huella A ya no entra');
select is(public.demo_servir('t4', 'reto', 0, 'ipB') ->> 'estado', 'ok', 'otra huella cuenta aparte');
select is(public.demo_servir('t1', 'reto', 0, 'ipA') ->> 'estado', 'ok', 'recargar la corrida en curso no cuenta otra vez');
select is((select corridas from privado.demo_corridas_ip where ip_hash = 'ipA'), 2, 'la huella A lleva 2 corridas');
select is((select huella_n from privado.demo_rondas where jugador = 't1'), 1, 't1 fue la corrida 1 de su huella');
select is((select huella_n from privado.demo_rondas where jugador = 't2'), 2, 't2 fue la corrida 2');
select public.demo_responder((select ronda from privado.demo_rondas where jugador = 't1'), 't1', 'real', 0);
select public.demo_servir('t1', 'reto', 0, 'ipA');
select is((select array_agg(huella_n order by n) from privado.demo_rondas where jugador = 't1'), array[1, 1], 'las rondas de una corrida heredan su número de huella');
select isnt(public.demo_servir('t5', 'libre', 0, 'ipA') ->> 'estado', 'tope', 'Free play no cuenta para el tope');
update privado.demo_config set valor = 0 where clave = 'tope_corridas_ip';
select is(public.demo_servir('t3', 'reto', 0, 'ipA') ->> 'estado', 'ok', 'con tope 0 no hay tope');

-- ─── El hash de IP no dura más de un día (se borra en cada llamada) ───────────────────────────────────────────────────
insert into privado.demo_limite (ip_hash, hora, cuenta)
  values ('viejo', date_trunc('hour', now()) - interval '30 hours', 5), ('reciente', date_trunc('hour', now()) - interval '10 hours', 5);
select public.demo_limite('otra', 5);
select is((select count(*) from privado.demo_limite where ip_hash = 'viejo'), 0::bigint, 'el hash de más de 24 horas se borra en la siguiente llamada');
select is((select count(*) from privado.demo_limite where ip_hash = 'reciente'), 1::bigint, 'y el de 10 horas se queda');
insert into privado.demo_corridas_ip (ip_hash, desde, corridas) values ('vieja', now() - interval '30 hours', 3);
select public.demo_servir('t9', 'reto', 0, 'ipC');
select is((select count(*) from privado.demo_corridas_ip where ip_hash = 'vieja'), 0::bigint, 'el conteo de corridas de más de 24 horas también se borra');

set local role anon;
select throws_ok('select * from privado.demo_corridas_ip', '42501', null, 'anon no lee las huellas');
reset role;

select * from finish();
rollback;
