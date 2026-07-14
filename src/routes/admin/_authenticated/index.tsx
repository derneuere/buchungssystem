// /admin — Dashboard: KPI-Karten, „Neue Anfragen" (Schnellaktionen),
// „Nächste Termine" (7 Tage). SPEC §5.2.

import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, endOfWeek, startOfWeek } from 'date-fns'
import { CalendarClock, ClipboardList, Gauge, Inbox } from 'lucide-react'

import { pb } from '@/lib/pocketbase'
import type { Buchung, Einstellungen } from '@/lib/types'
import { formatDateTime } from '@/lib/admin-format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { BestaetigenDialog } from '@/components/admin/BestaetigenDialog'
import { AblehnenDialog } from '@/components/admin/AblehnenDialog'

export const Route = createFileRoute('/admin/_authenticated/')({
  component: DashboardPage,
})

function DashboardPage() {
  const queryClient = useQueryClient()

  const neueAnfragenQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'neue-anfragen'],
    queryFn: () =>
      pb.collection('buchungen').getList<Buchung>(1, 8, {
        filter: 'status = "angefragt"',
        sort: 'created',
        expand: 'angebotsart,thema',
      }),
  })

  const now = new Date()
  const in7 = addDays(now, 7)
  const naechsteTermineQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'naechste-termine'],
    queryFn: () =>
      pb.collection('buchungen').getList<Buchung>(1, 8, {
        filter: `status = "bestaetigt" && start >= "${now.toISOString()}" && start <= "${in7.toISOString()}"`,
        sort: 'start',
        expand: 'angebotsart,thema,raum',
      }),
  })

  const wochenStart = startOfWeek(now, { weekStartsOn: 1 })
  const wochenEnde = endOfWeek(now, { weekStartsOn: 1 })
  const auslastungQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'auslastung-woche'],
    queryFn: async () => {
      const [einstellungenListe, buchungenWoche] = await Promise.all([
        pb.collection('einstellungen').getFullList<Einstellungen>(),
        pb.collection('buchungen').getList<Buchung>(1, 1, {
          filter: `start >= "${wochenStart.toISOString()}" && start <= "${wochenEnde.toISOString()}" && (status = "angefragt" || status = "bestaetigt" || status = "durchgefuehrt")`,
        }),
      ])
      const einstellungen = einstellungenListe[0]
      const oeffnungstageAnzahl = einstellungen?.oeffnungstage?.length ?? 5
      const parallelLimit = einstellungen?.max_gruppen_parallel_pro_tag_default ?? 3
      const kapazitaet = oeffnungstageAnzahl * parallelLimit
      const belegt = buchungenWoche.totalItems
      const prozent = kapazitaet > 0 ? Math.min(100, Math.round((belegt / kapazitaet) * 100)) : 0
      return { belegt, kapazitaet, prozent }
    },
  })

  function invalidateDashboard() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Überblick über offene Anfragen und anstehende Termine.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Offene Anfragen</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {neueAnfragenQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{neueAnfragenQuery.data?.totalItems ?? 0}</div>
            )}
            <CardDescription className="mt-1">warten auf Bearbeitung</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kommende Termine</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {naechsteTermineQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{naechsteTermineQuery.data?.totalItems ?? 0}</div>
            )}
            <CardDescription className="mt-1">bestätigt, nächste 7 Tage</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Auslastung diese Woche</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {auslastungQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{auslastungQuery.data?.prozent ?? 0}%</div>
            )}
            <CardDescription className="mt-1">
              {auslastungQuery.data
                ? `${auslastungQuery.data.belegt} von ca. ${auslastungQuery.data.kapazitaet} möglichen Terminslots`
                : 'wird berechnet …'}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Neue Anfragen</CardTitle>
            <CardDescription>Status „Angefragt" — noch nicht bearbeitet</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/buchungen" search={{ status: 'angefragt' }}>
              Alle ansehen
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {neueAnfragenQuery.isLoading && (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          )}
          {!neueAnfragenQuery.isLoading && (neueAnfragenQuery.data?.items.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Keine offenen Anfragen.</p>
          )}
          {neueAnfragenQuery.data?.items.map((buchung) => (
            <div
              key={buchung.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/admin/buchungen/$id"
                    params={{ id: buchung.id }}
                    className="font-medium hover:underline"
                  >
                    {buchung.kontakt_name}
                  </Link>
                  <StatusBadge status={buchung.status} />
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {buchung.expand?.angebotsart?.name ?? '–'} · {buchung.expand?.thema?.name ?? '–'} ·{' '}
                  {formatDateTime(buchung.start)} · {buchung.teilnehmer_geplant} Teiln.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <BestaetigenDialog
                  buchungId={buchung.id}
                  benoetigtRaum={buchung.expand?.angebotsart?.benoetigt_raum ?? false}
                  trigger={
                    <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
                      Bestätigen
                    </Button>
                  }
                  onSuccess={invalidateDashboard}
                />
                <AblehnenDialog
                  buchungId={buchung.id}
                  trigger={
                    <Button size="sm" variant="outline">
                      Ablehnen
                    </Button>
                  }
                  onSuccess={invalidateDashboard}
                />
                <Button asChild size="sm" variant="ghost">
                  <Link to="/admin/buchungen/$id" params={{ id: buchung.id }}>
                    Details
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Nächste Termine</CardTitle>
            <CardDescription>Bestätigte Buchungen der nächsten 7 Tage</CardDescription>
          </div>
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {naechsteTermineQuery.isLoading && (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          )}
          {!naechsteTermineQuery.isLoading && (naechsteTermineQuery.data?.items.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine bestätigten Termine in den nächsten 7 Tagen.
            </p>
          )}
          {naechsteTermineQuery.data?.items.map((buchung) => (
            <Link
              key={buchung.id}
              to="/admin/buchungen/$id"
              params={{ id: buchung.id }}
              className="flex flex-col gap-1 rounded-lg border p-3 hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {buchung.expand?.angebotsart?.name ?? '–'} · {buchung.expand?.thema?.name ?? '–'}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {buchung.kontakt_name} · {buchung.teilnehmer_geplant} Teiln.
                  {buchung.expand?.raum ? ` · Raum ${buchung.expand.raum.name}` : ''}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium">{formatDateTime(buchung.start)}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
