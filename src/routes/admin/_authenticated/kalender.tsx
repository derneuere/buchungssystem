// /admin/kalender — Wochen-/Monats-Kalender der Buchungen (nur Personal).
// Ziel: überlastete Tage sichtbar machen. Die Limit-Logik spiegelt das Backend
// (service_verfuegbarkeit.go, zaehleTagesBuchungen): pro Tag zählen nur
// Buchungen mit Status angefragt/bestaetigt; das wirksame Limit je Angebotsart
// ist max_gruppen_parallel_pro_tag, sonst der Einstellungs-Default, sonst 3.
// Da die Zählung tagesweit über alle Angebotsarten läuft, die Limits aber je
// Angebotsart gelten, markieren wir zweistufig: ab dem strengsten Limit ist
// mindestens eine Angebotsart blockiert (amber), ab dem höchsten Limit sind
// alle blockiert (rot). Ansicht/Datum leben in der URL (teilbare Links),
// Tag-Schlüssel via tagKey (Browser-Lokalzeit ≈ Europe/Berlin, s. admin-format).

import { useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'

import { pb } from '@/lib/pocketbase'
import type { Angebotsart, Buchung, BuchungStatus, Einstellungen } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'
import { STATUS_BADGE_CLASS, tagKey } from '@/lib/admin-format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/admin/StatusBadge'

const kalenderSearchSchema = z.object({
  ansicht: z.enum(['monat', 'woche']).optional(),
  datum: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

type KalenderSearch = z.infer<typeof kalenderSearchSchema>

export const Route = createFileRoute('/admin/_authenticated/kalender')({
  validateSearch: (search: Record<string, unknown>) => kalenderSearchSchema.parse(search),
  component: KalenderPage,
})

/** Status, die im Backend gegen das Tageslimit zählen (zaehleTagesBuchungen). */
const ZAEHLT_FUERS_LIMIT: BuchungStatus[] = ['angefragt', 'bestaetigt']
/** Standardmäßig ausgeblendete „tote" Status (per Checkbox einblendbar). */
const INAKTIVE_STATUS: BuchungStatus[] = ['abgelehnt', 'storniert', 'verfallen']

type Auslastung = 'ok' | 'teils' | 'voll'

interface TagDaten {
  eintraege: Buchung[]
  zaehlbar: number
}

function effektivesLimit(wert: number | undefined, defaultLimit: number): number {
  if (wert && wert > 0) return wert
  if (defaultLimit > 0) return defaultLimit
  return 3
}

function auslastungFuer(zaehlbar: number, minLimit: number, maxLimit: number): Auslastung {
  if (zaehlbar >= maxLimit) return 'voll'
  if (zaehlbar >= minLimit) return 'teils'
  return 'ok'
}

function KalenderPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [inaktiveAnzeigen, setInaktiveAnzeigen] = useState(false)

  const ansicht = search.ansicht ?? 'monat'
  const anker = search.datum ? parseISO(search.datum) : new Date()

  // Sichtbarer Bereich: Monat inkl. angeschnittener Randwochen, Woche Mo–So.
  const von =
    ansicht === 'monat'
      ? startOfWeek(startOfMonth(anker), { weekStartsOn: 1 })
      : startOfWeek(anker, { weekStartsOn: 1 })
  const bis =
    ansicht === 'monat'
      ? endOfWeek(endOfMonth(anker), { weekStartsOn: 1 })
      : endOfWeek(anker, { weekStartsOn: 1 })
  const tage = eachDayOfInterval({ start: von, end: bis })

  const buchungenQuery = useQuery({
    queryKey: ['admin', 'kalender', 'buchungen', tagKey(von), tagKey(bis)],
    queryFn: () =>
      pb.collection('buchungen').getFullList<Buchung>({
        filter: `start >= "${von.toISOString()}" && start <= "${bis.toISOString()}"`,
        sort: 'start',
        expand: 'angebotsart,thema',
      }),
  })

  const angebotsartenQuery = useQuery({
    queryKey: ['admin', 'angebotsarten', 'alle'],
    queryFn: () => pb.collection('angebotsarten').getFullList<Angebotsart>({ sort: 'sort_order' }),
  })

  const einstellungenQuery = useQuery({
    queryKey: ['admin', 'kalender', 'einstellungen'],
    queryFn: async () => {
      const list = await pb.collection('einstellungen').getFullList<Einstellungen>()
      return list[0] ?? null
    },
  })

  // Strengstes und höchstes wirksames Tageslimit über alle aktiven Angebotsarten.
  const limits = useMemo(() => {
    const defaultLimit = einstellungenQuery.data?.max_gruppen_parallel_pro_tag_default ?? 0
    const werte = (angebotsartenQuery.data ?? [])
      .filter((a) => a.aktiv)
      .map((a) => effektivesLimit(a.max_gruppen_parallel_pro_tag, defaultLimit))
    if (werte.length === 0) werte.push(effektivesLimit(undefined, defaultLimit))
    return { min: Math.min(...werte), max: Math.max(...werte) }
  }, [angebotsartenQuery.data, einstellungenQuery.data])

  const proTag = useMemo(() => {
    const map = new Map<string, TagDaten>()
    for (const b of buchungenQuery.data ?? []) {
      const key = tagKey(b.start)
      const eintrag = map.get(key) ?? { eintraege: [], zaehlbar: 0 }
      eintrag.eintraege.push(b)
      if (ZAEHLT_FUERS_LIMIT.includes(b.status)) eintrag.zaehlbar++
      map.set(key, eintrag)
    }
    return map
  }, [buchungenQuery.data])

  function sichtbare(eintraege: Buchung[]): Buchung[] {
    if (inaktiveAnzeigen) return eintraege
    return eintraege.filter((b) => !INAKTIVE_STATUS.includes(b.status))
  }

  function setAnsicht(neu: 'monat' | 'woche') {
    navigate({ search: (prev: KalenderSearch) => ({ ...prev, ansicht: neu }) })
  }

  function schritt(delta: -1 | 1) {
    const next = ansicht === 'monat' ? addMonths(anker, delta) : addWeeks(anker, delta)
    navigate({ search: (prev: KalenderSearch) => ({ ...prev, datum: format(next, 'yyyy-MM-dd') }) })
  }

  function heute() {
    navigate({ search: (prev: KalenderSearch) => ({ ...prev, datum: undefined }) })
  }

  const titel =
    ansicht === 'monat'
      ? format(anker, 'MMMM yyyy', { locale: de })
      : `${format(von, 'd. MMM', { locale: de })} – ${format(bis, 'd. MMM yyyy', { locale: de })}`

  const laedt = buchungenQuery.isLoading || angebotsartenQuery.isLoading || einstellungenQuery.isLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kalender</h1>
          <p className="text-sm text-muted-foreground">
            Buchungen im Überblick; Tage am oder über dem Tageslimit sind markiert.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-1">
          <Button
            type="button"
            size="sm"
            variant={ansicht === 'woche' ? 'default' : 'ghost'}
            onClick={() => setAnsicht('woche')}
          >
            Woche
          </Button>
          <Button
            type="button"
            size="sm"
            variant={ansicht === 'monat' ? 'default' : 'ghost'}
            onClick={() => setAnsicht('monat')}
          >
            Monat
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Zurück" onClick={() => schritt(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label="Weiter" onClick={() => schritt(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={heute}>
            Heute
          </Button>
          <span className="pl-1 text-lg font-medium capitalize">{titel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="kal-inaktive"
            checked={inaktiveAnzeigen}
            onCheckedChange={(v) => setInaktiveAnzeigen(v === true)}
          />
          <Label htmlFor="kal-inaktive" className="text-sm font-normal text-muted-foreground">
            Abgelehnte/stornierte/verfallene anzeigen
          </Label>
        </div>
      </div>

      {laedt ? (
        <Skeleton className="h-[480px] w-full" />
      ) : ansicht === 'monat' ? (
        <MonatsAnsicht
          tage={tage}
          anker={anker}
          proTag={proTag}
          minLimit={limits.min}
          maxLimit={limits.max}
          sichtbare={sichtbare}
        />
      ) : (
        <WochenAnsicht
          tage={tage}
          proTag={proTag}
          minLimit={limits.min}
          maxLimit={limits.max}
          sichtbare={sichtbare}
        />
      )}

      <Legende minLimit={limits.min} maxLimit={limits.max} />
    </div>
  )
}

// ---- Monatsansicht ----------------------------------------------------------

function MonatsAnsicht({
  tage,
  anker,
  proTag,
  minLimit,
  maxLimit,
  sichtbare,
}: {
  tage: Date[]
  anker: Date
  proTag: Map<string, TagDaten>
  minLimit: number
  maxLimit: number
  sichtbare: (eintraege: Buchung[]) => Buchung[]
}) {
  const MAX_CHIPS = 3
  return (
    <Card>
      <CardContent className="overflow-x-auto p-2">
        <div className="min-w-[840px]">
          <div className="grid grid-cols-7">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
              <div key={w} className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border">
            {tage.map((tag) => {
              const key = tagKey(tag)
              const daten = proTag.get(key)
              const eintraege = sichtbare(daten?.eintraege ?? [])
              const zaehlbar = daten?.zaehlbar ?? 0
              const stufe = auslastungFuer(zaehlbar, minLimit, maxLimit)
              const imMonat = isSameMonth(tag, anker)
              return (
                <div
                  key={key}
                  className={cn(
                    'min-h-28 bg-background p-1.5',
                    !imMonat && 'bg-muted/40',
                    stufe === 'teils' && 'bg-amber-50 dark:bg-amber-950/40',
                    stufe === 'voll' && 'bg-red-50 dark:bg-red-950/40',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                        !imMonat && 'text-muted-foreground',
                        isToday(tag) && 'bg-primary font-semibold text-primary-foreground',
                      )}
                    >
                      {format(tag, 'd')}
                    </span>
                    {zaehlbar > 0 && (
                      <LimitBadge zaehlbar={zaehlbar} minLimit={minLimit} maxLimit={maxLimit} stufe={stufe} />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {eintraege.slice(0, MAX_CHIPS).map((b) => (
                      <BuchungChip key={b.id} buchung={b} />
                    ))}
                    {eintraege.length > MAX_CHIPS && (
                      <Link
                        to="/admin/buchungen"
                        search={{ von: key, bis: key }}
                        className="block px-1 text-[11px] text-muted-foreground hover:underline"
                      >
                        + {eintraege.length - MAX_CHIPS} weitere
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BuchungChip({ buchung }: { buchung: Buchung }) {
  return (
    <Link
      to="/admin/buchungen/$id"
      params={{ id: buchung.id }}
      title={`${format(parseISO(buchung.start), 'HH:mm')} Uhr · ${buchung.kontakt_name} · ${
        buchung.expand?.angebotsart?.name ?? ''
      } (${STATUS_LABEL[buchung.status]})`}
      className={cn(
        'block truncate rounded border px-1 py-0.5 text-[11px] leading-tight hover:opacity-80',
        STATUS_BADGE_CLASS[buchung.status],
      )}
    >
      <span className="font-medium tabular-nums">{format(parseISO(buchung.start), 'HH:mm')}</span>{' '}
      {buchung.kontakt_name}
    </Link>
  )
}

// ---- Wochenansicht ----------------------------------------------------------

function WochenAnsicht({
  tage,
  proTag,
  minLimit,
  maxLimit,
  sichtbare,
}: {
  tage: Date[]
  proTag: Map<string, TagDaten>
  minLimit: number
  maxLimit: number
  sichtbare: (eintraege: Buchung[]) => Buchung[]
}) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {tage.map((tag) => {
        const key = tagKey(tag)
        const daten = proTag.get(key)
        const eintraege = sichtbare(daten?.eintraege ?? [])
        const zaehlbar = daten?.zaehlbar ?? 0
        const stufe = auslastungFuer(zaehlbar, minLimit, maxLimit)
        return (
          <Card
            key={key}
            className={cn(
              'gap-2 py-3',
              stufe === 'teils' && 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40',
              stufe === 'voll' && 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40',
            )}
          >
            <div className="flex items-center justify-between gap-1 px-3">
              <div>
                <p className={cn('text-sm font-medium', isToday(tag) && 'text-primary')}>
                  {format(tag, 'EEEE', { locale: de })}
                </p>
                <p className="text-xs text-muted-foreground">{format(tag, 'd.M.yyyy')}</p>
              </div>
              {zaehlbar > 0 && (
                <LimitBadge zaehlbar={zaehlbar} minLimit={minLimit} maxLimit={maxLimit} stufe={stufe} />
              )}
            </div>
            <div className="space-y-1.5 px-3">
              {eintraege.length === 0 && <p className="text-xs text-muted-foreground">Keine Termine.</p>}
              {eintraege.map((b) => (
                <Link
                  key={b.id}
                  to="/admin/buchungen/$id"
                  params={{ id: b.id }}
                  className="block rounded-md border bg-background p-2 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium tabular-nums">
                      {format(parseISO(b.start), 'HH:mm')}–{format(parseISO(b.ende), 'HH:mm')}
                    </span>
                    <StatusBadge status={b.status} className="px-1 py-0 text-[10px]" />
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium">{b.kontakt_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.expand?.angebotsart?.name ?? '–'} · {b.teilnehmer_geplant} Teiln.
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ---- Gemeinsame Bausteine ---------------------------------------------------

function LimitBadge({
  zaehlbar,
  minLimit,
  maxLimit,
  stufe,
}: {
  zaehlbar: number
  minLimit: number
  maxLimit: number
  stufe: Auslastung
}) {
  const limitText = minLimit === maxLimit ? `${minLimit}` : `${minLimit}–${maxLimit}`
  return (
    <span
      title={`${zaehlbar} zählende Buchung(en) (angefragt/bestätigt) · Tageslimit ${limitText}`}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-medium tabular-nums',
        stufe === 'ok' && 'text-muted-foreground',
        stufe === 'teils' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        stufe === 'voll' && 'bg-red-600 text-white',
      )}
    >
      {stufe !== 'ok' && <TriangleAlert className="h-3 w-3" aria-hidden="true" />}
      {zaehlbar}/{maxLimit}
    </span>
  )
}

function Legende({ minLimit, maxLimit }: { minLimit: number; maxLimit: number }) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-medium text-foreground">Legende:</span>
        {(Object.keys(STATUS_LABEL) as BuchungStatus[]).map((s) => (
          <span key={s} className={cn('rounded border px-1.5 py-0.5', STATUS_BADGE_CLASS[s])}>
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
      <p>
        Fürs Tageslimit zählen nur angefragte und bestätigte Buchungen (wie bei der öffentlichen
        Verfügbarkeit).{' '}
        {minLimit === maxLimit
          ? `Ab ${maxLimit} Buchungen ist der Tag ausgebucht (rot).`
          : `Ab ${minLimit} Buchungen ist mindestens eine Angebotsart blockiert (gelb), ab ${maxLimit} sind alle blockiert (rot).`}
      </p>
    </div>
  )
}
