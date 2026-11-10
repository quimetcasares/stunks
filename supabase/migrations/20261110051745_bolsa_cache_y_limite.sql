-- Bolsa de Stunks: caché de los días generados y límite de días por cuenta (ver docs/decisiones/0010-bolsa-de-stunks.md).

-- Caché de la función dia. Privado y sin reglas: solo lo usa la función con la llave de servicio.
insert into storage.buckets (id, name, public) values ('bolsa', 'bolsa', false);

-- Cuántos días pidió cada cuenta en cada hora. Solo lo toca pedir_dia_bolsa(); las horas de más de un día se borran.
create table privado.peticiones_bolsa (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  hora timestamptz not null,
  cuenta integer not null default 0,
  primary key (usuario_id, hora)
);
alter table privado.peticiones_bolsa enable row level security;
revoke all on privado.peticiones_bolsa from public, anon, authenticated;

-- Cuenta un día pedido por la cuenta que llama y dice si sigue dentro del límite de 120 días por hora.
create function public.pedir_dia_bolsa()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := (select auth.uid());
  ahora timestamptz := date_trunc('hour', now());
  n integer;
begin
  if yo is null then
    raise exception 'Hace falta entrar con una cuenta.' using errcode = '42501';
  end if;
  insert into privado.peticiones_bolsa as p (usuario_id, hora, cuenta) values (yo, ahora, 1)
  on conflict (usuario_id, hora) do update set cuenta = p.cuenta + 1
  returning p.cuenta into n;
  delete from privado.peticiones_bolsa where usuario_id = yo and hora < ahora - interval '1 day';
  return n <= 120;
end;
$$;
revoke all on function public.pedir_dia_bolsa() from public, anon;
grant execute on function public.pedir_dia_bolsa() to authenticated;
