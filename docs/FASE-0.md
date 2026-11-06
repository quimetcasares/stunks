# Fase 0: base

Listo cuando: cada PR pasa la revisión automática y tiene vista previa, y `main` se publica sola en el dominio.

## Estado

| Paso                                  | Estado                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| Nombre                                | Stunks (antes Edge or Luck). Ver `terminos-datos.md`                                         |
| Revisión del nombre en el IMPI        | Pendiente: https://marcia.impi.gob.mx/marcas/search/quick, "STUNKS" en las clases 9, 41 y 42 |
| Términos de datos de los exchanges    | Hecho (`terminos-datos.md`, decisión 0002)                                                   |
| Proyecto en TypeScript, modo oscuro   | Hecho                                                                                        |
| Estilo, pruebas y revisión automática | Hecho: Biome, Vitest, Playwright y GitHub Actions                                            |
| Licencia y decisiones                 | Hecho: AGPL-3.0, `docs/decisiones/`                                                          |
| Repo público en GitHub                | Pendiente                                                                                    |
| Dominio                               | Pendiente. Libres el 6-nov-2026: stunks.app, .io, .trade y .gg (el .com está tomado)         |
| Publicación en Cloudflare Pages       | Pendiente                                                                                    |
| Proyecto de Supabase                  | Pendiente                                                                                    |

## Prueba técnica de datos (5-nov-2026)

Desde un Chromium en un servidor de EE.UU., día 2026-11-05 completo:

| Fuente                           | Datos          | Peticiones | Tiempo     |
| -------------------------------- | -------------- | ---------- | ---------- |
| Kraken BTC/USD, todos los trades | 218,259 trades | 219        | 3 min 50 s |
| Coinbase BTC/USD, velas de 1 min | 1,440 velas    | 5          | 1.4 s      |

Kraken permite 1 petición por segundo con 1,000 trades cada una: casi 4 minutos por día. Para la fase 2: caché en el navegador, navegar con velas de 1 minuto y bajar trades solo de la franja que se practica.

## Publicación

### Repo en GitHub

Con GitHub Desktop: File > Add local repository > la carpeta del proyecto > "create a repository" (nombre `stunks`, rama `main`, sin README ni licencia, porque ya existen) > Publish repository, sin marcar "Keep this code private".

### Cloudflare Pages

1. Workers & Pages > Create > Pages > Connect to Git, y elegir el repo `stunks`.
2. Build command: `npm run build`. Build output directory: `dist`. Variable de entorno: `NODE_VERSION` = `22`.
3. Save and Deploy. Cada PR genera su vista previa y cada cambio en `main` se publica.
4. Custom domains: agregar el dominio.
