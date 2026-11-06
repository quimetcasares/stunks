// Botón de la barra de arriba: "Entrar" sin sesión, o el apodo con sesión.
import { type FormEvent, useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { sugerirApodo } from './apodo'
import { Dialogo } from './Dialogo'
import { type ClaveError, claveDeError, useCuenta } from './sesion'
import { type Metodos, metodosDeEntrada } from './supabase'

export function BotonCuenta() {
  const { t } = useI18n()
  const cuenta = useCuenta()
  const [abierto, setAbierto] = useState(false)
  const sinApodo = !!cuenta.sesion && !!cuenta.perfil && !cuenta.perfil.apodo

  // Al entrar por primera vez se pide el apodo.
  useEffect(() => {
    if (sinApodo) setAbierto(true)
  }, [sinApodo])

  if (!cuenta.disponible || !cuenta.listo) return null

  const etiqueta = cuenta.sesion ? (cuenta.perfil?.apodo ?? t.c.miCuenta) : t.c.entrar
  return (
    <>
      <button
        type="button"
        className={`btn ${cuenta.sesion ? 'ghost' : 'primary'} cuenta-boton`}
        onClick={() => setAbierto(true)}
        data-testid={cuenta.sesion ? 'cuenta' : 'entrar'}
      >
        {etiqueta}
      </button>
      {cuenta.sesion ? (
        <Dialogo
          abierto={abierto}
          alCerrar={() => setAbierto(false)}
          titulo={sinApodo ? t.c.bienvenidaTitulo : t.c.miCuenta}
          testid="dialogo-cuenta"
        >
          <MiCuenta bienvenida={sinApodo} alSalir={() => setAbierto(false)} />
        </Dialogo>
      ) : (
        <Dialogo abierto={abierto} alCerrar={() => setAbierto(false)} titulo={t.c.entrarTitulo} testid="dialogo-entrar">
          <Entrar />
        </Dialogo>
      )}
    </>
  )
}

function Aviso({ clave }: { clave: ClaveError | null }) {
  const { t } = useI18n()
  if (!clave) return null
  return (
    <p className="aviso-error" role="alert">
      {t.c.errores[clave]}
    </p>
  )
}

function Entrar() {
  const { t } = useI18n()
  const cuenta = useCuenta()
  const [correo, setCorreo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviadoA, setEnviadoA] = useState<string | null>(null)
  const [error, setError] = useState<ClaveError | null>(null)
  const [metodos, setMetodos] = useState<Metodos | null>(null)

  // Solo se ofrecen las formas de entrar que Supabase tiene activas.
  useEffect(() => {
    let vivo = true
    metodosDeEntrada().then((m) => vivo && setMetodos(m))
    return () => {
      vivo = false
    }
  }, [])

  async function google() {
    setError(null)
    try {
      await cuenta.entrarConGoogle()
    } catch (e) {
      setError(claveDeError(e))
    }
  }

  async function mandar(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await cuenta.mandarLink(correo)
      setEnviadoA(correo.trim())
    } catch (e) {
      setError(claveDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="dialogo-cuerpo">
      <p className="muted">{t.c.entrarIntro}</p>
      {!metodos && <p className="muted">{t.p.loading}</p>}
      {metodos?.google && (
        <button type="button" className="btn primary ancho alto" onClick={google} data-testid="google">
          {t.c.google}
        </button>
      )}
      {metodos?.google && metodos.correo && (
        <div className="separador" aria-hidden="true">
          <span>{t.c.o}</span>
        </div>
      )}
      {metodos?.correo && (
        <form className="dialogo-form" onSubmit={mandar}>
          <label className="campo">
            <span>{t.c.correo}</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              data-testid="correo"
            />
          </label>
          <button
            type="submit"
            className={`btn ${metodos.google ? 'ghost' : 'primary'} ancho alto`}
            disabled={enviando}
            data-testid="mandar-link"
          >
            {enviando ? t.c.mandando : t.c.mandarLink}
          </button>
        </form>
      )}
      {metodos && !metodos.google && !metodos.correo && <p className="aviso-error">{t.c.sinMetodos}</p>}
      {enviadoA && (
        <p className="aviso-ok" role="status" data-testid="link-enviado">
          {t.c.linkEnviado(enviadoA)}
        </p>
      )}
      <Aviso clave={error} />
      {metodos && <p className="muted chico">{metodos.google ? t.c.sinContrasenas : t.c.sinContrasenasCorreo}</p>}
    </div>
  )
}

function MiCuenta({ bienvenida, alSalir }: { bienvenida: boolean; alSalir: () => void }) {
  const { t } = useI18n()
  const cuenta = useCuenta()
  const correo = cuenta.sesion?.user.email ?? ''
  const nombre = (cuenta.sesion?.user.user_metadata?.full_name as string | undefined) ?? correo
  const [apodo, setApodo] = useState(cuenta.perfil?.apodo ?? sugerirApodo(nombre))
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<ClaveError | null>(null)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)

  async function guardar(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    setGuardado(false)
    setGuardando(true)
    try {
      await cuenta.guardarApodo(apodo.trim())
      setGuardado(true)
    } catch (e) {
      setError(claveDeError(e))
    } finally {
      setGuardando(false)
    }
  }

  async function borrar() {
    setError(null)
    try {
      await cuenta.borrarCuenta()
      alSalir()
    } catch (e) {
      setError(claveDeError(e))
    }
  }

  return (
    <div className="dialogo-cuerpo">
      {bienvenida && <p className="muted">{t.c.bienvenida}</p>}
      <div className="cuenta-quien">
        <span className="muted">{correo}</span>
        {cuenta.esAdmin && <span className="p-demo">{t.c.administrador}</span>}
      </div>

      <form className="dialogo-form" onSubmit={guardar}>
        <label className="campo">
          <span>{t.c.apodo}</span>
          <input
            type="text"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_\-]{3,20}"
            autoComplete="nickname"
            spellCheck={false}
            value={apodo}
            onChange={(e) => {
              setApodo(e.target.value)
              setGuardado(false)
            }}
            data-testid="apodo"
          />
          <small className="muted">{t.c.apodoAyuda}</small>
        </label>
        <button type="submit" className="btn primary ancho alto" disabled={guardando} data-testid="guardar-apodo">
          {t.c.guardar}
        </button>
        {guardado && (
          <p className="aviso-ok" role="status">
            {t.c.guardado}
          </p>
        )}
      </form>
      <Aviso clave={error} />

      {!bienvenida && (
        <>
          <button
            type="button"
            className="btn ghost ancho alto"
            onClick={async () => {
              await cuenta.salir()
              alSalir()
            }}
            data-testid="salir"
          >
            {t.c.salir}
          </button>

          <section className="zona-peligro" aria-label={t.c.borrarTitulo}>
            <strong>{t.c.borrarTitulo}</strong>
            <p className="muted">{t.c.borrarAviso}</p>
            {confirmarBorrar ? (
              <div className="fila-botones">
                <button type="button" className="btn ghost" onClick={() => setConfirmarBorrar(false)}>
                  {t.c.cancelar}
                </button>
                <button type="button" className="btn peligro" onClick={borrar} data-testid="confirmar-borrar">
                  {t.c.borrarConfirmar}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn ghost peligro-suave"
                onClick={() => setConfirmarBorrar(true)}
                data-testid="borrar-cuenta"
              >
                {t.c.borrar}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  )
}
