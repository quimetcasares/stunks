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
