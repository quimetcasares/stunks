-- F1 · Cuentas, chat y acceso al NQ (ver docs/decisiones/0008-cuentas.md).
-- Cada tabla tiene reglas por fila: cada cuenta ve lo suyo y el administrador ve todo.
-- Los permisos se dan tabla por tabla; nada queda abierto para quien no ha entrado (anon).

-- Funciones de apoyo en un esquema que el API no expone.
create schema privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

-- ─── Administradores ────────────────────────────────────────────────────────

-- Correos que se vuelven administradores cuando la cuenta confirma su correo.
create table privado.correos_admin (
  correo text primary key check (correo = lower(correo))
);
insert into privado.correos_admin (correo) values ('quimetcasares@gmail.com');

create table public.administradores (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  desde timestamptz not null default now()
);
alter table public.administradores enable row level security;
revoke all on public.administradores from anon, authenticated;
grant select on public.administradores to authenticated;

create function privado.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.administradores where usuario_id = (select auth.uid()));
$$;
revoke all on function privado.es_admin() from public;
grant execute on function privado.es_admin() to authenticated;

create policy "cada cuenta sabe si es administradora" on public.administradores
  for select to authenticated
  using (usuario_id = (select auth.uid()));

-- ─── Perfiles ───────────────────────────────────────────────────────────────

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  apodo text check (apodo ~ '^[A-Za-z0-9_-]{3,20}$'),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  creado_en timestamptz not null default now()
);
create unique index perfiles_apodo_unico on public.perfiles (lower(apodo));
alter table public.perfiles enable row level security;
revoke all on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;
-- Desde la app solo se cambian el apodo y el idioma; el perfil lo crea la base al registrarse.
grant update (apodo, idioma) on public.perfiles to authenticated;

create policy "cada cuenta ve su perfil y el administrador todos" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or (select privado.es_admin()));

create policy "cada cuenta cambia su perfil" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ─── Avisos aceptados (privacidad y grabación) ──────────────────────────────

-- Una fila por cada versión aceptada; no se cambian ni se borran desde la app.
create table public.consentimientos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  documento text not null check (documento in ('privacidad', 'grabacion')),
  version text not null check (char_length(version) between 1 and 20),
  aceptado_en timestamptz not null default now(),
  unique (usuario_id, documento, version)
);
alter table public.consentimientos enable row level security;
revoke all on public.consentimientos from anon, authenticated;
grant select on public.consentimientos to authenticated;
grant insert (documento, version) on public.consentimientos to authenticated;

create policy "cada cuenta ve sus avisos aceptados y el administrador todos" on public.consentimientos
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select privado.es_admin()));

create policy "cada cuenta acepta por sí misma" on public.consentimientos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));

-- ─── Acceso al NQ ───────────────────────────────────────────────────────────

-- Sin tope de cuentas (decisión 0007); cada acceso lo aprueba el administrador.
create table public.accesos_nq (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  pedido_en timestamptz not null default now(),
  decidido_en timestamptz,
  decidido_por uuid references auth.users (id) on delete set null
);
alter table public.accesos_nq enable row level security;
revoke all on public.accesos_nq from anon, authenticated;
-- Solo lectura: pedir y decidir pasa por pedir_acceso_nq() y decidir_acceso_nq().
grant select on public.accesos_nq to authenticated;

create policy "cada cuenta ve su acceso y el administrador todos" on public.accesos_nq
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select privado.es_admin()));

create function privado.tiene_acceso_nq()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.accesos_nq where usuario_id = (select auth.uid()) and estado = 'aprobado'
  );
$$;
revoke all on function privado.tiene_acceso_nq() from public;
grant execute on function privado.tiene_acceso_nq() to authenticated;

-- Archivos del NQ (se suben en la F2). Privado: solo cuentas con acceso aprobado pueden leer.
insert into storage.buckets (id, name, public) values ('nq', 'nq', false);

create policy "solo cuentas con acceso al NQ leen sus archivos" on storage.objects
  for select to authenticated
  using (bucket_id = 'nq' and (select privado.tiene_acceso_nq()));

-- ─── Chat con el administrador ──────────────────────────────────────────────

