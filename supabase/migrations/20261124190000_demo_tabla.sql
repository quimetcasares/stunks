-- Demo "Real or Stunks?", etapa 6: apodos, marcador de todos, tu lugar y tablas de líderes. Sigue sobre las tablas de
-- 20261124180000_demo_real_o_stunks.sql. Todo en el esquema privado y solo con service_role, como lo anterior.
--
-- Dos modos (decisión de Joaquín, 24-nov-2026): Ranked = el reto del día (modo 'reto': 10 gráficas iguales para todos, una vez
-- por jugador y día, con tiempo mínimo) y Free = el juego libre (modo 'libre': sin espera). Solo Ranked cuenta en el marcador de
-- todos, en "tu lugar" y en las tablas; Free se guarda (con cuánto tardó cada respuesta) pero no entra a ninguna cuenta.

-- Un apodo por jugador (el hash de su uuid), de 3 a 16 caracteres, sin repetir (sin importar mayúsculas). Sin correo, sin cuenta.
create table privado.demo_apodos (
  jugador text primary key,
  apodo text not null check (apodo ~ '^[A-Za-z0-9_.-][A-Za-z0-9_. -]{1,14}[A-Za-z0-9_.-]$'),
  creado timestamptz not null default now()
);
create unique index demo_apodos_unico on privado.demo_apodos (lower(apodo));

-- Patrones (expresiones regulares, sin importar mayúsculas) que no pueden ir en un apodo. Empieza con unos pocos: la llena Joaquín.
create table privado.demo_apodos_prohibidos (patron text primary key);
insert into privado.demo_apodos_prohibidos (patron) values ('^stunks$'), ('admin'), ('moderator');

-- Resultados ya calculados, para que consultar el marcador cada 15 s desde muchos navegadores no cueste una cuenta cada vez.
create table privado.demo_cache (
  clave text primary key,
  calculado timestamptz not null,
  datos jsonb not null
);

alter table privado.demo_apodos enable row level security;
alter table privado.demo_apodos_prohibidos enable row level security;
alter table privado.demo_cache enable row level security;
revoke all on privado.demo_apodos, privado.demo_apodos_prohibidos, privado.demo_cache from public, anon, authenticated;

