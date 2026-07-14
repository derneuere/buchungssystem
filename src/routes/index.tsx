import { createFileRoute } from '@tanstack/react-router'
import { BuchungsWizard } from '@/components/booking/BuchungsWizard'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#buchungswizard-hauptinhalt"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Zum Formular springen
      </a>

      <header className="border-b">
        <div className="mx-auto flex max-w-2xl flex-col gap-1 px-4 py-6 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Gedenkstätte Deutscher Widerstand
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Führung oder Seminar anfragen
          </h1>
        </div>
      </header>

      <main id="buchungswizard-hauptinhalt" className="flex-1">
        <BuchungsWizard showChrome />
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-2xl px-4 py-6 text-center text-xs text-muted-foreground sm:text-left">
          <p>Gedenkstätte Deutscher Widerstand</p>
          <p className="mt-1 space-x-3">
            <a
              href="/impressum"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Impressum
            </a>
            <a
              href="/datenschutz"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Datenschutz
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
