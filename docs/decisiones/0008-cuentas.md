# 0008 · Cuentas, chat y acceso al NQ en Supabase

**Estado:** vigente · **Fecha:** 2026-11-06

## Contexto

La F1 agrega cuentas, un chat con el administrador y la solicitud de acceso al NQ. La [0003](0003-stack.md) eligió Supabase para eso. Lo que importa es que nadie lea lo que no le toca: el chat de otra cuenta, el estado de acceso de otros y, sobre todo, los datos del NQ sin acceso aprobado ([0001](0001-nq-cerrado.md), [0007](0007-nq-sin-tope.md)).

## Decisión

**Entrar.** Con Google o con un link al correo (Supabase Auth), sin contraseñas. El correo sale por Resend desde el dominio `stunks.app`; el correo de prueba de Supabase solo le llega al equipo del proyecto.

**Tablas.** Todas con reglas por fila y permisos dados tabla por tabla; sin entrar (`anon`) no se lee nada.

| Tabla             | Qué guarda                                                              | Quién la lee                        |
| ----------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `perfiles`        | Apodo e idioma; se crea solo al registrarse                             | La cuenta dueña y el administrador  |
| `consentimientos` | Cada versión aceptada del aviso de privacidad y de grabación, con fecha | La cuenta dueña y el administrador  |
| `accesos_nq`      | Solicitud de acceso al NQ: pendiente, aprobado o rechazado              | La cuenta dueña y el administrador  |
| `mensajes`        | Chat: una conversación por cuenta con el administrador                  | La cuenta dueña y el administrador  |
| `administradores` | Cuentas con rol de administrador                                        | Cada cuenta solo sabe si ella lo es |

**Lo sensible lo hace la base, no la app.** Desde la app solo se cambia el apodo y el idioma, se aceptan avisos y se escriben mensajes de texto. Pedir acceso (`pedir_acceso_nq`), aprobar o rechazar (`decidir_acceso_nq`) y borrar la cuenta (`borrar_mi_cuenta`) son funciones de la base que revisan quién llama y dejan el aviso en el chat.

**Administrador.** Se define por correo en `privado.correos_admin` y el rol se da solo cuando el correo está confirmado (Google lo confirma al entrar).

**Archivos del NQ.** Bucket privado `nq`: solo lo leen cuentas con acceso aprobado. Los archivos, los enlaces que caducan y la marca por usuario llegan con la F2.

**Tiempo real.** Mensajes y accesos se avisan al momento con las mismas reglas por fila. Sin traducción por ahora.

**Borrar la cuenta.** Borra en cascada perfil, avisos aceptados, acceso y conversación.

**Cambios a la base.** Solo con migraciones en `supabase/migrations/`, probadas con pgTAP (`supabase/tests/`) contra un Supabase local, en la compu (`npm run db:probar`) y en GitHub Actions. Los ajustes de entrada que llevan secretos (Google, correo) se configuran en el panel de Supabase y no van en el repo.

## Consecuencias

- La web habla con Supabase: `connect-src` en `public/_headers` permite el dominio del proyecto. Sin sesión guardada, abrir la página no le pide nada (lo revisa `e2e/web.spec.ts`).
- Al borrar la cuenta, su sesión sigue válida hasta una hora; la app cierra la sesión enseguida y la base ya no tiene nada que mostrarle.
- El correo del administrador queda en el repo; ya es público como autor de los commits.
- El Supabase local de Stunks usa los puertos 55321 a 55329 para no chocar con otros proyectos locales.
