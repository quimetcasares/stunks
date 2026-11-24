-- Demo "Real or Stunks?" (docs/decisiones/0014-demo-real-o-stunks.md): tablas del pool de ventanas, de las rondas servidas y del
-- límite por IP, y las funciones que usa la Edge Function demo (que vive en stunks-bolsa). Aquí solo hay forma: el pool, con la
-- verdad de cada ventana, se carga a mano con la llave de servicio y nunca entra a un repositorio.
-- Todo vive en el esquema privado y solo lo tocan las funciones demo_*, que solo ejecuta service_role: ni anon ni authenticated.

-- Un grupo por mes (rotación mensual): 400 ventanas, de las que 300 forman el horario del reto del día (30 días de 10) y 100
-- quedan de reserva. `inicia` es el primer día del reto, en fecha de Nueva York. Solo puede haber un grupo activo.
create table privado.demo_grupos (
  grupo text primary key,
  inicia date not null,
  activo boolean not null default false
);
create unique index demo_un_grupo_activo on privado.demo_grupos ((true)) where activo;

-- `fuente` es la verdad y nunca sale antes de contestar. `velas` ya está en la forma exacta que se manda al navegador.
create table privado.demo_ventanas (
  id uuid primary key,
  grupo text not null references privado.demo_grupos (grupo) on delete cascade,
  fuente text not null check (fuente in ('real', 'stunks')),
  par integer not null,
  reto_dia integer check (reto_dia between 0 and 29),
  reto_pos integer check (reto_pos between 0 and 9),
  origen text not null,
  velas jsonb not null,
  check ((reto_dia is null) = (reto_pos is null)),
  unique (grupo, reto_dia, reto_pos)
);
create index demo_ventanas_fuente on privado.demo_ventanas (grupo, fuente);

-- Una fila por gráfica servida. `ronda` es un uuid aleatorio por entrega: el navegador nunca ve el id de la ventana.
-- `jugador` es el hash del uuid que guarda el navegador (sin cuenta, sin correo).
create table privado.demo_rondas (
  ronda uuid primary key default gen_random_uuid(),
  jugador text not null,
  ventana_id uuid not null references privado.demo_ventanas (id) on delete cascade,
  modo text not null check (modo in ('reto', 'libre')),
  reto_fecha date,
  n integer not null check (n between 1 and 10),
  servida_en timestamptz not null default now(),
  respondida_en timestamptz,
  dijo text check (dijo in ('real', 'stunks')),
  acerto boolean,
  pista text check (pista in ('mechas', 'volumen', 'brincos', 'limpia', 'nose')),
  -- Número de corrida de Ranked de la huella de IP de ese día cuando se empezó esta corrida (1 = la primera). Sin IP ni hash.
  huella_n integer,
  check ((modo = 'reto') = (reto_fecha is not null)),
  check ((respondida_en is null) = (dijo is null)),
  unique (jugador, ventana_id)
);
create unique index demo_rondas_reto on privado.demo_rondas (jugador, reto_fecha, n) where modo = 'reto';
create index demo_rondas_jugador on privado.demo_rondas (jugador, modo, servida_en desc);
create index demo_rondas_ventana on privado.demo_rondas (ventana_id);

-- Llamadas por IP y hora. La IP no se guarda: solo un hash que lleva el día, así no se ligan dos días.
create table privado.demo_limite (
  ip_hash text not null,
  hora timestamptz not null,
  cuenta integer not null default 0,
  primary key (ip_hash, hora)
);

-- Parámetros que decide Joaquín. tope_corridas_ip: cuántas corridas de Ranked (el reto del día) puede empezar una misma huella de IP en
-- un día; 0 = sin tope. El valor por omisión es generoso a propósito, para no castigar a una oficina, una escuela o una casa con
-- varias personas detrás de la misma IP.
create table privado.demo_config (clave text primary key, valor integer not null);
insert into privado.demo_config (clave, valor) values ('tope_corridas_ip', 50);

