// Listen-Ansicht der Buchungen (Personal): Filter (Status, Zeitraum,
// Angebotsart, Freitext) + Tabelle + Pagination. Filterzustand lebt in der URL
// der Route /admin/buchungen (validateSearch) → teilbare Links. Der Seitenkopf
// (Titel, Ansichts-Toggle, „Neue Buchung") liegt in der Route-Komponente.

import { useEffect, useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'

import { pb } from '@/lib/pocketbase'
import type { Angebotsart, Buchung, BuchungStatus } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'
import { formatDateTime } from '@/lib/admin-format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { BUCHUNGS_PRESETS, ZeitraumPicker } from '@/components/admin/shared/ZeitraumPicker'

const routeApi = getRouteApi('/admin/_authenticated/buchungen/')

const PER_PAGE = 20
const ALLE = '__alle__'

type ListenFilter = {
  status?: BuchungStatus
  angebotsart?: string
  von?: string
  bis?: string
  q?: string
  sort?: 'start' | '-start'
  page?: number
}

function buildFilter(search: ListenFilter): string {
  const parts: string[] = []
  if (search.status) parts.push(`status = "${search.status}"`)
  if (search.angebotsart) parts.push(`angebotsart = "${search.angebotsart}"`)
  if (search.von) {
    const iso = new Date(`${search.von}T00:00:00`).toISOString()
    parts.push(`start >= "${iso}"`)
  }
  if (search.bis) {
    const iso = new Date(`${search.bis}T23:59:59`).toISOString()
    parts.push(`start <= "${iso}"`)
  }
  if (search.q && search.q.trim()) {
    // Freitextsuche über Name/E-Mail/Einrichtung; pb.filter escaped den Wert.
    const term = search.q.trim()
    parts.push(
      pb.filter(
        '(kontakt_name ~ {:q} || kontakt_email ~ {:q} || herkunft_einrichtungsname ~ {:q})',
        { q: term },
      ),
    )
  }
  return parts.join(' && ')
}

export function BuchungenListe() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const page = search.page ?? 1

  const angebotsartenQuery = useQuery({
    queryKey: ['admin', 'angebotsarten', 'alle'],
    queryFn: () => pb.collection('angebotsarten').getFullList<Angebotsart>({ sort: 'sort_order' }),
  })

  const buchungenQuery = useQuery({
    // Nur listenrelevante Felder im Key — sonst refetcht die Liste beim
    // Blättern der Kalender-Ansicht (`datum`/`ansicht` gehören nicht dazu).
    queryKey: [
      'admin',
      'buchungen',
      'liste',
      search.status,
      search.angebotsart,
      search.von,
      search.bis,
      search.q,
      search.sort,
      page,
    ],
    queryFn: () =>
      pb.collection('buchungen').getList<Buchung>(page, PER_PAGE, {
        filter: buildFilter(search),
        sort: search.sort ?? '-created',
        expand: 'angebotsart,thema',
      }),
  })

  function updateSearch(patch: ListenFilter) {
    navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) })
  }

  function goToPage(next: number) {
    navigate({ search: (prev) => ({ ...prev, page: next }) })
  }

  // Freitextsuche: lokaler Eingabestand, entprellt in die URL (300 ms).
  const [suchtext, setSuchtext] = useState(search.q ?? '')
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = suchtext.trim()
      if (trimmed !== (search.q ?? '')) {
        updateSearch({ q: trimmed || undefined })
      }
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suchtext])

  // Termin-Sortierung: Klick auf die Spalte toggelt auf/absteigend; Default
  // bleibt -created (keine explizite Termin-Sortierung gesetzt).
  function toggleTerminSort() {
    const next = search.sort === '-start' ? 'start' : '-start'
    navigate({ search: (prev) => ({ ...prev, sort: next, page: 1 }) })
  }
  const terminSortIcon =
    search.sort === 'start' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : search.sort === '-start' ? (
      <ArrowDown className="h-3.5 w-3.5" />
    ) : (
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
    )

  const totalPages = buchungenQuery.data ? Math.max(1, buchungenQuery.data.totalPages) : 1

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filter-suche">Suche</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="filter-suche"
                placeholder="Name, E-Mail oder Einrichtung …"
                className="pl-8"
                value={suchtext}
                onChange={(e) => setSuchtext(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={search.status ?? ALLE}
                onValueChange={(v) => updateSearch({ status: v === ALLE ? undefined : (v as BuchungStatus) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALLE}>Alle Status</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Angebotsart</Label>
              <Select
                value={search.angebotsart ?? ALLE}
                onValueChange={(v) => updateSearch({ angebotsart: v === ALLE ? undefined : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Alle Angebotsarten" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALLE}>Alle Angebotsarten</SelectItem>
                  {(angebotsartenQuery.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="filter-zeitraum">Zeitraum</Label>
              <ZeitraumPicker
                id="filter-zeitraum"
                value={{ von: search.von, bis: search.bis }}
                onChange={(z) => updateSearch({ von: z.von, bis: z.bis })}
                presets={BUCHUNGS_PRESETS}
                clearable
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kontakt</TableHead>
                <TableHead>Angebot</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={toggleTerminSort}
                    className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:bg-accent"
                    aria-label="Nach Termin sortieren"
                  >
                    Termin
                    {terminSortIcon}
                  </button>
                </TableHead>
                <TableHead>Teiln.</TableHead>
                <TableHead>Herkunft</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buchungenQuery.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!buchungenQuery.isLoading && (buchungenQuery.data?.items.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Keine Buchungen für diese Filter gefunden.
                  </TableCell>
                </TableRow>
              )}
              {buchungenQuery.data?.items.map((buchung) => (
                <TableRow key={buchung.id} className="cursor-pointer">
                  <TableCell>
                    <Link to="/admin/buchungen/$id" params={{ id: buchung.id }} className="hover:underline">
                      <div className="font-medium">{buchung.kontakt_name}</div>
                      <div className="text-xs text-muted-foreground">{buchung.kontakt_email}</div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{buchung.expand?.angebotsart?.name ?? '–'}</div>
                    <div className="text-xs text-muted-foreground">{buchung.expand?.thema?.name ?? '–'}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(buchung.start)}</TableCell>
                  <TableCell>{buchung.teilnehmer_geplant}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {buchung.herkunft_ort || buchung.herkunft_land}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={buchung.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {buchungenQuery.data ? `${buchungenQuery.data.totalItems} Buchungen insgesamt` : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
            Zurück
          </Button>
          <span className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
            Weiter
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
