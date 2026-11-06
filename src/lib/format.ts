import type { Lang } from '../i18n'

const locale = (lang: Lang) => (lang === 'es' ? 'es-MX' : 'en-US')

export const fmtInt = (n: number, lang: Lang) => Math.round(n).toLocaleString(locale(lang))

export const fmtNum = (n: number, lang: Lang, digits = 2) =>
  n.toLocaleString(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits })

export function fmtSeconds(ms: number, lang: Lang) {
  const s = ms / 1000
  if (s < 60) return `${fmtNum(s, lang, 1)} s`
  const m = Math.floor(s / 60)
  return `${m} min ${Math.round(s - m * 60)} s`
}

export function fmtMB(bytes: number, lang: Lang) {
  return `${fmtNum(bytes / 1_048_576, lang, 1)} MB`
}

/** "13:05:22" en UTC */
export function fmtTimeUtc(ms: number) {
  return new Date(ms).toISOString().slice(11, 19)
}

/** "2026-11-04" en UTC */
export function isoDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function dayStartUtc(isoDate: string) {
  return Date.parse(`${isoDate}T00:00:00Z`)
}
