// /admin — Dashboard: KPI-Karten, „Neue Anfragen" (Schnellaktionen),
// „Nächste Termine" (7 Tage). SPEC §5.2.

import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, endOfWeek, startOfDay, startOfWeek } from 'date-fns'
import { CalendarClock, ClipboardCheck, ClipboardList, Gauge, Inbox } from 'lucide-react'

import { pb } from '@/lib/pocketbase'
import type { Buchung, Einstellungen } from '@/lib/types'
import { formatDateTime, tagKey } from '@/lib/admin-format'
import { useJetzt } from '@/lib/use-test-mode'
import { istAuskunft, useRolle } from '@/lib/use-rolle'
import { AuskunftDashboard } from '@/components/admin/dashboard/AuskunftDashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { BestaetigenDialog } from '@/components/admin/buchungen/BestaetigenDialog'
import { AblehnenDialog } from '@/components/admin/buchungen/AblehnenDialog'

export const Route = createFileRoute('/admin/_authenticated/')({
  component: DashboardPage,
})

function DashboardPage() {
  const rolle = useRolle()
  if (istAuskunft(rolle)) {
    return <AuskunftDashboard />
  }
  return <PersonalDashboard />
}

function PersonalDashboard() {
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

  const now = useJetzt()
  const in7 = addDays(now, 7)
  const naechsteTermineQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'naechste-termine', tagKey(now)],
    queryFn: () =>
      pb.collection('buchungen').getList<Buchung>(1, 8, {
        filter: `status = "bestaetigt" && start >= "${now.toISOString()}" && start <= "${in7.toISOString()}"`,
        sort: 'start',
        expand: 'angebotsart,thema,raum',
      }),
  })

  // Offene Ist-Erfassungen: bestätigte Buchungen, deren Termin-TAG erreicht oder
  // vorbei ist (Freischaltung ist tagesbasiert), die aber noch nicht als
  // „durchgeführt" erfasst wurden.
  const morgenStart = startOfDay(addDays(now, 1))
  const offeneIstQuery = useQuery({
    queryKey: ['admin', 'dashboard', 'offene-ist', tagKey(now)],
    queryFn: () =>
      pb.collection('buchungen').getList<Buchung>(1, 8, {
        filter: `status = "bestaetigt" && start < "${morgenStart.toISOString()}"`,
        sort: 'start',
        expand: 'angebotsart,thema',
      }),
  })

  const wochenStart = startOfWeek(now, { weekStartsOn: 1 })
  const wochenEnde = endOfWeek(now, { weekStartsOn: 1 })
  const auslastungQuery = useQuery({
    // Wochenschlüssel (Montag der aktuellen Woche) hält die Kennzahl im
    // Testmodus mit simuliertem „Jetzt" aktuell.
    queryKey: ['admin', 'dashboard', 'auslastung-woche', tagKey(wochenStart)],
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                ? `${auslastungQuery.data.belegt} von ca. ${auslastungQuery.data.kapazitaet} Terminslots · zählt angefragte + bestätigte Buchungen`
                : 'wird berechnet …'}
            </CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ist-Erfassung offen</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {offeneIstQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{offeneIstQuery.data?.totalItems ?? 0}</div>
            )}
            <CardDescription className="mt-1">Termine ohne Ist-Daten</CardDescription>
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
            <CardTitle>Offene Ist-Erfassungen</CardTitle>
            <CardDescription>Bestätigte Termine ab Termintag ohne erfasste Ist-Daten — bitte nachtragen</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/buchungen" search={{ status: 'bestaetigt' }}>
              Alle ansehen
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {offeneIstQuery.isLoading && (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          )}
          {!offeneIstQuery.isLoading && (offeneIstQuery.data?.items.length ?? 0) === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Alles erfasst — keine offenen Ist-Erfassungen.
            </p>
          )}
          {offeneIstQuery.data?.items.map((buchung) => (
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
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDateTime(buchung.start)}
              </span>
            </Link>
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
