-- Sin chat ni acceso al NQ para otras cuentas (ver docs/decisiones/0011-nq-solo-administrador.md).
-- Se quitan la solicitud de acceso, su aprobación y el chat. El bucket nq se queda y solo lo lee el administrador.

drop function public.pedir_acceso_nq();
drop function public.decidir_acceso_nq(uuid, boolean);

-- La regla vieja del bucket dependía del acceso aprobado; se cambia antes de quitar esa función.
drop policy "solo cuentas con acceso al NQ leen sus archivos" on storage.objects;
drop function privado.tiene_acceso_nq();

create policy "solo el administrador lee los archivos del NQ" on storage.objects
  for select to authenticated
  using (bucket_id = 'nq' and (select privado.es_admin()));

-- Al borrar las tablas salen también de la publicación de tiempo real, con sus índices y reglas.
drop table public.mensajes;
drop table public.accesos_nq;
