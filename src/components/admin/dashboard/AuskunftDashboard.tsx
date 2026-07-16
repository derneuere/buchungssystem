// Dashboard der Auskunftsassistenz (Schalter). Datenquelle AUSSCHLIESSLICH die
// projizierende Route GET /api/auskunft/buchungen (serverseitig auf
// bestaetigt+durchgefuehrt gefiltert, harte Feldprojektion — keine E-Mail,
// Herkunft, Nachricht, Notizen). KEINE direkten pb.collection()-Reads: die
// Rolle 'auskunft' hat darauf keine Rechte.

import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { addDays, startOfDay } from 'date-fns'
import { CalendarClock, ClipboardCheck, ClipboardList, Phone } from 'lucide-react'

import { auskunftBuchungen } from '@/lib/api'
import type { AuskunftBuchung } from '@/lib/types'
import { formatDateTime, formatTime, tagKey } from '@/lib/admin-format'
import { useJetzt } from '@/lib/use-test-mode'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'

function nachStart(a: AuskunftBuchung, b: AuskunftBuchung): number {
  return new Date(a.start).getTime() - new Date(b.start).getTime()
}

export function AuskunftDashboard() {
  const now = useJetzt()
  const morgenStart = startOfDay(addDays(now, 1))
  const in7 = addDays(now, 7)
  const heuteKey = tagKey(now)

  // Heutige Termine inkl. Referent:innen (Name+Telefon) — ein Request.
  const heuteQuery = useQuery({
    queryKey: ['admin', 'auskunft-dashboard', 'heute', heuteKey],
    queryFn: () => auskunftBuchungen({ von: heuteKey, bis: heuteKey, mit_referenten: true }),
  })

  // Basis für Offene-Ist- und Nächste-Tage-Ableitung (ohne Referenten).
  const alleQuery = useQuery({
    queryKey: ['admin', 'auskunft-dashboard', 'alle', heuteKey],
    queryFn: () => auskunftBuchungen(),
  })

  const heute = (heuteQuery.data ?? []).slice().sort(nachStart)
  const alle = alleQuery.data ?? []

  const termineHeute = heute.filter((b) => b.status === 'bestaetigt')
  const offeneIst = alle
    .filter((b) => b.status === 'bestaetigt' && new Date(b.start) < morgenStart)
    .sort(nachStart)
  const naechsteTage = alle
    .filter(
      (b) =>
        b.status === 'bestaetigt' &&
        new Date(b.start) >= morgenStart &&
        new Date(b.start) <= in7,
    )
    .sort(nachStart)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Termine für die Auskunft am Schalter — heute anstehend und noch nachzutragen.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Termine heute</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {heuteQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{termineHeute.length}</div>
            )}
            <CardDescription className="mt-1">bestätigt, heute</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Offene Ist-Erfassungen</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {alleQuery.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{offeneIst.length}</div>
            )}
            <CardDescription className="mt-1">Termine ohne Ist-Daten</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Termine heute</CardTitle>
            <CardDescription>
              Nach Uhrzeit sortiert — mit Referent:innen und Telefonnummern für den Schalter
            </CardDescription>
          </div>
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {heuteQuery.isLoading && (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          )}
          {!heuteQuery.isLoading && heute.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Heute keine Termine.</p>
          )}
          {heute.map((buchung) => (
            <div
              key={buchung.id}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/admin/buchungen/$id"
                    params={{ id: buchung.id }}
                    className="font-medium hover:underline"
                  >
                    {formatTime(buchung.start)}
                  </Link>
                  {buchung.status === 'durchgefuehrt' && <StatusBadge status="durchgefuehrt" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  {buchung.angebotsart || '–'} · {buchung.thema || '–'}
                  {buchung.raum ? ` · Raum ${buchung.raum}` : ''} · {buchung.teilnehmer_geplant} Teiln.
                </p>
                <p className="text-sm text-muted-foreground">
                  Kontakt: {buchung.kontakt_name}
                  {buchung.kontakt_telefon ? ' · ' : ''}
                  {buchung.kontakt_telefon && (
                    <a
                      href={`tel:${buchung.kontakt_telefon}`}
                      className="inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      {buchung.kontakt_telefon}
                    </a>
                  )}
                </p>
                {(buchung.referenten?.length ?? 0) > 0 && (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {buchung.referenten!.map((z) => (
                      <li key={z.zuordnung_id} className="inline-flex items-center gap-1">
                        <span className="font-medium text-foreground">{z.referent.name || 'Unbekannt'}</span>
                        {z.referent.telefon ? (
                          <a
                            href={`tel:${z.referent.telefon}`}
                            className="inline-flex items-center gap-1 underline underline-offset-2"
                          >
                            <Phone className="h-3 w-3" aria-hidden="true" />
                            {z.referent.telefon}
                          </a>
                        ) : (
                          <span className="text-xs">(keine Telefonnummer)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Link
                to="/admin/buchungen/$id"
                params={{ id: buchung.id }}
                className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Zur Buchung
              </Link>
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
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {alleQuery.isLoading && (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          )}
          {!alleQuery.isLoading && offeneIst.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Alles erfasst — keine offenen Ist-Erfassungen.
            </p>
          )}
          {offeneIst.map((buchung) => (
            <Link
              key={buchung.id}
              to="/admin/buchungen/$id"
              params={{ id: buchung.id }}
              className="flex flex-col gap-1 rounded-lg border p-3 hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {buchung.angebotsart || '–'} · {buchung.thema || '–'}
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
            <CardTitle>Nächste Tage</CardTitle>
            <CardDescription>Bestätigte Termine der nächsten 7 Tage</CardDescription>
          </div>
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {alleQuery.isLoading && (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          )}
          {!alleQuery.isLoading && naechsteTage.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine bestätigten Termine in den nächsten 7 Tagen.
            </p>
          )}
          {naechsteTage.map((buchung) => (
            <Link
              key={buchung.id}
              to="/admin/buchungen/$id"
              params={{ id: buchung.id }}
              className="flex flex-col gap-1 rounded-lg border p-3 hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {buchung.angebotsart || '–'} · {buchung.thema || '–'}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {buchung.kontakt_name} · {buchung.teilnehmer_geplant} Teiln.
                  {buchung.raum ? ` · Raum ${buchung.raum}` : ''}
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
