-- Reglas por fila de la F1: perfiles, administrador, avisos, archivos del NQ y borrar la cuenta.
-- Sin chat ni acceso al NQ para otras cuentas (docs/decisiones/0011-nq-solo-administrador.md).
-- Corre con `npm run db:probar` (Supabase local); todo se deshace al terminar.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Cuentas de prueba: el correo del administrador entra sin confirmar; Ana y Beto ya confirmados.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000001', 'quimetcasares@gmail.com', null),
  ('00000000-0000-0000-0000-00000000000a', 'ana@example.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'beto@example.com', now());

-- Un archivo de mentira en el bucket del NQ, para ver quién lo puede leer.
insert into storage.objects (bucket_id, name) values ('nq', 'pruebas/mes.bin');

-- ─── Al registrarse ─────────────────────────────────────────────────────────

select is(
  (select count(*) from public.perfiles where id in (
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b'
  )),
  3::bigint,
  'cada cuenta nueva tiene su perfil'
);
select is(
  (select count(*) from public.administradores),
  0::bigint,
  'el correo del administrador sin confirmar no da el rol'
);
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-000000000001';
select ok(
  exists (select 1 from public.administradores where usuario_id = '00000000-0000-0000-0000-000000000001'),
  'al confirmar el correo del administrador se le da el rol'
);
select is((select count(*) from public.administradores), 1::bigint, 'nadie más es administrador');

-- ─── Sin chat ni acceso al NQ ───────────────────────────────────────────────

select hasnt_table('public', 'mensajes', 'el chat ya no existe');
select hasnt_table('public', 'accesos_nq', 'las solicitudes de acceso al NQ ya no existen');
select hasnt_function('public', 'pedir_acceso_nq', 'ya no se pide acceso al NQ');
select hasnt_function('public', 'decidir_acceso_nq', 'ya no se aprueban accesos al NQ');
select hasnt_function('privado', 'tiene_acceso_nq', 'ya no hay acceso al NQ por cuenta');

-- ─── Sin entrar (anon) ──────────────────────────────────────────────────────

set local role anon;
select throws_ok('select * from public.perfiles', '42501', null, 'sin entrar no se leen perfiles');
select throws_ok('select * from public.consentimientos', '42501', null, 'sin entrar no se leen avisos aceptados');
select is(
  (select count(*) from storage.objects where bucket_id = 'nq'),
  0::bigint,
  'sin entrar no se ve nada del NQ'
);
reset role;

-- ─── Ana, cuenta normal ─────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is((select count(*) from public.perfiles), 1::bigint, 'Ana solo ve su perfil');
select is(privado.es_admin(), false, 'Ana no es administradora');
select is((select count(*) from public.administradores), 0::bigint, 'Ana no ve la lista de administradores');
select lives_ok(
  $$ update public.perfiles set apodo = 'ana_trader', idioma = 'en' where id = auth.uid() $$,
  'Ana cambia su apodo y su idioma'
);
select throws_ok(
  $$ update public.perfiles set creado_en = now() where id = auth.uid() $$,
  '42501', null, 'Ana no cambia otras columnas de su perfil'
);
select throws_ok(
  $$ update public.perfiles set apodo = 'no vale' where id = auth.uid() $$,
  '23514', null, 'el apodo solo lleva letras, números, guion y guion bajo'
);
update public.perfiles set apodo = 'hackeado' where id = '00000000-0000-0000-0000-00000000000b';
select throws_ok(
  $$ insert into public.administradores (usuario_id) values (auth.uid()) $$,
  '42501', null, 'Ana no se puede hacer administradora'
);

select lives_ok(
  $$ insert into public.consentimientos (documento, version) values ('privacidad', '2026-11'), ('grabacion', '2026-11') $$,
  'Ana acepta los avisos'
);
select throws_ok(
  $$ insert into public.consentimientos (usuario_id, documento, version)
     values ('00000000-0000-0000-0000-00000000000b', 'privacidad', '2026-11') $$,
  '42501', null, 'Ana no acepta avisos a nombre de otra cuenta'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'nq'),
  0::bigint,
  'Ana no ve nada del NQ'
);
reset role;

-- ─── Beto no ve lo de Ana ───────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((select count(*) from public.consentimientos), 0::bigint, 'Beto no ve los avisos que aceptó Ana');
select is((select apodo from public.perfiles), null, 'el intento de Ana de cambiar el perfil de Beto no hizo nada');
reset role;

-- ─── El administrador ───────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
select ok((select count(*) from public.perfiles) >= 3, 'el administrador ve todos los perfiles');
select is(
  (select count(*) from storage.objects where bucket_id = 'nq'),
  1::bigint,
  'el administrador lee los archivos del NQ'
);
reset role;

-- ─── Borrar la cuenta ───────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok($$ select public.borrar_mi_cuenta() $$, 'Ana borra su cuenta');
reset role;

select is(
  (select count(*) from public.perfiles where id = '00000000-0000-0000-0000-00000000000a')
    + (select count(*) from public.consentimientos where usuario_id = '00000000-0000-0000-0000-00000000000a')
    + (select count(*) from auth.users where id = '00000000-0000-0000-0000-00000000000a'),
  0::bigint,
  'al borrar la cuenta no queda nada de Ana'
);

select * from finish();
rollback;
