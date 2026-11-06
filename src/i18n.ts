import { createContext, useContext } from 'react'

export type Lang = 'es' | 'en'

const es = {
  tagline: '¿Tienes ventaja o fue suerte?',
  heroText:
    'Practica trading con replay: cae en cualquier fecha y hora, córrelo de 1x a 100x, opera con reglas de prop o con tu propio saldo, y al final te dice si tienes ventaja o si fue suerte.',
  building: 'En construcción',
  phase: 'Fase',
  testTitle: 'Prueba técnica',
  testIntro: 'Tu navegador le pide los datos directo al exchange. No pasan por nuestros servidores ni se guardan en ellos.',
  source: 'Fuente',
  krakenTrades: 'Kraken · todos los trades',
  coinbaseCandles: 'Coinbase · velas de 1 min',
  market: 'Mercado',
  dayUtc: 'Día (UTC)',
  download: 'Bajar el día',
  cancel: 'Cancelar',
  downloading: 'Bajando…',
  waitingLimit: 'Esperando por el límite del exchange…',
  requests: 'Peticiones',
  trades: 'trades',
  candles: 'velas de 1 min',
  in: 'en',
  speed: 'Velocidad',
  perSec: '/s',
  memory: 'Memoria',
  open: 'Apertura',
  high: 'Máximo',
  low: 'Mínimo',
  close: 'Cierre',
  volume: 'Volumen',
  aggressiveBuys: 'Compras agresivas',
  firstLast: 'Primero / último',
  dayIncomplete: 'El día todavía no termina: son los datos hasta ahorita.',
  passed: 'Prueba de la fase 0 superada: el navegador baja un día completo de trades.',
  cancelled: 'Cancelado.',
  error: 'Error',
  noData: 'No llegaron datos para ese día.',
  history: 'Corridas de esta sesión',
  colSource: 'Fuente',
  colDay: 'Día',
  colItems: 'Datos',
  colTime: 'Tiempo',
  colReq: 'Peticiones',
  comingTitle: 'Lo que viene',
  coming: [
    ['Replay 1x a 100x', 'Cualquier fecha y hora, vela por vela o a toda velocidad.'],
    ['Marcador contra el volado', 'Tu resultado contra la misma jugada al revés.'],
    ['Cuenta prop', 'Pérdida máxima, límite diario y hora de cierre, como en la evaluación.'],
    ['Trae tus datos', 'Carga tus propios archivos; se quedan en tu navegador.'],
  ] as [string, string][],
  disclaimer:
    'Simulador educativo. No es asesoría de inversión ni da señales. Los resultados simulados no garantizan resultados reales.',
  dataNote: 'Datos de mercado pedidos por tu navegador directo a cada exchange.',
}

type Dict = typeof es

const en: Dict = {
  tagline: 'Do you have an edge, or was it luck?',
  heroText:
    'Practice trading with replay: jump to any date and time, run it from 1x to 100x, trade with prop-firm rules or your own balance, and see whether you have an edge or just got lucky.',
  building: 'Under construction',
  phase: 'Phase',
  testTitle: 'Technical test',
  testIntro: 'Your browser requests the data straight from the exchange. It never goes through or gets stored on our servers.',
  source: 'Source',
  krakenTrades: 'Kraken · every trade',
  coinbaseCandles: 'Coinbase · 1-min candles',
  market: 'Market',
  dayUtc: 'Day (UTC)',
  download: 'Download the day',
  cancel: 'Cancel',
  downloading: 'Downloading…',
  waitingLimit: 'Waiting for the exchange rate limit…',
  requests: 'Requests',
  trades: 'trades',
  candles: '1-min candles',
  in: 'in',
  speed: 'Speed',
  perSec: '/s',
  memory: 'Memory',
  open: 'Open',
  high: 'High',
  low: 'Low',
  close: 'Close',
  volume: 'Volume',
  aggressiveBuys: 'Aggressive buys',
  firstLast: 'First / last',
  dayIncomplete: "The day isn't over yet: this is the data so far.",
  passed: 'Phase 0 test passed: the browser downloads a full day of trades.',
  cancelled: 'Cancelled.',
  error: 'Error',
  noData: 'No data came back for that day.',
  history: 'Runs this session',
  colSource: 'Source',
  colDay: 'Day',
  colItems: 'Data',
  colTime: 'Time',
  colReq: 'Requests',
  comingTitle: "What's coming",
  coming: [
    ['Replay 1x to 100x', 'Any date and time, bar by bar or full speed.'],
    ['Score vs. a coin flip', 'Your result against the same trade taken the other way.'],
    ['Prop account', 'Trailing drawdown, daily loss limit and close time, like the evaluation.'],
    ['Bring your data', 'Load your own files; they stay in your browser.'],
  ],
  disclaimer: 'Educational simulator. Not investment advice and no signals. Simulated results do not guarantee real results.',
  dataNote: 'Market data requested by your browser directly from each exchange.',
}

export const DICTS: Record<Lang, Dict> = { es, en }

export const LangContext = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({
  lang: 'es',
  t: es,
  setLang: () => {},
})

export const useI18n = () => useContext(LangContext)

export function loadLang(): Lang {
  try {
    const saved = localStorage.getItem('eol.lang')
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    /* sin almacenamiento: usamos el idioma del navegador */
  }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem('eol.lang', lang)
  } catch {
    /* no pasa nada */
  }
}