-- Pone el apodo del jugador (hace falta haber contestado al menos una ronda, para que nadie reserve nombres en vano).
-- Devuelve 'ok', 'invalido', 'prohibido', 'ocupado' o 'sin-rondas'.
create function public.demo_apodo(p_jugador text, p_apodo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_apodo is null or p_apodo !~ '^[A-Za-z0-9_.-][A-Za-z0-9_. -]{1,14}[A-Za-z0-9_.-]$' or p_apodo ~ '  ' then
    return 'invalido';
  end if;
  if exists (select 1 from privado.demo_apodos_prohibidos where p_apodo ~* patron) then
    return 'prohibido';
  end if;
  if not exists (select 1 from privado.demo_rondas where jugador = p_jugador and respondida_en is not null) then
    return 'sin-rondas';
  end if;
  begin
    insert into privado.demo_apodos as a (jugador, apodo) values (p_jugador, p_apodo)
    on conflict (jugador) do update set apodo = excluded.apodo;
  exception when unique_violation then
    return 'ocupado';
  end;
  return 'ok';
end;
$$;

-- Respuestas de Ranked de corridas COMPLETAS (las 10 del día contestadas). Solo estas cuentan en el marcador, en "tu lugar" y en las
-- tablas: antes de la décima, que `tu.aciertos` o el marcador cambiaran dejaba saber si la última respuesta fue acierto (A1). Con
-- `p_jugador` solo mira a ese jugador (usa el índice por jugador) y es lo que usa `demo_agregado`.
create function privado.demo_ranked_completo(p_jugador text default null)
returns setof privado.demo_rondas
language sql
stable
set search_path = ''
as $$
  select x.* from privado.demo_rondas x
  where x.modo = 'reto' and x.respondida_en is not null and (p_jugador is null or x.jugador = p_jugador)
    and (x.jugador, x.reto_fecha) in (
      select y.jugador, y.reto_fecha from privado.demo_rondas y
      where y.modo = 'reto' and y.respondida_en is not null and (p_jugador is null or y.jugador = p_jugador)
      group by y.jugador, y.reto_fecha having count(*) = 10
    )
$$;

-- Lo común a todos, solo de Ranked y de corridas completas, con caché de 30 segundos (todas las cuentas pesadas se hacen aquí, una
-- vez por ventana de tiempo, y no en cada consulta de cada jugador; revisión de seguridad M1):
--   marcador de todos (total, aciertos, jugadores, y lo de hoy),
--   tabla_hoy: quienes ya terminaron los 10 de hoy y pusieron apodo, por aciertos y, a igualdad, el menor tiempo total,
--   tabla: histórica, desde 30 respuestas de Ranked,
--   hist_hoy: cuántas corridas de hoy sacaron 0, 1... 10 aciertos (de ahí sale "mejor que X %" sin recontar),
--   ranking: [aciertos, total] de los que tienen apodo y 30 respuestas (de ahí sale "tu lugar" sin recontar).
-- `hist_hoy` y `ranking` no salen de la función: son solo para calcular lo tuyo.
create function privado.demo_comun()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c privado.demo_cache;
  hoy date := (now() at time zone 'America/New_York')::date;
  datos jsonb;
begin
  select * into c from privado.demo_cache where clave = 'comun';
  if found and now() - c.calculado < interval '30 seconds' then
    return c.datos;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('demo:comun', 0));
  select * into c from privado.demo_cache where clave = 'comun';
  if found and now() - c.calculado < interval '30 seconds' then
    return c.datos;
  end if;

  select jsonb_build_object(
    'total', count(*),
    'aciertos', count(*) filter (where acerto),
    'jugadores', count(distinct jugador),
    'hoy_total', count(*) filter (where reto_fecha = hoy),
    'hoy_aciertos', count(*) filter (where acerto and reto_fecha = hoy)
  ) into datos
  from privado.demo_ranked_completo();

  datos := datos || jsonb_build_object('tabla', coalesce((
    select jsonb_agg(jsonb_build_object('apodo', t.apodo, 'aciertos', t.aciertos, 'total', t.total) order by t.pos)
    from (
      select a.apodo, count(*) filter (where r.acerto) as aciertos, count(*) as total,
             row_number() over (order by (count(*) filter (where r.acerto))::numeric / count(*) desc, count(*) desc, a.apodo) as pos
      from privado.demo_ranked_completo() r join privado.demo_apodos a on a.jugador = r.jugador
      group by a.apodo
      having count(*) >= 30
    ) t where t.pos <= 20
  ), '[]'::jsonb));

  datos := datos || jsonb_build_object('tabla_hoy', coalesce((
    select jsonb_agg(jsonb_build_object('apodo', t.apodo, 'aciertos', t.aciertos, 'segundos', t.segundos) order by t.pos)
    from (
      select a.apodo, count(*) filter (where r.acerto) as aciertos,
             round(sum(extract(epoch from (r.respondida_en - r.servida_en)))::numeric, 0) as segundos,
             row_number() over (
               order by count(*) filter (where r.acerto) desc, sum(extract(epoch from (r.respondida_en - r.servida_en))), a.apodo
             ) as pos
      from privado.demo_ranked_completo() r join privado.demo_apodos a on a.jugador = r.jugador
      where r.reto_fecha = hoy
      group by a.apodo
    ) t where t.pos <= 20
  ), '[]'::jsonb));

  datos := datos || jsonb_build_object('hist_hoy', (
    select jsonb_agg(coalesce(h.n, 0) order by k)
    from generate_series(0, 10) k
    left join (
      select q.ac, count(*) as n
      from (select r.jugador, count(*) filter (where r.acerto) as ac from privado.demo_ranked_completo() r where r.reto_fecha = hoy group by r.jugador) q
      group by q.ac
    ) h on h.ac = k
  ));

  datos := datos || jsonb_build_object('ranking', coalesce((
    select jsonb_agg(jsonb_build_array(q.ac, q.tot))
    from (
      select count(*) filter (where r.acerto) as ac, count(*) as tot
      from privado.demo_ranked_completo() r join privado.demo_apodos a on a.jugador = r.jugador
      group by r.jugador having count(*) >= 30
    ) q
  ), '[]'::jsonb));

  insert into privado.demo_cache (clave, calculado, datos) values ('comun', now(), datos)
  on conflict (clave) do update set calculado = excluded.calculado, datos = excluded.datos;
  return datos;
end;
$$;

