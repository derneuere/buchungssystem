// /admin/auswertungen — recharts-Dashboards mit Datumsbereichs-Filter (SPEC §5.4).
// Bewusste Vereinfachung: `reportSollIst` (src/lib/api.ts) nimmt laut Contract
// nur `{von,bis}` entgegen — die in §5.4 erwähnten Status-/Angebotsart-Filter
// für die Zeitreihe sind darüber nicht verfügbar (keine Änderung an api.ts
// laut Auftrag erlaubt).

import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format, subMonths } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { reportHerkunft, reportReferentenAuslastung, reportSollIst } from '@/lib/api'
import { bundeslandLabel } from '@/lib/admin-format'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

export const Route = createFileRoute('/admin/_authenticated/auswertungen')({
  component: AuswertungenPage,
})

type HerkunftGruppierung = 'bundesland' | 'land' | 'einrichtungstyp'
type AuslastungMetrik = 'einsaetze' | 'stunden'

function defaultVon(): string {
  return format(subMonths(new Date(), 6), 'yyyy-MM-dd')
}
function defaultBis(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

const herkunftConfig: ChartConfig = {
  teilnehmer: { label: 'Teilnehmer:innen', color: 'var(--chart-1)' },
}
const sollIstConfig: ChartConfig = {
  teilnehmer_geplant: { label: 'Geplant', color: 'var(--chart-1)' },
  teilnehmer_ist: { label: 'Ist', color: 'var(--chart-2)' },
}
const auslastungConfig: ChartConfig = {
  einsaetze: { label: 'Einsätze', color: 'var(--chart-1)' },
  stunden: { label: 'Stunden', color: 'var(--chart-1)' },
}
const zeitreiheConfig: ChartConfig = {
  buchungen: { label: 'Buchungen', color: 'var(--chart-1)' },
}

function AuswertungenPage() {
  const [von, setVon] = useState(defaultVon())
  const [bis, setBis] = useState(defaultBis())
  const [gruppierenNach, setGruppierenNach] = useState<HerkunftGruppierung>('bundesland')
  const [auslastungMetrik, setAuslastungMetrik] = useState<AuslastungMetrik>('einsaetze')

  const vonIso = useMemo(() => new Date(`${von}T00:00:00`).toISOString(), [von])
  const bisIso = useMemo(() => new Date(`${bis}T23:59:59`).toISOString(), [bis])

  const herkunftQuery = useQuery({
    queryKey: ['admin', 'reports', 'herkunft', vonIso, bisIso, gruppierenNach],
    queryFn: () => reportHerkunft({ von: vonIso, bis: bisIso, gruppieren_nach: gruppierenNach }),
  })

  const sollIstQuery = useQuery({
    queryKey: ['admin', 'reports', 'soll-ist', vonIso, bisIso],
    queryFn: () => reportSollIst({ von: vonIso, bis: bisIso }),
  })

  const auslastungQuery = useQuery({
    queryKey: ['admin', 'reports', 'referenten-auslastung', vonIso, bisIso],
    queryFn: () => reportReferentenAuslastung({ von: vonIso, bis: bisIso }),
  })

  const herkunftDaten = useMemo(
    () =>
      (herkunftQuery.data ?? [])
        .map((z) => ({
          gruppe: gruppierenNach === 'bundesland' ? bundeslandLabel(z.gruppe) : z.gruppe,
          teilnehmer: z.teilnehmer,
          anzahl: z.anzahl,
        }))
        .sort((a, b) => b.teilnehmer - a.teilnehmer),
    [herkunftQuery.data, gruppierenNach],
  )

  const auslastungDaten = useMemo(
    () =>
      [...(auslastungQuery.data ?? [])]
        .sort((a, b) => b[auslastungMetrik] - a[auslastungMetrik])
        .map((r) => ({ ...r, stunden: Math.round(r.stunden * 10) / 10 })),
    [auslastungQuery.data, auslastungMetrik],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auswertungen</h1>
        <p className="text-sm text-muted-foreground">Kennzahlen im gewählten Zeitraum.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="aw-von">Von</Label>
            <Input id="aw-von" type="date" value={von} onChange={(e) => setVon(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aw-bis">Bis</Label>
            <Input id="aw-bis" type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Besucher:innen nach Herkunft</CardTitle>
              <CardDescription>Teilnehmer:innen im Zeitraum, gruppiert</CardDescription>
            </div>
            <Select value={gruppierenNach} onValueChange={(v) => setGruppierenNach(v as HerkunftGruppierung)}>
              <SelectTrigger className="w-40 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bundesland">Bundesland</SelectItem>
                <SelectItem value="land">Land</SelectItem>
                <SelectItem value="einrichtungstyp">Einrichtungstyp</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {herkunftQuery.isLoading ? (
              <Skeleton className="aspect-video w-full" />
            ) : herkunftDaten.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={herkunftConfig}>
                <BarChart data={herkunftDaten} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="gruppe"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="teilnehmer" fill="var(--color-teilnehmer)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geplant vs. Ist</CardTitle>
            <CardDescription>
              Teilnehmer:innen je Monat
              {sollIstQuery.data
                ? ` · Referent:innen: ${sollIstQuery.data.referenten.referenten_geplant} geplant / ${sollIstQuery.data.referenten.referenten_eingesetzt} eingesetzt`
                : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sollIstQuery.isLoading ? (
              <Skeleton className="aspect-video w-full" />
            ) : (sollIstQuery.data?.teilnehmer_pro_monat.length ?? 0) === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={sollIstConfig}>
                <BarChart data={sollIstQuery.data?.teilnehmer_pro_monat} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="monat" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {/* `payload={[]}` nur zur Typerfüllung (ui/chart.tsx erwartet es laut
                      Prop-Typ als Pflichtfeld) — recharts injiziert den echten Wert zur
                      Laufzeit per `cloneElement`. */}
                  <ChartLegend content={<ChartLegendContent payload={[]} />} />
                  <Bar dataKey="teilnehmer_geplant" fill="var(--color-teilnehmer_geplant)" radius={4} />
                  <Bar dataKey="teilnehmer_ist" fill="var(--color-teilnehmer_ist)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Referent:innen-Auslastung</CardTitle>
              <CardDescription>Einsätze bzw. Stunden im Zeitraum</CardDescription>
            </div>
            <Select value={auslastungMetrik} onValueChange={(v) => setAuslastungMetrik(v as AuslastungMetrik)}>
              <SelectTrigger className="w-32 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="einsaetze">Einsätze</SelectItem>
                <SelectItem value="stunden">Stunden</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {auslastungQuery.isLoading ? (
              <Skeleton className="aspect-video w-full" />
            ) : auslastungDaten.length === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={auslastungConfig}>
                <BarChart data={auslastungDaten} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey={auslastungMetrik}
                    fill={`var(--color-${auslastungMetrik})`}
                    radius={4}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buchungen je Monat</CardTitle>
            <CardDescription>Zeitreihe über den gewählten Zeitraum</CardDescription>
          </CardHeader>
          <CardContent>
            {sollIstQuery.isLoading ? (
              <Skeleton className="aspect-video w-full" />
            ) : (sollIstQuery.data?.teilnehmer_pro_monat.length ?? 0) === 0 ? (
              <EmptyState />
            ) : (
              <ChartContainer config={zeitreiheConfig}>
                <LineChart data={sollIstQuery.data?.teilnehmer_pro_monat} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="monat" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="buchungen"
                    stroke="var(--color-buchungen)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: 'var(--color-buchungen)' }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex aspect-video w-full items-center justify-center text-sm text-muted-foreground">
      Keine Daten im gewählten Zeitraum.
    </div>
  )
}
