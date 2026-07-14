import { createFileRoute, Link } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const searchSchema = z.object({ id: z.string().optional() })

export const Route = createFileRoute('/buchung/danke')({
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: DankePage,
})

function DankePage() {
  const { id } = Route.useSearch()

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader className="items-center text-center">
          <CheckCircle2 className="mb-2 h-12 w-12 text-primary" aria-hidden="true" />
          <CardTitle className="text-2xl">Vielen Dank für Ihre Anfrage</CardTitle>
          <CardDescription>
            {id ? (
              <>
                Ihre Vorgangsnummer:{' '}
                <span className="font-mono font-medium text-foreground">{id}</span>
              </>
            ) : (
              'Ihre Anfrage wurde übermittelt.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-muted-foreground">
            Wir haben Ihre Anfrage erhalten und senden Ihnen in Kürze eine Eingangsbestätigung per
            E-Mail mit einer Zusammenfassung Ihrer Angaben. Die Gedenkstätte Deutscher Widerstand
            prüft die Verfügbarkeit und meldet sich zeitnah bei Ihnen. Dies war eine unverbindliche
            Anfrage — verbindlich wird die Buchung erst nach Bestätigung durch die Gedenkstätte.
          </p>
          <Button asChild className="min-h-11">
            <Link to="/">Weitere Anfrage stellen</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
