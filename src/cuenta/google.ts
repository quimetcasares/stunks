// Botón propio de Google (Google Identity Services) para stunks.app.
// Así Google muestra "stunks.app" (y "Stunks" con la marca verificada) en lugar de la dirección de Supabase.
// En las vistas previas de cada PR se usa el flujo con redirección, porque Google no acepta orígenes con comodín.

/** Client ID web de Google; es público por diseño (el secreto vive solo en Supabase). */
const CLIENTE = '761503364679-hihqvj3kvh5dlr1e8f29b3r0nrrd7ma3.apps.googleusercontent.com'
/** Orígenes registrados en Google Cloud como "Authorized JavaScript origins". */
const ORIGENES = ['https://stunks.app']
const SCRIPT = 'https://accounts.google.com/gsi/client'

interface RespuestaGoogle {
  credential: string
}

interface GoogleId {
  accounts: {
    id: {
      initialize(opciones: {
        client_id: string
        nonce: string
        callback: (r: RespuestaGoogle) => void
        use_fedcm_for_button?: boolean
        itp_support?: boolean
      }): void
      renderButton(
        el: HTMLElement,
        opciones: {
          type: 'standard'
          theme: 'filled_black' | 'outline'
          size: 'large'
          text: 'continue_with'
          shape: 'rectangular'
          logo_alignment: 'center'
          width: number
          locale: string
        },
      ): void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleId
  }
}

export const botonPropioDeGoogle = () => ORIGENES.includes(window.location.origin)

let carga: Promise<GoogleId> | null = null

/** Carga el script de Google solo cuando hace falta (al abrir la ventana de entrar). */
function cargarGoogle(): Promise<GoogleId> {
  carga ??= new Promise<GoogleId>((listo, falla) => {
    const s = document.createElement('script')
    s.src = SCRIPT
    s.async = true
    s.onload = () => (window.google ? listo(window.google) : falla(new Error('google')))
    s.onerror = () => falla(new Error('google'))
    document.head.append(s)
  }).catch((e) => {
    carga = null
    throw e
  })
  return carga
}

/** Nonce de un solo uso: Google recibe su SHA-256 y Supabase el original, para comprobar que el token es de esta petición. */
export async function nuevoNonce(): Promise<{ crudo: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const crudo = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(crudo))
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return { crudo, hash }
}

/** Dibuja el botón de Google dentro de `el`; al elegir cuenta entrega el token y el nonce original. */
export async function pintarBotonGoogle(
  el: HTMLElement,
  idioma: string,
  alElegir: (token: string, nonce: string) => void,
): Promise<void> {
  const [google, { crudo, hash }] = await Promise.all([cargarGoogle(), nuevoNonce()])
  google.accounts.id.initialize({
    client_id: CLIENTE,
    nonce: hash,
    callback: (r) => alElegir(r.credential, crudo),
    use_fedcm_for_button: true,
    itp_support: true,
  })
  google.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'center',
    width: Math.min(400, Math.max(200, el.clientWidth)),
    locale: idioma,
  })
}