-- Cuántas corridas de Ranked ha empezado cada huella de IP (el hash que cambia cada día). No se guarda la IP ni la huella junto a
-- las respuestas: en `demo_rondas` solo queda el número de corrida de esa huella (huella_n). Las filas se borran a las 24 horas.
create table privado.demo_corridas_ip (
  ip_hash text primary key,
  desde timestamptz not null default now(),
  corridas integer not null default 0
);
create index demo_corridas_ip_desde on privado.demo_corridas_ip (desde);
create index demo_limite_hora on privado.demo_limite (hora);

alter table privado.demo_config enable row level security;
alter table privado.demo_corridas_ip enable row level security;
alter table privado.demo_grupos enable row level security;
alter table privado.demo_ventanas enable row level security;
alter table privado.demo_rondas enable row level security;
alter table privado.demo_limite enable row level security;
revoke all on privado.demo_grupos, privado.demo_ventanas, privado.demo_rondas, privado.demo_limite, privado.demo_config, privado.demo_corridas_ip
  from public, anon, authenticated;

-- Cuenta una llamada de esta IP (hash) y dice si sigue dentro de `p_max` por hora. Las horas de más de 24 horas se borran en cada
-- llamada (como mucho quedan 25 horas de la última llamada de una huella, y solo si nadie vuelve a llamar al servicio).
create function public.demo_limite(p_ip_hash text, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  ahora timestamptz := date_trunc('hour', now());
  n integer;
begin
  insert into privado.demo_limite as l (ip_hash, hora, cuenta) values (p_ip_hash, ahora, 1)
  on conflict (ip_hash, hora) do update set cuenta = l.cuenta + 1
  returning l.cuenta into n;
  -- En cada llamada, no solo cuando entra una fila nueva: así el hash de una IP no dura más de un día mientras haya visitas.
  delete from privado.demo_limite where hora < ahora - interval '24 hours';
  return n <= p_max;
end;
$$;

-- Las 10 respuestas de una corrida de Ranked ya terminada, en orden: lo que se revela AL FINAL (no tras cada gráfica: revelarlo al
-- momento, con un reparto fijo, deja ganar contando; revisión de seguridad A1).
create function privado.demo_revelacion(p_jugador text, p_dia date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('n', x.n, 'acerto', x.acerto, 'era', w.fuente) order by x.n), '[]'::jsonb)
  from privado.demo_rondas x join privado.demo_ventanas w on w.id = x.ventana_id
  where x.jugador = p_jugador and x.modo = 'reto' and x.reto_fecha = p_dia and x.respondida_en is not null
$$;

