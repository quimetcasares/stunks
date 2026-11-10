# 0009 · Avisos de privacidad y de grabación

**Estado:** vigente; la grabación llega con el Reto diario (F4), no con la F5 · **Fecha:** 2026-11-06

## Contexto

Con las cuentas ([0008](0008-cuentas.md)) Stunks guarda datos personales: correo, nombre y foto de Google, apodo, mensajes y la solicitud de acceso al NQ. Más adelante (F5) también grabará lo que cada cuenta hace en la práctica. La ley mexicana de protección de datos personales pide un aviso de privacidad, y Google pide su dirección para publicar la app y verificar la marca.

## Decisión

- **Dos avisos en páginas sueltas**, sin JavaScript para que siempre carguen: `/privacidad` (`public/privacidad.html`) y `/grabacion` (`public/grabacion.html`). Están en español con traducción al inglés en la misma página (`#en`); manda el español.
- **Responsable:** "Stunks", con domicilio en Ciudad de México, México. Contacto: `contacto@stunks.app`, que Cloudflare Email Routing reenvía al administrador.
- **Aceptar para usar la cuenta.** Al entrar por primera vez se piden el apodo y los dos avisos, cada uno con su enlace. Se guarda una fila por versión aceptada en `consentimientos`. Las versiones vigentes viven en `src/cuenta/avisos.ts`; al cambiar un aviso se sube su versión ahí y en la página, y la app vuelve a pedirlo.
- **Quien no acepte** puede salir o borrar su cuenta desde la misma ventana. La práctica sin cuenta sigue igual y no graba nada.
- **Grabación desde la F5.** El aviso ya explica qué se graba y qué no, para no pedirlo de nuevo cuando empiece.
- **Visitas:** Cloudflare Web Analytics, sin cookies. `public/_headers` permite solo su script y su reporte.

## Consecuencias

- Google puede verificar la marca con `https://stunks.app` y `https://stunks.app/privacidad`, y mostrar "Stunks" al entrar con Google.
- Cada cambio de los avisos es un PR: texto, versión nueva y la app lo vuelve a pedir.
- Antes del lanzamiento público (F8) conviene que alguien con conocimiento de la ley de protección de datos revise los dos avisos. Si hace falta nombrar a una persona física o moral como responsable, se actualiza el aviso y su versión.
