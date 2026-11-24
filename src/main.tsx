import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// La demo pública "Real or Stunks?" es una página aparte (decisión 0014): no carga la práctica.
const RealOStunks = lazy(() => import('./demo/RealOStunks'))
const esDemo = location.pathname.replace(/\/+$/, '') === '/real-or-stunks'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {esDemo ? (
      <Suspense fallback={null}>
        <RealOStunks />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
