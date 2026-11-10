// Versiones vigentes de los avisos (public/privacidad.html y public/grabacion.html).
// Al cambiar un aviso se sube su versión aquí y en la página, y la app vuelve a pedir aceptarlo.
export const AVISOS = {
  privacidad: '2026-11-10',
  grabacion: '2026-11-09',
} as const

export type Documento = keyof typeof AVISOS

const RUTA: Record<Documento, string> = {
  privacidad: '/privacidad',
  grabacion: '/grabacion',
}

/** Enlace al aviso en el idioma de la app (la versión en inglés está en #en de la misma página). */
export const enlaceAviso = (documento: Documento, lang: string) => `${RUTA[documento]}${lang === 'en' ? '#en' : ''}`

/** Qué avisos vigentes faltan, a partir de lo que la cuenta ya aceptó. */
export function avisosPendientes(aceptados: { documento: string; version: string }[]): Documento[] {
  return (Object.keys(AVISOS) as Documento[]).filter((d) => !aceptados.some((a) => a.documento === d && a.version === AVISOS[d]))
}
