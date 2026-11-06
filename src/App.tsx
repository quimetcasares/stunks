import { useEffect, useMemo, useState } from 'react'
import { Logo } from './components/Logo'
import { TechTest } from './components/TechTest'
import { APP, WEB } from './config'
import { enlaceAviso } from './cuenta/avisos'
import { BotonCuenta } from './cuenta/BotonCuenta'
import { CuentaProvider } from './cuenta/sesion'
import { DICTS, type Lang, LangContext, loadLang, saveLang } from './i18n'
import { Practica } from './practica/Practica'

type Vista = 'practica' | 'acerca'

export default function App() {
  const [lang, setLangState] = useState<Lang>(loadLang)
  const [vista, setVista] = useState<Vista>('practica')
  const ctx = useMemo(
    () => ({
      lang,
      t: DICTS[lang],
      setLang: (l: Lang) => {
        setLangState(l)
        saveLang(l)
        document.documentElement.lang = l
      },
    }),
    [lang],
  )
  const t = ctx.t

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return (
    <LangContext.Provider value={ctx}>
      <CuentaProvider>
        <header className="topbar">
          <div className="brand">
            <Logo size={24} />
            <span className="name">{APP.name}</span>
            <nav className="tabs" aria-label={t.sections}>
              <button
                type="button"
                className={vista === 'practica' ? 'on' : ''}
                onClick={() => setVista('practica')}
                aria-pressed={vista === 'practica'}
              >
                {t.tabPractice}
              </button>
              <button
                type="button"
                className={vista === 'acerca' ? 'on' : ''}
                onClick={() => setVista('acerca')}
                aria-pressed={vista === 'acerca'}
              >
                {t.tabAbout}
              </button>
            </nav>
          </div>
          <div className="topbar-der">
            <BotonCuenta />
            <div className="lang" role="group" aria-label="Idioma / Language">
              {(['es', 'en'] as Lang[]).map((l) => (
                <button
                  type="button"
                  key={l}
                  className={l === lang ? 'on' : ''}
                  onClick={() => ctx.setLang(l)}
                  aria-pressed={l === lang}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* La práctica se queda montada al cambiar de pestaña, para no perder el replay */}
        <main className="wrap-ancho" hidden={vista !== 'practica'}>
          <Practica />
        </main>

        <main className="wrap" hidden={vista !== 'acerca'}>
          <section className="hero">
            <h1>
              {t.titleA}
              <span className="luck">{t.titleB}</span>
            </h1>
            <p className="lead">{t.heroText}</p>
          </section>

          {/* La prueba técnica llama a Kraken y Coinbase: solo en local (docs/decisiones/0006) */}
          {!WEB && <TechTest />}

          <section className="coming" aria-labelledby="coming-title">
            <h2 id="coming-title">{t.comingTitle}</h2>
            <div className="coming-grid">
              {t.coming.map(([title, text]) => (
                <div key={title} className="coming-item">
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </section>
          <footer className="foot">
            <p>{t.disclaimer}</p>
            <p className="enlaces-legales">
              <a href={enlaceAviso('privacidad', lang)}>{t.legalTitulo.privacidad}</a>
              <a href={enlaceAviso('grabacion', lang)}>{t.legalTitulo.grabacion}</a>
              <a href="mailto:contacto@stunks.app">{t.contacto}: contacto@stunks.app</a>
            </p>
            <p className="muted">
              {t.chartsWith[0]}
              <a href="https://www.tradingview.com/lightweight-charts/">Lightweight Charts</a>
              {t.chartsWith[1]} · {APP.name} v{APP.version}
            </p>
          </footer>
        </main>
      </CuentaProvider>
    </LangContext.Provider>
  )
}
