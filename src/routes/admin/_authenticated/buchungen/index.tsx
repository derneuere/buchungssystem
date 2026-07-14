// /admin/buchungen — Liste mit Filtern (Status, Zeitraum, Angebotsart) + Pagination.
// Filterzustand lebt in der URL (validateSearch) → teilbare/zurücknavigierbare Links.

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
import { StatusBadge } from '@/components/admin/StatusBadge'

const buchungenSearchSchema = z.object({
  status: z
    .enum(['angefragt', 'warteliste', 'bestaetigt', 'abgelehnt', 'storniert', 'verfallen', 'durchgefuehrt'])
    .optional(),
  angebotsart: z.string().optional(),
  von: z.string().optional(),
  bis: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export type BuchungenSearch = z.infer<typeof buchungenSearchSchema>

export const Route = createFileRoute('/admin/_authenticated/buchungen/')({
  validateSearch: (search: Record<string, unknown>) => buchungenSearchSchema.parse(search),
  component: BuchungenListPage,
})

const PER_PAGE = 20
const ALLE = '__alle__'

function buildFilter(search: BuchungenSearch): string {
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
  return parts.join(' && ')
}

function BuchungenListPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const page = search.page ?? 1

  const angebotsartenQuery = useQuery({
    queryKey: ['admin', 'angebotsarten', 'alle'],
    queryFn: () => pb.collection('angebotsarten').getFullList<Angebotsart>({ sort: 'sort_order' }),
  })

  const buchungenQuery = useQuery({
    queryKey: ['admin', 'buchungen', 'liste', search],
    queryFn: () =>
      pb.collection('buchungen').getList<Buchung>(page, PER_PAGE, {
        filter: buildFilter(search),
        sort: '-created',
        expand: 'angebotsart,thema',
      }),
  })

  function updateSearch(patch: Partial<BuchungenSearch>) {
    navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) })
  }

  function goToPage(next: number) {
    navigate({ search: (prev) => ({ ...prev, page: next }) })
  }

  const totalPages = buchungenQuery.data ? Math.max(1, buchungenQuery.data.totalPages) : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buchungen</h1>
        <p className="text-sm text-muted-foreground">Alle Anfragen und Buchungen filtern und durchsuchen.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-2">
              <Label htmlFor="filter-von">Zeitraum von</Label>
              <Input
                id="filter-von"
                type="date"
                value={search.von ?? ''}
                onChange={(e) => updateSearch({ von: e.target.value || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-bis">Zeitraum bis</Label>
              <Input
                id="filter-bis"
                type="date"
                value={search.bis ?? ''}
                onChange={(e) => updateSearch({ bis: e.target.value || undefined })}
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
                <TableHead>Termin</TableHead>
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
