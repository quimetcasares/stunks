-- Demo "Real or Stunks?", etapa 6: apodos, marcador de todos, tu lugar y tabla de líderes. Sigue sobre las tablas de
-- 20261124180000_demo_real_o_stunks.sql. Todo en el esquema privado y solo con service_role, como lo anterior.

-- Un apodo por jugador (el hash de su uuid), de 3 a 16 caracteres, sin repetir (sin importar mayúsculas). Sin correo, sin cuenta.
create table privado.demo_apodos (
  jugador text primary key,
  apodo text not null check (apodo ~ '^[A-Za-z0-9_.-][A-Za-z0-9_. -]{1,14}[A-Za-z0-9_.-]$'),
  creado timestamptz not null default now()
);
create unique index demo_apodos_unico on privado.demo_apodos (lower(apodo));

-- Patrones (expresiones regulares, sin importar mayúsculas) que no pueden ir en un apodo. Empieza vacía: la llena Joaquín.
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
  delete from privado.demo_cache where clave = 'comun';
  return 'ok';
end;
$$;

-- Lo común a todos (marcador, tabla), con caché de 10 segundos.
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
  if found and now() - c.calculado < interval '10 seconds' then
    return c.datos;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('demo:comun', 0));
  select * into c from privado.demo_cache where clave = 'comun';
  if found and now() - c.calculado < interval '10 seconds' then
    return c.datos;
  end if;

  select jsonb_build_object(
    'total', count(*),
    'aciertos', count(*) filter (where acerto),
    'jugadores', count(distinct jugador),
    'hoy_total', count(*) filter (where (respondida_en at time zone 'America/New_York')::date = hoy),
    'hoy_aciertos', count(*) filter (where acerto and (respondida_en at time zone 'America/New_York')::date = hoy)
  ) into datos
  from privado.demo_rondas where respondida_en is not null;

  datos := datos || jsonb_build_object('tabla', coalesce((
    select jsonb_agg(jsonb_build_object('apodo', t.apodo, 'aciertos', t.aciertos, 'total', t.total) order by t.pos)
    from (
      select a.apodo, count(*) filter (where r.acerto) as aciertos, count(*) as total,
             row_number() over (order by (count(*) filter (where r.acerto))::numeric / count(*) desc, count(*) desc, a.apodo) as pos
      from privado.demo_rondas r join privado.demo_apodos a on a.jugador = r.jugador
      where r.respondida_en is not null
      group by a.apodo
      having count(*) >= 30
    ) t where t.pos <= 20
  ), '[]'::jsonb));

  insert into privado.demo_cache (clave, calculado, datos) values ('comun', now(), datos)
  on conflict (clave) do update set calculado = excluded.calculado, datos = excluded.datos;
  return datos;
end;
$$;

-- Todo lo que necesita la página en una sola llamada: el marcador de todos, la tabla de líderes y lo tuyo (apodo, puntaje, tu
-- lugar en la tabla y, si ya hiciste el reto de hoy, a cuántos le ganaste y el número del reto). Nunca cifras por ventana.
create function public.demo_agregado(p_jugador text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/New_York')::date;
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
  select count(*) filter (where acerto), count(*) into mis_aciertos, mi_total
    from privado.demo_rondas where jugador = p_jugador and respondida_en is not null;
  select apodo into mi_apodo from privado.demo_apodos where jugador = p_jugador;

  if mi_apodo is not null and mi_total >= 30 then
    select 1 + count(*) into mi_lugar from (
      select r.jugador, count(*) filter (where r.acerto) as ac, count(*) as tot
      from privado.demo_rondas r join privado.demo_apodos a on a.jugador = r.jugador
      where r.respondida_en is not null group by r.jugador having count(*) >= 30
    ) x
    where x.ac::numeric / x.tot > mis_aciertos::numeric / mi_total
       or (x.ac::numeric / x.tot = mis_aciertos::numeric / mi_total and x.tot > mi_total);
  end if;

  tu := jsonb_build_object('aciertos', mis_aciertos, 'total', mi_total, 'apodo', mi_apodo, 'lugar', mi_lugar);

  -- Reto de hoy: solo cuenta si ya contestó las 10.
  select count(*) filter (where acerto) into mi_reto from privado.demo_rondas
    where jugador = p_jugador and modo = 'reto' and reto_fecha = hoy and respondida_en is not null
    having count(*) = 10;
  if mi_reto is not null then
    with por_jugador as (
      select jugador, count(*) filter (where acerto) as ac from privado.demo_rondas
      where modo = 'reto' and reto_fecha = hoy and respondida_en is not null
      group by jugador having count(*) = 10
    )
    select count(*) filter (where ac < mi_reto), count(*) into menores, jugaron from por_jugador;
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

  return jsonb_build_object('comun', privado.demo_comun(), 'tu', tu);
end;
$$;

revoke all on function privado.demo_comun() from public, anon, authenticated;
revoke all on function public.demo_apodo(text, text) from public, anon, authenticated;
revoke all on function public.demo_agregado(text) from public, anon, authenticated;
grant execute on function public.demo_apodo(text, text) to service_role;
grant execute on function public.demo_agregado(text) to service_role;