-- Cada cuenta tiene una sola conversación con el administrador; se identifica con el id de la cuenta.
create table public.mensajes (
  id bigint generated always as identity primary key,
  conversacion uuid not null references auth.users (id) on delete cascade,
  autor uuid default auth.uid() references auth.users (id) on delete set null,
  tipo text not null default 'texto' check (tipo in ('texto', 'solicitud', 'aprobado', 'rechazado')),
  texto text not null default '' check (char_length(texto) <= 2000),
  creado_en timestamptz not null default now(),
  check (tipo <> 'texto' or char_length(btrim(texto)) > 0)
);
create index mensajes_por_conversacion on public.mensajes (conversacion, creado_en);
alter table public.mensajes enable row level security;
revoke all on public.mensajes from anon, authenticated;
grant select on public.mensajes to authenticated;
-- Desde la app solo se escriben mensajes de texto; los avisos de acceso los pone la base.
grant insert (conversacion, texto) on public.mensajes to authenticated;

create policy "cada cuenta ve su conversación y el administrador todas" on public.mensajes
  for select to authenticated
  using (conversacion = (select auth.uid()) or (select privado.es_admin()));

create policy "cada cuenta escribe en su conversación y el administrador en todas" on public.mensajes
  for insert to authenticated
  with check (
    tipo = 'texto'
    and autor = (select auth.uid())
    and (conversacion = (select auth.uid()) or (select privado.es_admin()))
  );

-- Mensajes y accesos en tiempo real (respetan las mismas reglas por fila).
alter publication supabase_realtime add table public.mensajes, public.accesos_nq;

-- ─── Acciones ───────────────────────────────────────────────────────────────

-- Pide acceso al NQ y deja el aviso en el chat. Si ya está pendiente o aprobado, no repite.
create function public.pedir_acceso_nq()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  actual text;
begin
  if yo is null then
    raise exception 'Hace falta entrar con una cuenta.' using errcode = '42501';
  end if;
  select estado into actual from public.accesos_nq where usuario_id = yo;
  if actual in ('pendiente', 'aprobado') then
    return actual;
  end if;
  insert into public.accesos_nq (usuario_id) values (yo)
  on conflict (usuario_id) do update
    set estado = 'pendiente', pedido_en = now(), decidido_en = null, decidido_por = null;
  insert into public.mensajes (conversacion, autor, tipo) values (yo, yo, 'solicitud');
  return 'pendiente';
end;
$$;
revoke all on function public.pedir_acceso_nq() from public, anon;
grant execute on function public.pedir_acceso_nq() to authenticated;

-- Aprueba o rechaza el acceso de una cuenta (solo el administrador) y lo avisa en su chat.
create function public.decidir_acceso_nq(usuario uuid, aprobar boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  nuevo text := case when aprobar then 'aprobado' else 'rechazado' end;
begin
  if not privado.es_admin() then
    raise exception 'Solo el administrador decide los accesos.' using errcode = '42501';
  end if;
  insert into public.accesos_nq (usuario_id, estado, decidido_en, decidido_por)
  values (usuario, nuevo, now(), yo)
  on conflict (usuario_id) do update
    set estado = excluded.estado, decidido_en = excluded.decidido_en, decidido_por = excluded.decidido_por;
  insert into public.mensajes (conversacion, autor, tipo) values (usuario, yo, nuevo);
  return nuevo;
end;
$$;
revoke all on function public.decidir_acceso_nq(uuid, boolean) from public, anon;
grant execute on function public.decidir_acceso_nq(uuid, boolean) to authenticated;

-- Borra la cuenta y, en cascada, su perfil, avisos aceptados, acceso y conversación.
create function public.borrar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
begin
  if yo is null then
    raise exception 'Hace falta entrar con una cuenta.' using errcode = '42501';
  end if;
  delete from auth.users where id = yo;
end;
$$;
revoke all on function public.borrar_mi_cuenta() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;

-- ─── Al registrarse ─────────────────────────────────────────────────────────

create function privado.al_crear_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id) values (new.id);
  return new;
end;
$$;

create trigger al_crear_cuenta
  after insert on auth.users
  for each row execute function privado.al_crear_cuenta();

-- El rol de administrador solo se da con el correo ya confirmado (Google lo confirma al entrar).
create function privado.al_confirmar_correo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
    and exists (select 1 from privado.correos_admin where correo = lower(new.email)) then
    insert into public.administradores (usuario_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger al_confirmar_correo
  after insert or update of email_confirmed_at on auth.users
  for each row execute function privado.al_confirmar_correo();
