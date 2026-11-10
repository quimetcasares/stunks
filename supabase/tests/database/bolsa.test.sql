-- Caché de la bolsa y límite de 120 días por hora por cuenta.
-- Corre con `npm run db:probar` (Supabase local); todo se deshace al terminar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'beto@example.com', now());
insert into storage.objects (bucket_id, name) values ('bolsa', 'ensayo/MQ/20240102.opr.gz');

select ok(exists (select 1 from storage.buckets where id = 'bolsa' and not public), 'el bucket de caché existe y es privado');

set local role anon;
select throws_ok('select public.pedir_dia_bolsa()', '42501', null, 'sin entrar no se piden días');
select is((select count(*) from storage.objects where bucket_id = 'bolsa'), 0::bigint, 'sin entrar no se ve la caché');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(public.pedir_dia_bolsa(), true, 'Ana pide su primer día');
select throws_ok('select * from privado.peticiones_bolsa', '42501', null, 'Ana no lee la tabla del límite');
select is((select count(*) from storage.objects where bucket_id = 'bolsa'), 0::bigint, 'Ana no ve la caché');
reset role;

select is(
  (select cuenta from privado.peticiones_bolsa where usuario_id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'queda contado un día en la hora actual'
);

-- Ana llega a 119 en esta hora y tiene una hora vieja de hace dos días.
update privado.peticiones_bolsa set cuenta = 119 where usuario_id = '00000000-0000-0000-0000-00000000000a';
insert into privado.peticiones_bolsa (usuario_id, hora, cuenta)
  values ('00000000-0000-0000-0000-00000000000a', date_trunc('hour', now()) - interval '2 days', 50);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select is(public.pedir_dia_bolsa(), true, 'el día 120 de la hora todavía entra');
select is(public.pedir_dia_bolsa(), false, 'el 121 ya no');
reset role;

select is(
  (select count(*) from privado.peticiones_bolsa where usuario_id = '00000000-0000-0000-0000-00000000000a'),
  1::bigint,
  'las horas de hace más de un día se borran'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is(public.pedir_dia_bolsa(), true, 'el límite de Ana no cuenta para Beto');
select public.borrar_mi_cuenta();
reset role;

select is(
  (select count(*) from privado.peticiones_bolsa where usuario_id = '00000000-0000-0000-0000-00000000000b'),
  0::bigint,
  'al borrar la cuenta se borra su conteo'
);

select * from finish();
rollback;
