// /admin/buchungen — Liste UND Kalender derselben Buchungen in einer Route:
// `ansicht=liste|monat|woche` (Default liste) schaltet die Ansicht um, alle
// Filter leben in der URL (validateSearch) → teilbare/zurücknavigierbare Links.
// Auskunft sieht immer die schlanke Auskunfts-Liste (kein Kalender-Toggle);
// die harte Grenze bleibt das Backend.

import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { Calendar, List, Plus } from 'lucide-react'

import { istAuskunft, useRolle } from '@/lib/use-rolle'
import { Button } from '@/components/ui/button'
import { BuchungenListe } from '@/components/admin/buchungen/BuchungenListe'
import { BuchungenKalender } from '@/components/admin/buchungen/BuchungenKalender'
import { AuskunftBuchungenListe } from '@/components/admin/buchungen/AuskunftBuchungenListe'

const buchungenSearchSchema = z.object({
  ansicht: z.enum(['liste', 'monat', 'woche']).optional(),
  // Listen-Ansicht:
  status: z
    .enum(['angefragt', 'warteliste', 'bestaetigt', 'abgelehnt', 'storniert', 'verfallen', 'durchgefuehrt'])
    .optional(),
  angebotsart: z.string().optional(),
  von: z.string().optional(),
  bis: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(['start', '-start']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  // Kalender-Ansicht (Anker-Datum):
  datum: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export type BuchungenSearch = z.infer<typeof buchungenSearchSchema>

export const Route = createFileRoute('/admin/_authenticated/buchungen/')({
  validateSearch: (search: Record<string, unknown>) => buchungenSearchSchema.parse(search),
  component: BuchungenPage,
})

function BuchungenPage() {
  const rolle = useRolle()
  if (istAuskunft(rolle)) {
    // Auskunft: eigener Kopf, kein Toggle — `ansicht` wird bewusst ignoriert.
    return <AuskunftBuchungenListe />
  }
  return <PersonalBuchungen />
}

function PersonalBuchungen() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const ansicht = search.ansicht ?? 'liste'
  const istListe = ansicht === 'liste'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Buchungen</h1>
          <p className="text-sm text-muted-foreground">
            {istListe
              ? 'Alle Anfragen und Buchungen filtern und durchsuchen.'
              : 'Buchungen im Überblick; Tage am oder über dem Tageslimit sind markiert.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border p-1">
            <Button
              type="button"
              size="sm"
              variant={istListe ? 'default' : 'ghost'}
              onClick={() => navigate({ search: (prev) => ({ ...prev, ansicht: undefined }) })}
            >
              <List className="h-4 w-4" />
              Liste
            </Button>
            <Button
              type="button"
              size="sm"
              variant={istListe ? 'ghost' : 'default'}
              onClick={() => navigate({ search: (prev) => ({ ...prev, ansicht: 'monat' }) })}
            >
              <Calendar className="h-4 w-4" />
              Kalender
            </Button>
          </div>
          <Button asChild>
            <Link to="/admin/buchungen/neu">
              <Plus className="h-4 w-4" />
              Neue Buchung
            </Link>
          </Button>
        </div>
      </div>

      {istListe ? <BuchungenListe /> : <BuchungenKalender />}
    </div>
  )
}
