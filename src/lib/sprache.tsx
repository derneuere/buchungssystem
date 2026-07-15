// Sprach-Provider/Hook für die ÖFFENTLICHE Buchungsstrecke. Wird pro
// öffentlicher Route (index/embed/danke) eingehängt und liefert `t()`
// (Übersetzung + Platzhalter), die aktive `sprache` sowie die passende
// date-fns-Locale. Das Admin-Panel konsumiert diesen Provider nicht.

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { de, enUS } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import { woerterbuch, type Sprache } from './i18n'

export type TFunc = (key: string, params?: Record<string, string | number>) => string

type SpracheContextValue = {
  sprache: Sprache
  locale: Locale
  t: TFunc
}

const Ctx = createContext<SpracheContextValue | null>(null)

export function SpracheProvider({
  sprache,
  children,
}: {
  sprache: Sprache
  children: ReactNode
}) {
  const value = useMemo<SpracheContextValue>(() => {
    const locale = sprache === 'en' ? enUS : de
    const t: TFunc = (key, params) => {
      const raw = woerterbuch[sprache][key] ?? woerterbuch.de[key] ?? key
      return params
        ? raw.replace(/\{(\w+)\}/g, (_, k) =>
            params[k] != null ? String(params[k]) : `{${k}}`,
          )
        : raw
    }
    return { sprache, locale, t }
  }, [sprache])

  useEffect(() => {
    document.documentElement.lang = sprache
  }, [sprache])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSprache() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSprache must be used within SpracheProvider')
  return ctx
}
