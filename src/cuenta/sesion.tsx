// Sesión y perfil de la cuenta, compartidos con toda la app.
import type { AuthError, PostgrestError, Session } from '@supabase/supabase-js'
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { apodoValido } from './apodo'
import { supabase } from './supabase'

export type ClaveError = 'apodoInvalido' | 'apodoTomado' | 'correoInvalido' | 'correoNoAutorizado' | 'limite' | 'red' | 'otro'

/** Error con clave, para mostrarlo en el idioma elegido (`c.errores` en src/i18n.ts). */
export class ErrorCuenta extends Error {
  clave: ClaveError
  constructor(clave: ClaveError) {
    super(clave)
    this.name = 'ErrorCuenta'
    this.clave = clave
  }
}

export const claveDeError = (e: unknown): ClaveError => (e instanceof ErrorCuenta ? e.clave : 'otro')

function traducir(e: AuthError | PostgrestError): ErrorCuenta {
  const codigo = 'code' in e ? e.code : undefined
  const estado = 'status' in e ? e.status : undefined
  if (codigo === '23505') return new ErrorCuenta('apodoTomado')
  if (codigo === '23514') return new ErrorCuenta('apodoInvalido')
  if (codigo === 'email_address_invalid' || codigo === 'validation_failed') return new ErrorCuenta('correoInvalido')
  if (codigo === 'email_address_not_authorized') return new ErrorCuenta('correoNoAutorizado')
  if (estado === 429 || codigo === 'over_email_send_rate_limit') return new ErrorCuenta('limite')
  if (e.message?.includes('Failed to fetch')) return new ErrorCuenta('red')
  return new ErrorCuenta('otro')
}

export interface Perfil {
  apodo: string | null
  idioma: string
}

interface Cuenta {
  /** Hay cuentas en esta versión (no en la práctica local ni en el archivo). */
  disponible: boolean
  /** Ya se revisó si había una sesión guardada. */
  listo: boolean
  sesion: Session | null
  perfil: Perfil | null
  esAdmin: boolean
  entrarConGoogle: () => Promise<void>
  mandarLink: (correo: string) => Promise<void>
  guardarApodo: (apodo: string) => Promise<void>
  salir: () => Promise<void>
  borrarCuenta: () => Promise<void>
}

const sinCuentas = async () => {
  throw new ErrorCuenta('otro')
}

const SIN_CUENTAS: Cuenta = {
  disponible: false,
  listo: true,
  sesion: null,
  perfil: null,
  esAdmin: false,
  entrarConGoogle: sinCuentas,
  mandarLink: sinCuentas,
  guardarApodo: sinCuentas,
  salir: sinCuentas,
  borrarCuenta: sinCuentas,
}

const CuentaContext = createContext<Cuenta>(SIN_CUENTAS)

export const useCuenta = () => useContext(CuentaContext)

// Vuelve a esta misma página (también en las vistas previas de cada PR).
const aqui = () => `${window.location.origin}/`

export function CuentaProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n()
  const [listo, setListo] = useState(!supabase)
  const [sesion, setSesion] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const usuarioId = sesion?.user.id ?? null

  useEffect(() => {
    if (!supabase) return
    let vivo = true
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setSesion(data.session)
      setListo(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => {
      vivo = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Perfil y rol de la cuenta que entró
  useEffect(() => {
    if (!supabase || !usuarioId) {
      setPerfil(null)
      setEsAdmin(false)
      return
    }
    let vivo = true
    Promise.all([
      supabase.from('perfiles').select('apodo, idioma').eq('id', usuarioId).maybeSingle(),
      supabase.from('administradores').select('usuario_id').eq('usuario_id', usuarioId).maybeSingle(),
    ]).then(([p, a]) => {
      if (!vivo) return
      setPerfil(p.data ?? null)
      setEsAdmin(!!a.data)
    })
    return () => {
      vivo = false
    }
  }, [usuarioId])

  // El perfil guarda el último idioma que se usó en la app
  useEffect(() => {
    if (!supabase || !usuarioId || !perfil || perfil.idioma === lang) return
    supabase
      .from('perfiles')
      .update({ idioma: lang })
      .eq('id', usuarioId)
      .then(({ error }) => {
        if (!error) setPerfil((p) => (p ? { ...p, idioma: lang } : p))
      })
  }, [usuarioId, perfil, lang])

  const cuenta = useMemo<Cuenta>(() => {
    if (!supabase) return SIN_CUENTAS
    const cliente = supabase
    return {
      disponible: true,
      listo,
      sesion,
      perfil,
      esAdmin,
      async entrarConGoogle() {
        const { error } = await cliente.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: aqui() } })
        if (error) throw traducir(error)
      },
      async mandarLink(correo: string) {
        const { error } = await cliente.auth.signInWithOtp({
          email: correo.trim(),
          options: { emailRedirectTo: aqui(), shouldCreateUser: true },
        })
        if (error) throw traducir(error)
      },
      async guardarApodo(apodo: string) {
        if (!usuarioId) throw new ErrorCuenta('otro')
        if (!apodoValido(apodo)) throw new ErrorCuenta('apodoInvalido')
        const { error } = await cliente.from('perfiles').update({ apodo }).eq('id', usuarioId)
        if (error) throw traducir(error)
        setPerfil((p) => (p ? { ...p, apodo } : { apodo, idioma: lang }))
      },
      async salir() {
        await cliente.auth.signOut({ scope: 'local' })
      },
      async borrarCuenta() {
        const { error } = await cliente.rpc('borrar_mi_cuenta')
        if (error) throw traducir(error)
        // La cuenta ya no existe; solo falta olvidar la sesión en este navegador.
        await cliente.auth.signOut({ scope: 'local' })
      },
    }
  }, [listo, sesion, perfil, esAdmin, usuarioId, lang])

  return <CuentaContext.Provider value={cuenta}>{children}</CuentaContext.Provider>
}