-- Todo lo que necesita la página en una sola llamada: lo común (solo Ranked, corridas completas) y lo tuyo (también): apodo, puntaje,
-- tu lugar en la tabla histórica y, si ya hiciste el reto de hoy, tu puntaje, a cuántos les ganaste y el número del reto. Lo tuyo
-- se calcula con tus propias filas y con lo ya calculado en `demo_comun`; no recuenta a todos. Nunca cifras por ventana.
create function public.demo_agregado(p_jugador text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/New_York')::date;
  comun jsonb := privado.demo_comun();
  tu jsonb;
  mis_aciertos integer;
  mi_total integer;
  mi_apodo text;
  mi_lugar integer;
  mi_reto integer;
  menores integer;
  jugaron integer;
  numero integer;
begin
  select count(*) filter (where acerto), count(*) into mis_aciertos, mi_total from privado.demo_ranked_completo(p_jugador);
  select apodo into mi_apodo from privado.demo_apodos where jugador = p_jugador;

  if mi_apodo is not null and mi_total >= 30 then
    select 1 + count(*) into mi_lugar
    from jsonb_array_elements(comun -> 'ranking') e
    where (e ->> 0)::numeric / (e ->> 1)::numeric > mis_aciertos::numeric / mi_total
       or ((e ->> 0)::numeric / (e ->> 1)::numeric = mis_aciertos::numeric / mi_total and (e ->> 1)::integer > mi_total);
  end if;

  tu := jsonb_build_object('aciertos', mis_aciertos, 'total', mi_total, 'apodo', mi_apodo, 'lugar', mi_lugar);

  -- Reto de hoy: solo cuenta si ya contestó las 10.
  select count(*) filter (where acerto) into mi_reto from privado.demo_ranked_completo(p_jugador) where reto_fecha = hoy having count(*) = 10;
  if mi_reto is not null then
    select coalesce(sum(h.v::integer) filter (where h.k0 - 1 < mi_reto), 0), coalesce(sum(h.v::integer), 0) into menores, jugaron
    from jsonb_array_elements_text(comun -> 'hist_hoy') with ordinality as h (v, k0);
    select hoy - min(inicia) + 1 into numero from privado.demo_grupos;
    tu := tu || jsonb_build_object(
      'reto', jsonb_build_object(
        'aciertos', mi_reto,
        'mejor_que', case when jugaron > 1 then round(100.0 * menores / jugaron) end,
        'jugaron', jugaron,
        'numero', numero
      )
    );
  end if;

  return jsonb_build_object('comun', comun - 'hist_hoy' - 'ranking', 'tu', tu);
end;
$$;

-- Resultados por modo y tramo de tiempo, para publicar números (por ejemplo menos de 3 s y 3 s o más) sin cambiar lo que cuenta
-- la página. Cada respuesta guarda cuánto tardó (servida_en y respondida_en). Solo con SQL del proyecto (no la ejecuta ningún
-- rol de la API):  select * from privado.demo_por_tramo(3);
create function privado.demo_por_tramo(p_segundos numeric default 3)
returns table (modo text, tramo text, respuestas bigint, aciertos bigint, porcentaje numeric, jugadores bigint, mediana_segundos numeric)
language sql
stable
set search_path = ''
as $$
  with t as (
    select r.modo, r.jugador, r.acerto, extract(epoch from (r.respondida_en - r.servida_en)) as seg
    from privado.demo_rondas r where r.respondida_en is not null
  )
  select t.modo, case when t.seg < p_segundos then format('menos de %s s', p_segundos) else format('%s s o más', p_segundos) end,
         count(*), count(*) filter (where t.acerto), round(100.0 * count(*) filter (where t.acerto) / count(*), 1),
         count(distinct t.jugador), round((percentile_cont(0.5) within group (order by t.seg))::numeric, 1)
  from t group by 1, 2
  union all
  select t.modo, 'todas', count(*), count(*) filter (where t.acerto), round(100.0 * count(*) filter (where t.acerto) / count(*), 1),
         count(distinct t.jugador), round((percentile_cont(0.5) within group (order by t.seg))::numeric, 1)
  from t group by 1
  order by 1, 2;
$$;

revoke all on function privado.demo_ranked_completo(text) from public, anon, authenticated;
revoke all on function privado.demo_comun() from public, anon, authenticated;
revoke all on function privado.demo_por_tramo(numeric) from public, anon, authenticated;
revoke all on function public.demo_apodo(text, text) from public, anon, authenticated;
revoke all on function public.demo_agregado(text) from public, anon, authenticated;
grant execute on function public.demo_apodo(text, text) to service_role;
grant execute on function public.demo_agregado(text) to service_role;
