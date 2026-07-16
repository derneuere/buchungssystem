// Abschnitt (b) der Buchungsdetailseite (SPEC §5.3): EINE Karte für die
// Referent:innen-Planung — Soll-Liste + manuelles Hinzufügen (Live-Konfliktcheck)
// und der automatische Vorschlag als kompakte Aktion oben rechts. Das
// Vorschlags-Ergebnis erscheint nur auf Klick, damit es bei bereits erfolgter
// Zuweisung nicht im Weg steht.

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronsUpDown, Loader2, Sparkles, TriangleAlert, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import { adminReferentPruefen, adminReferentenKandidaten, adminVorschlag } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import { berechneBenoetigteReferenten } from '@/lib/admin-planung'
import type {
  Angebotsart,
  Buchung,
  BuchungReferent,
  PruefeResult,
  ReferentKandidat,
  ReferentVorschlag,
  VorschlagResult,
} from '@/lib/types'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { AuslastungBadge, EignungBadge } from '@/components/admin/buchungen/ReferentKandidatBadges'

const QUELLE_LABEL: Record<string, string> = { auto: 'Automatisch', manuell: 'Manuell' }

/** Minimale zuweisbare Referenten-Kennung (Kandidat:in oder Vorschlag). */
type Zuweisbar = { id: string; name: string }

