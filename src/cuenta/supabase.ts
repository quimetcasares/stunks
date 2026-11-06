import { createClient } from '@supabase/supabase-js'
import { SUPABASE } from '../config'
import type { Database } from './tipos-db'

/**
 * Cliente de Supabase, o null donde no hay cuentas (práctica local y archivo).
 * Sin sesión guardada no hace ninguna petición al abrir la página.
 */
export const supabase = SUPABASE
  ? createClient<Database>(SUPABASE.url, SUPABASE.llave, {
      auth: {
        // El link del correo puede abrirse en otro dispositivo; el flujo implícito lo permite.
        flowType: 'implicit',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export type Cliente = NonNullable<typeof supabase>

export interface Metodos {
  google: boolean
  correo: boolean
}

/**
 * Formas de entrar que el proyecto tiene activas, para no ofrecer una que Supabase rechace.
 * Se pregunta solo al abrir la ventana de entrar. Si no responde, se ofrecen las dos y el error se avisa al usarla.
 */
export async function metodosDeEntrada(): Promise<Metodos> {
  if (!SUPABASE) return { google: false, correo: false }
  try {
    const r = await fetch(`${SUPABASE.url}/auth/v1/settings`, { headers: { apikey: SUPABASE.llave } })
    const j = (await r.json()) as { external?: Record<string, boolean> }
    return { google: !!j.external?.google, correo: !!j.external?.email }
  } catch {
    return { google: true, correo: true }
  }
}
