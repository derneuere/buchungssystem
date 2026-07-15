import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { BuchungsWizard } from '@/components/booking/BuchungsWizard'
import { SpracheProvider, useSprache } from '@/lib/sprache'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const { lang } = Route.useSearch()
  const sprache = lang ?? 'de'
  return (
    <SpracheProvider sprache={sprache}>
      <Seite />
    </SpracheProvider>
  )
}

function LangSwitch() {
  const { sprache, t } = useSprache()
  const navigate = useNavigate()
  const set = (ziel: 'de' | 'en') =>
    navigate({ to: '/', search: (prev) => ({ ...prev, lang: ziel === 'en' ? 'en' : undefined }) })

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('common.langSwitch')}>
      <button
        type="button"
        onClick={() => set('de')}
        aria-pressed={sprache === 'de'}
        className={cn(
          'rounded-md px-2.5 py-1 text-sm transition-colors',
          sprache === 'de'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {t('common.langDe')}
      </button>
      <button
        type="button"
        onClick={() => set('en')}
        aria-pressed={sprache === 'en'}
        className={cn(
          'rounded-md px-2.5 py-1 text-sm transition-colors',
          sprache === 'en'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {t('common.langEn')}
      </button>
    </div>
  )
}

function Seite() {
  const { t } = useSprache()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#buchungswizard-hauptinhalt"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {t('common.skipToForm')}
      </a>

      <header className="border-b">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-4 px-4 py-6">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {t('common.institution')}
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('common.pageTitle')}</h1>
          </div>
          <div className="shrink-0 pt-1">
            <LangSwitch />
          </div>
        </div>
      </header>

      <main id="buchungswizard-hauptinhalt" className="flex-1">
        <BuchungsWizard showChrome />
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-2xl px-4 py-6 text-center text-xs text-muted-foreground sm:text-left">
          <p>{t('common.institution')}</p>
          <p className="mt-1 space-x-3">
            <a
              href="/impressum"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {t('common.foot.impressum')}
            </a>
            <a
              href="/datenschutz"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {t('common.foot.datenschutz')}
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