-- La siguiente gráfica del jugador.
--   'reto':  las 10 del día, las mismas para todos (reto_dia = días desde `inicia`, en fecha de Nueva York) pero **en un orden que
--            cambia por jugador** (estable: lo da el hash del jugador y de la ventana). Una sola vez por jugador y día.
--   'libre': tandas de 10 al azar (sin forzar cuántas son reales: un balance fijo se puede contar) y sin dos parejas juntas, de la
--            reserva y de los retos de días ya pasados (nunca las de hoy ni las de días futuros), sin repetir ninguna que el jugador ya vio.
-- Si ya hay una ronda sin contestar de ese modo, vuelve a entregar la misma (recargar la página no regala otra gráfica).
create function public.demo_servir(p_jugador text, p_modo text, p_min_ms integer, p_ip_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g privado.demo_grupos;
  v privado.demo_ventanas;
  r privado.demo_rondas;
  hoy date := (now() at time zone 'America/New_York')::date;
  idx integer;
  hechas integer;
  pares integer[];
  huella integer;
  cuenta integer;
  tope integer;
begin
  if p_modo not in ('reto', 'libre') then
    raise exception 'modo inválido' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('demo:' || p_jugador, 0));

  select * into g from privado.demo_grupos where activo;
  if not found then
    return jsonb_build_object('estado', 'sin-grupo');
  end if;
  idx := hoy - g.inicia;

  -- ¿Ya tiene una sin contestar?
  select * into r from privado.demo_rondas
    where jugador = p_jugador and modo = p_modo and respondida_en is null and (p_modo = 'libre' or reto_fecha = hoy)
    order by servida_en limit 1;
  if found then
    select * into v from privado.demo_ventanas where id = r.ventana_id;
  elsif p_modo = 'reto' then
    if idx < 0 or idx > 29 then
      return jsonb_build_object('estado', 'sin-reto');
    end if;
    select count(*) into hechas from privado.demo_rondas where jugador = p_jugador and modo = 'reto' and reto_fecha = hoy;
    if hechas >= 10 then
      return jsonb_build_object('estado', 'terminado', 'revelacion', privado.demo_revelacion(p_jugador, hoy));
    end if;
    select w.* into v from privado.demo_ventanas w
      where w.grupo = g.grupo and w.reto_dia = idx
        and not exists (select 1 from privado.demo_rondas x where x.jugador = p_jugador and x.ventana_id = w.id)
      order by md5(p_jugador || w.id::text) limit 1;
    if not found then
      return jsonb_build_object('estado', 'sin-reto');
    end if;
    -- Corrida nueva: cuenta contra el tope de corridas por huella de IP y día (parámetro; 0 = sin tope). Las demás rondas de la
    -- corrida heredan el número de corrida de la primera.
    if hechas = 0 then
      delete from privado.demo_corridas_ip where desde < now() - interval '24 hours';
      if p_ip_hash is not null then
        insert into privado.demo_corridas_ip (ip_hash) values (p_ip_hash) on conflict (ip_hash) do nothing;
        select corridas into cuenta from privado.demo_corridas_ip where ip_hash = p_ip_hash for update;
        tope := coalesce((select valor from privado.demo_config where clave = 'tope_corridas_ip'), 0);
        if tope > 0 and cuenta >= tope then
          return jsonb_build_object('estado', 'tope');
        end if;
        update privado.demo_corridas_ip set corridas = corridas + 1 where ip_hash = p_ip_hash;
        huella := cuenta + 1;
      end if;
    else
      select huella_n into huella from privado.demo_rondas where jugador = p_jugador and modo = 'reto' and reto_fecha = hoy and n = 1;
    end if;
    insert into privado.demo_rondas (jugador, ventana_id, modo, reto_fecha, n, huella_n)
      values (p_jugador, v.id, 'reto', hoy, hechas + 1, huella) returning * into r;
  else
    select count(*) into hechas from privado.demo_rondas where jugador = p_jugador and modo = 'libre';
    hechas := hechas % 10; -- lugar dentro de la tanda de 10
    select coalesce(array_agg(t.par), '{}') into pares
      from (
        select w.par from privado.demo_rondas x join privado.demo_ventanas w on w.id = x.ventana_id
        where x.jugador = p_jugador and x.modo = 'libre' order by x.servida_en desc limit hechas
      ) t;
    select w.* into v from privado.demo_ventanas w
      where w.grupo = g.grupo and (w.reto_dia is null or w.reto_dia < idx)
        and not exists (select 1 from privado.demo_rondas x where x.jugador = p_jugador and x.ventana_id = w.id)
        and w.par <> all (pares)
      order by random() limit 1;
    if not found then
      -- Sin la regla de las parejas juntas, para no dejar a nadie sin gráfica por eso.
      select w.* into v from privado.demo_ventanas w
        where w.grupo = g.grupo and (w.reto_dia is null or w.reto_dia < idx)
          and not exists (select 1 from privado.demo_rondas x where x.jugador = p_jugador and x.ventana_id = w.id)
        order by random() limit 1;
    end if;
    if not found then
      return jsonb_build_object('estado', 'agotado');
    end if;
    insert into privado.demo_rondas (jugador, ventana_id, modo, n) values (p_jugador, v.id, 'libre', hechas + 1) returning * into r;
  end if;

  return jsonb_build_object(
    'estado', 'ok',
    'ronda', r.ronda,
    'n', r.n,
    'de', 10,
    'espera_ms', case when r.modo = 'reto' then greatest(0, p_min_ms - floor(extract(epoch from (now() - r.servida_en)) * 1000)::integer) else 0 end,
    'velas', v.velas
  );
