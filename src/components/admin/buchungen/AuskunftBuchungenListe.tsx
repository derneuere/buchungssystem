// Schlanke Auskunfts-Liste: serverseitig auf bestätigt/durchgeführt gefiltert und
// auf die erlaubten Felder projiziert (keine E-Mail, keine Herkunft, kein
// Statusfilter). Datenquelle: GET /api/auskunft/buchungen. Rendert einen eigenen
// Seitenkopf — die Auskunft sieht weder Ansichts-Toggle noch „Neue Buchung".

import { getRouteApi, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import type { AuskunftBuchung } from '@/lib/types'
import { auskunftBuchungen } from '@/lib/api'
import { formatDateTime } from '@/lib/admin-format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { BUCHUNGS_PRESETS, ZeitraumPicker } from '@/components/admin/shared/ZeitraumPicker'

const routeApi = getRouteApi('/admin/_authenticated/buchungen/')

export function AuskunftBuchungenListe() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()

  const query = useQuery({
    queryKey: ['admin', 'auskunft', 'buchungen', search.von, search.bis],
    queryFn: () => auskunftBuchungen({ von: search.von, bis: search.bis }),
  })

  function updateZeitraum(z: { von?: string; bis?: string }) {
    navigate({ search: (prev) => ({ ...prev, von: z.von, bis: z.bis, page: 1 }) })
  }

  const items = query.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buchungen</h1>
        <p className="text-sm text-muted-foreground">
          Bestätigte und durchgeführte Termine für die Auskunft am Schalter.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zeitraum</CardTitle>
        </CardHeader>
        <CardContent>
          <ZeitraumPicker
            id="auskunft-zeitraum"
            value={{ von: search.von, bis: search.bis }}
            onChange={updateZeitraum}
            presets={BUCHUNGS_PRESETS}
            clearable
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kontakt</TableHead>
                <TableHead>Angebot</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead>Teiln.</TableHead>
                <TableHead>Raum</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!query.isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Keine bestätigten oder durchgeführten Termine im Zeitraum.
                  </TableCell>
                </TableRow>
              )}
              {items.map((b: AuskunftBuchung) => (
                <TableRow key={b.id} className="cursor-pointer">
                  <TableCell>
                    <Link to="/admin/buchungen/$id" params={{ id: b.id }} className="hover:underline">
                      <div className="font-medium">{b.kontakt_name}</div>
                      <div className="text-xs text-muted-foreground">{b.kontakt_telefon || '–'}</div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{b.angebotsart || '–'}</div>
                    <div className="text-xs text-muted-foreground">{b.thema || '–'}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(b.start)}</TableCell>
                  <TableCell>{b.teilnehmer_geplant}</TableCell>
                  <TableCell className="whitespace-nowrap">{b.raum || '–'}</TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {query.data ? `${items.length} Termine im Zeitraum` : ''}
      </p>
    </div>
  )
}
