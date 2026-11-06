-- Índices para las llaves foráneas que apuntan a la cuenta del autor o de quien decidió.
-- Sin ellos, borrar una cuenta revisa todos los mensajes y accesos (aviso del revisor de Supabase).
create index mensajes_por_autor on public.mensajes (autor);
create index accesos_nq_por_decidido_por on public.accesos_nq (decidido_por);