end;
$$;

-- Contesta una ronda: una respuesta por ronda y, en el reto (Ranked), el tiempo mínimo contado con el reloj de la base desde que
-- se sirvió; el juego libre (Free) no espera. Antes del mínimo no se acepta. **En Ranked no se devuelve si acertó ni qué era hasta
-- contestar la décima**; entonces salen las 10 juntas (`revelacion`). En Free la respuesta es inmediata. y la ronda sigue abierta. Una ronda ajena o inexistente responde igual: 'no-existe'.
create function public.demo_responder(p_ronda uuid, p_jugador text, p_dijo text, p_min_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r privado.demo_rondas;
  era text;
  pasado integer;
begin
  if p_dijo not in ('real', 'stunks') then
    raise exception 'respuesta inválida' using errcode = '22023';
  end if;
  select * into r from privado.demo_rondas where ronda = p_ronda and jugador = p_jugador for update;
  if not found then
    return jsonb_build_object('estado', 'no-existe');
  end if;
  if r.respondida_en is not null then
    return jsonb_build_object('estado', 'ya');
  end if;
  pasado := floor(extract(epoch from (now() - r.servida_en)) * 1000)::integer;
  if r.modo = 'reto' and pasado < p_min_ms then
    return jsonb_build_object('estado', 'pronto', 'espera_ms', p_min_ms - pasado);
  end if;
  select fuente into era from privado.demo_ventanas where id = r.ventana_id;
  update privado.demo_rondas set respondida_en = now(), dijo = p_dijo, acerto = (p_dijo = era) where ronda = p_ronda;
  if r.modo = 'libre' then
    return jsonb_build_object('estado', 'ok', 'acerto', p_dijo = era, 'era', era);
  end if;
  -- Ranked: solo "recibida". Con la décima, las 10 juntas.
  if (select count(*) from privado.demo_rondas where jugador = p_jugador and modo = 'reto' and reto_fecha = r.reto_fecha and respondida_en is not null) >= 10 then
    return jsonb_build_object('estado', 'ok', 'recibida', true, 'n', r.n, 'revelacion', privado.demo_revelacion(p_jugador, r.reto_fecha));
  end if;
  return jsonb_build_object('estado', 'ok', 'recibida', true, 'n', r.n);
end;
$$;

-- "¿Qué la delató?": un toque opcional, una sola vez y solo si la ronda ya se contestó.
create function public.demo_pista(p_ronda uuid, p_jugador text, p_pista text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if p_pista not in ('mechas', 'volumen', 'brincos', 'limpia', 'nose') then
    raise exception 'pista inválida' using errcode = '22023';
  end if;
  update privado.demo_rondas set pista = p_pista
    where ronda = p_ronda and jugador = p_jugador and respondida_en is not null and pista is null;
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

revoke all on function privado.demo_revelacion(text, date) from public, anon, authenticated;
revoke all on function public.demo_limite(text, integer) from public, anon, authenticated;
revoke all on function public.demo_servir(text, text, integer, text) from public, anon, authenticated;
revoke all on function public.demo_responder(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.demo_pista(uuid, text, text) from public, anon, authenticated;
grant execute on function public.demo_limite(text, integer) to service_role;
grant execute on function public.demo_servir(text, text, integer, text) to service_role;
grant execute on function public.demo_responder(uuid, text, text, integer) to service_role;
grant execute on function public.demo_pista(uuid, text, text) to service_role;
