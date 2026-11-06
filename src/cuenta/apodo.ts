// Misma regla que la base (supabase/migrations/*_cuentas.sql): 3 a 20 letras sin acentos,
// números, guion o guion bajo. Se revisa aquí para avisar antes de mandar.
const REGLA = /^[A-Za-z0-9_-]{3,20}$/

export const apodoValido = (apodo: string) => REGLA.test(apodo)

/** Propone un apodo a partir del correo o del nombre: sin acentos, sin espacios, 3 a 20 caracteres. */
export function sugerirApodo(base: string): string {
  const limpio = base
    .split('@')[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 20)
  return limpio.length >= 3 ? limpio : ''
}
