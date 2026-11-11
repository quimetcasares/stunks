-- Bolsa de Stunks: límite por tramos de 30 minutos (ver docs/decisiones/0013-bolsa-por-tramos.md).

-- Cuántos tramos pidió cada cuenta en cada hora (operaciones y libro cuentan por separado). Solo lo toca
-- pedir_tramo_bolsa(); las horas de más de un día se borran.
create table privado.tramos_bolsa (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  hora timestamptz not null,
  cuenta integer not null default 0,
  primary key (usuario_id, hora)
);
alter table privado.tramos_bolsa enable row level security;
revoke all on privado.tramos_bolsa from public, anon, authenticated;

-- Cuenta un tramo pedido por la cuenta que llama y dice si sigue dentro del límite de 3,000 tramos por hora.
create function public.pedir_tramo_bolsa()
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
  insert into privado.tramos_bolsa as p (usuario_id, hora, cuenta) values (yo, ahora, 1)
  on conflict (usuario_id, hora) do update set cuenta = p.cuenta + 1
  returning p.cuenta into n;
  delete from privado.tramos_bolsa where usuario_id = yo and hora < ahora - interval '1 day';
  return n <= 3000;
end;
$$;
revoke all on function public.pedir_tramo_bolsa() from public, anon;
grant execute on function public.pedir_tramo_bolsa() to authenticated;