export function BuchungReferentenPlanung({ buchung }: { buchung: Buchung }) {
  const queryClient = useQueryClient()
  const angebotsart = buchung.expand?.angebotsart as Angebotsart | undefined
  const benoetigt = berechneBenoetigteReferenten(angebotsart, buchung.teilnehmer_geplant)

  const zuordnungenKey = ['admin', 'buchung-referenten', buchung.id]
  const zuordnungenQuery = useQuery({
    queryKey: zuordnungenKey,
    queryFn: () =>
      pb.collection('buchung_referenten').getFullList<BuchungReferent>({
        filter: `buchung = "${buchung.id}"`,
        expand: 'referent',
        sort: 'created',
      }),
  })

  // Kandidat:innen inkl. Auslastungs-Kennzahlen — geteilter Query-Key mit dem
  // BestaetigenDialog, damit beide Ansichten synchron bleiben.
  const kandidatenKey = ['admin', 'kandidaten', buchung.id]
  const kandidatenQuery = useQuery({
    queryKey: kandidatenKey,
    queryFn: () => adminReferentenKandidaten(buchung.id),
  })

  const zuordnungen = zuordnungenQuery.data ?? []
  const sollListe = zuordnungen.filter((z) => z.geplant)
  const zugewieseneIds = new Set(zuordnungen.map((z) => z.referent))

  const kandidaten = kandidatenQuery.data?.kandidaten ?? []
  const kandidatById = useMemo(
    () => new Map(kandidaten.map((k) => [k.id, k])),
    [kandidaten],
  )

  function invalidateZuordnungen() {
    queryClient.invalidateQueries({ queryKey: zuordnungenKey })
    // Kandidaten-Kennzahlen + Header-Badges (Unterbesetzt/Raum offen) mitziehen.
    queryClient.invalidateQueries({ queryKey: kandidatenKey })
    queryClient.invalidateQueries({ queryKey: ['admin', 'buchung', buchung.id] })
  }

  // ---- Automatischer Vorschlag ---------------------------------------------
  const [vorschlagResult, setVorschlagResult] = useState<VorschlagResult | null>(null)
  const [vorschlagLoading, setVorschlagLoading] = useState(false)
  const [uebernehmenLoading, setUebernehmenLoading] = useState(false)

  // Sobald sich die Zuordnungen ändern, ist ein zuvor berechneter Vorschlag
  // veraltet und wird verworfen (Fix: Stale Vorschlag).
  const zuordnungenSig = zuordnungen
    .map((z) => z.referent)
    .sort()
    .join(',')
  useEffect(() => {
    setVorschlagResult(null)
  }, [zuordnungenSig])

  async function handleVorschlag() {
    setVorschlagLoading(true)
    try {
      const result = await adminVorschlag(buchung.id)
      setVorschlagResult(result)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Vorschlag konnte nicht berechnet werden.'))
    } finally {
      setVorschlagLoading(false)
    }
  }

  async function handleUebernehmen() {
    if (!vorschlagResult) return
    const neue = vorschlagResult.vorschlag.filter((v) => !zugewieseneIds.has(v.id))
    if (neue.length === 0) {
      toast.info('Alle vorgeschlagenen Referent:innen sind bereits zugewiesen.')
      setVorschlagResult(null)
      return
    }
    setUebernehmenLoading(true)
    try {
      const results = await Promise.allSettled(
        neue.map((v) =>
          pb.collection('buchung_referenten').create({
            buchung: buchung.id,
            referent: v.id,
            geplant: true,
            eingesetzt: false,
            quelle: 'auto',
          }),
        ),
      )
      const erfolg = results.filter((r) => r.status === 'fulfilled').length
      const fehler = results
        .map((r, i) => ({ r, v: neue[i] }))
        .filter((x): x is { r: PromiseRejectedResult; v: ReferentVorschlag } => x.r.status === 'rejected')

      if (fehler.length === 0) {
        toast.success(`${erfolg} Referent:in(nen) übernommen.`)
        setVorschlagResult(null)
      } else {
        const ersterFehler = getErrorMessage(fehler[0].r.reason, 'Zuweisen fehlgeschlagen.')
        const namen = fehler.map((f) => f.v.name).join(', ')
        if (erfolg === 0) {
          toast.error(`Übernehmen fehlgeschlagen (${namen}): ${ersterFehler}`)
        } else {
          toast.warning(
            `${erfolg} von ${neue.length} zugewiesen, ${fehler.length} fehlgeschlagen (${namen}): ${ersterFehler}`,
          )
        }
      }
    } finally {
      setUebernehmenLoading(false)
      // Immer neu laden — auch bei Teilfehlern zeigt die UI so den echten Stand.
      invalidateZuordnungen()
    }
  }

  // ---- Entfernen ------------------------------------------------------------
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleRemove(rowId: string) {
    setRemovingId(rowId)
    try {
      await pb.collection('buchung_referenten').delete(rowId)
      toast.success('Referent:in entfernt.')
      invalidateZuordnungen()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Entfernen fehlgeschlagen.'))
    } finally {
      setRemovingId(null)
    }
  }

  // ---- Hinzufügen (Combobox + Live-Check) -----------------------------------
  const [comboOpen, setComboOpen] = useState(false)
  const [pruefLoadingId, setPruefLoadingId] = useState<string | null>(null)
  const [hartKonflikt, setHartKonflikt] = useState<{ referent: Zuweisbar; ergebnis: PruefeResult } | null>(null)

  const auswahl = useMemo(() => {
    const offen = kandidaten.filter((k) => !zugewieseneIds.has(k.id))
    const passend = offen.filter((k) => k.themaMatch)
    const andere = offen.filter((k) => !k.themaMatch)
    return { passend, andere }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kandidaten, zuordnungen])

  async function addReferent(referent: Zuweisbar, quelle: 'auto' | 'manuell' = 'manuell') {
    try {
      await pb.collection('buchung_referenten').create({
        buchung: buchung.id,
        referent: referent.id,
        geplant: true,
        eingesetzt: false,
        quelle,
      })
      toast.success(`${referent.name} zugewiesen.`)
      invalidateZuordnungen()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Zuweisen fehlgeschlagen.'))
    }
  }

  async function handleSelectKandidat(referent: Zuweisbar) {
    setComboOpen(false)
    setPruefLoadingId(referent.id)
    try {
      const ergebnis = await adminReferentPruefen(buchung.id, referent.id)
      if (ergebnis.warnstufe === 'hart') {
        setHartKonflikt({ referent, ergebnis })
        return
      }
      if (ergebnis.warnstufe === 'weich') {
        toast.warning(
          ergebnis.hinweis ?? `Hinweis: ${referent.name} ist ggf. nicht optimal geeignet (Thema/Verfügbarkeit).`,
        )
      }
      await addReferent(referent)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Prüfung fehlgeschlagen.'))
    } finally {
      setPruefLoadingId(null)
    }
  }

  const bedarfErfuellt = sollListe.length >= benoetigt
  const pruefeBusy = pruefLoadingId !== null

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Referent:innen-Planung</CardTitle>
            <CardDescription>Soll-Planung dieser Buchung</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                bedarfErfuellt
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
              )}
            >
              {sollListe.length} von {benoetigt}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleVorschlag}
              disabled={vorschlagLoading}
              title="Freie, thematisch passende Referent:innen anhand Verfügbarkeit, Auslastung und Kollisionen berechnen"
            >
              {vorschlagLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              )}
              Vorschlag
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {zuordnungenQuery.isLoading && <Skeleton className="h-10 w-full" />}
          {!zuordnungenQuery.isLoading && sollListe.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Noch keine Referent:innen zugewiesen. Nutze den Vorschlag oben rechts oder füge unten manuell hinzu.
            </p>
          )}
          <ul className="space-y-2">
            {sollListe.map((z) => (
              <li key={z.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{z.expand?.referent?.name ?? 'Unbekannt'}</span>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {QUELLE_LABEL[z.quelle] ?? z.quelle}
                  </Badge>
                  {z.eingesetzt && (
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      eingesetzt
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(z.id)}
                  disabled={removingId === z.id}
                  aria-label={`${z.expand?.referent?.name ?? 'Referent'} entfernen`}
                >
                  {removingId === z.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>

          {/* Ergebnis des automatischen Vorschlags — nur nach Klick sichtbar. */}
          {vorschlagResult && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">
                  Vorschlag · benötigt: <span className="font-medium">{vorschlagResult.benoetigt}</span>
                </p>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" onClick={handleUebernehmen} disabled={uebernehmenLoading}>
                    {uebernehmenLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Übernehmen
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setVorschlagResult(null)}
                    aria-label="Vorschlag verwerfen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Vorschlag</p>
                <div className="flex flex-wrap gap-1.5">
                  {vorschlagResult.vorschlag.length === 0 && (
                    <span className="text-sm text-muted-foreground">Keine geeigneten Referent:innen gefunden.</span>
                  )}
                  {vorschlagResult.vorschlag.map((v) => (
                    <VorschlagChip
                      key={v.id}
                      v={v}
                      kandidat={kandidatById.get(v.id)}
                      assigned={zugewieseneIds.has(v.id)}
                      loading={pruefLoadingId === v.id}
                      disabled={pruefeBusy}
                      onClick={() => void handleSelectKandidat({ id: v.id, name: v.name })}
                    />
                  ))}
                </div>
              </div>
              {vorschlagResult.alternativen.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Alternativen</p>
                  <div className="flex flex-wrap gap-1.5">
                    {vorschlagResult.alternativen.map((v) => (
                      <VorschlagChip
                        key={v.id}
                        v={v}
                        kandidat={kandidatById.get(v.id)}
                        assigned={zugewieseneIds.has(v.id)}
                        loading={pruefLoadingId === v.id}
                        disabled={pruefeBusy}
                        onClick={() => void handleSelectKandidat({ id: v.id, name: v.name })}
                      />
                    ))}
                  </div>
                </div>
              )}
              {angebotsart?.benoetigt_raum && (
                <p className="text-sm">
                  Raumvorschlag:{' '}
                  <span className="font-medium">
                    {vorschlagResult.raumVorschlag
                      ? `${vorschlagResult.raumVorschlag.name} (Kapazität ${vorschlagResult.raumVorschlag.kapazitaet})`
                      : 'kein passender Raum verfügbar'}
                  </span>
                </p>
              )}
              {vorschlagResult.warnungen.length > 0 && (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Hinweise</AlertTitle>
                  <AlertDescription>
                    <ul className="list-inside list-disc">
                      {vorschlagResult.warnungen.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-between sm:w-72"
                disabled={pruefeBusy}
              >
                Referent:in hinzufügen
                {pruefeBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command>
                <CommandInput placeholder="Referent:in suchen …" />
                <CommandList>
                  {kandidatenQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Referent:innen werden geladen …
                    </div>
                  ) : kandidatenQuery.isError ? (
                    <div className="py-6 text-center text-sm text-destructive">
                      Referent:innen konnten nicht geladen werden.
                    </div>
                  ) : (
                    <>
                      <CommandEmpty>Keine passenden Referent:innen.</CommandEmpty>
                      {auswahl.passend.length > 0 && (
                        <CommandGroup heading="Passend zum Thema">
                          {auswahl.passend.map((k) => (
                            <KandidatItem
                              key={k.id}
                              k={k}
                              loading={pruefLoadingId === k.id}
                              onSelect={() => handleSelectKandidat({ id: k.id, name: k.name })}
                            />
                          ))}
                        </CommandGroup>
                      )}
                      {auswahl.andere.length > 0 && (
                        <CommandGroup heading="Weitere Referent:innen (Thema ggf. nicht hinterlegt)">
                          {auswahl.andere.map((k) => (
                            <KandidatItem
                              key={k.id}
                              k={k}
                              loading={pruefLoadingId === k.id}
                              onSelect={() => handleSelectKandidat({ id: k.id, name: k.name })}
                            />
                          ))}
                        </CommandGroup>
                      )}
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      <AlertDialog open={!!hartKonflikt} onOpenChange={(open) => !open && setHartKonflikt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Harter Konflikt — trotzdem zuweisen?</AlertDialogTitle>
            <AlertDialogDescription>
              {hartKonflikt?.ergebnis.hinweis ??
                `${hartKonflikt?.referent.name} hat zu diesem Zeitpunkt bereits eine andere Buchung (Doppelbelegung).`}{' '}
              Die Zuweisung ist trotzdem möglich — bitte nur bei bewusster Entscheidung bestätigen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHartKonflikt(null)}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (hartKonflikt) void addReferent(hartKonflikt.referent)
                setHartKonflikt(null)
              }}
            >
              Trotzdem zuweisen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Combobox-Zeile für eine:n Kandidat:in inkl. Eignungs-/Auslastungs-Badge. */
function KandidatItem({
  k,
  loading,
  onSelect,
}: {
  k: ReferentKandidat
  loading: boolean
  onSelect: () => void
}) {
  return (
    <CommandItem value={k.name} onSelect={onSelect} className="gap-2">
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : k.themaMatch ? (
        <Check className="h-4 w-4 shrink-0 opacity-0" aria-hidden="true" />
      ) : (
        <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">{k.name}</span>
      <EignungBadge k={k} />
      <AuslastungBadge rel={k.auslastung_relativ} />
    </CommandItem>
  )
}

/** Klickbarer Chip im Vorschlags-Panel — weist mit derselben Konfliktprüfung zu. */
function VorschlagChip({
  v,
  kandidat,
  assigned,
  loading,
  disabled,
  onClick,
}: {
  v: ReferentVorschlag
  kandidat?: ReferentKandidat
  assigned: boolean
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={assigned || disabled}
      title={assigned ? 'Bereits zugewiesen' : 'Zum Zuweisen klicken (mit Konfliktprüfung)'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm transition-colors',
        assigned ? 'opacity-60' : 'hover:bg-accent',
        'disabled:cursor-not-allowed',
      )}
    >
      {assigned ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="font-medium">{v.name}</span>
      {kandidat && <EignungBadge k={kandidat} />}
      {kandidat && <AuslastungBadge rel={kandidat.auslastung_relativ} />}
      {typeof v.auslastung === 'number' && (
        <span className="text-xs text-muted-foreground">Ausl. {v.auslastung}</span>
      )}
    </button>
  )
}
