import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, TriangleAlert, UserPlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { pb } from '@/lib/pocketbase'
import { adminBestaetigen, adminReferentenKandidaten, type BestaetigenWarnung } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import { cn } from '@/lib/utils'
import type { Raum, ReferentKandidat } from '@/lib/types'
import { AuslastungBadge, EignungBadge } from '@/components/admin/buchungen/ReferentKandidatBadges'

/**
 * Bestätigen-Aktion mit Kapazitäts-Handling (docs/KAPAZITAET.md §2) UND
 * Referenten-Auswahl: Beim Öffnen werden Kandidat:innen samt Auslastungs-
 * Kennzahlen (Einsätze heute/Woche/gesamt, über/unter Schnitt) geladen und als
 * Karten gezeigt. Fehlt jemand, weist man direkt hier zu (Konflikte sind
 * ausgegraut). „Bestätigen" prüft jedes Mal serverseitig neu; nur ein belegter
 * Raum blockiert hart (409), alles andere ist mit Grund überschreibbar.
 */
export function BestaetigenDialog({
  buchungId,
  benoetigtRaum,
  trigger,
  onSuccess,
}: {
  buchungId: string
  benoetigtRaum: boolean
  trigger: ReactNode
  onSuccess?: () => void
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [raumId, setRaumId] = useState('')
  const [busy, setBusy] = useState(false)
  const [warnung, setWarnung] = useState<BestaetigenWarnung | null>(null)
  const [grund, setGrund] = useState('')
  const [assigning, setAssigning] = useState<string | null>(null)

  const raeumeQuery = useQuery({
    queryKey: ['admin', 'raeume', 'aktiv'],
    queryFn: () => pb.collection('raeume').getFullList<Raum>({ filter: 'aktiv = true', sort: 'kapazitaet' }),
    enabled: open && benoetigtRaum,
  })

  const kandidatenQuery = useQuery({
    queryKey: ['admin', 'kandidaten', buchungId],
    queryFn: () => adminReferentenKandidaten(buchungId),
    enabled: open,
  })
  const kand = kandidatenQuery.data

  function reset() {
    setWarnung(null)
    setGrund('')
    setRaumId('')
  }

  async function attempt(trotzdem: boolean) {
    if (trotzdem && !grund.trim()) {
      toast.error('Bitte einen Grund angeben.')
      return
    }
    setBusy(true)
    try {
      await adminBestaetigen(buchungId, {
        raum_id: benoetigtRaum ? raumId || undefined : undefined,
        trotzdem: trotzdem || undefined,
        grund: trotzdem ? grund.trim() : undefined,
      })
      toast.success('Buchung wurde bestätigt.')
      setOpen(false)
      reset()
      onSuccess?.()
    } catch (err) {
      const e = err as { status?: number; response?: BestaetigenWarnung }
      if (e?.status === 422 && e.response?.warnung) {
        setWarnung(e.response)
      } else if (e?.status === 409) {
        toast.error(getErrorMessage(err, 'Der Raum ist zu diesem Zeitpunkt belegt. Bitte einen anderen Raum wählen.'))
      } else {
        toast.error(getErrorMessage(err, 'Bestätigen fehlgeschlagen.'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function zuweisen(k: ReferentKandidat) {
    setAssigning(k.id)
    try {
      await pb.collection('buchung_referenten').create({
        buchung: buchungId,
        referent: k.id,
        geplant: true,
        eingesetzt: false,
        quelle: 'manuell',
      })
      toast.success(`${k.name} zugewiesen.`)
      // Kandidaten (geplant/benoetigt) neu laden + Detailseite aktualisieren.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'kandidaten', buchungId] })
      await kandidatenQuery.refetch()
      queryClient.invalidateQueries({ queryKey: ['admin', 'buchung-referenten', buchungId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'buchung', buchungId] })
      // Falls eine Warnung offen war: sie bezieht sich auf einen veralteten Stand.
      setWarnung(null)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Zuweisen fehlgeschlagen.'))
    } finally {
      setAssigning(null)
    }
  }

  const geplant = kand?.geplant ?? 0
  const benoetigt = kand?.benoetigt ?? 0
  const vollBesetzt = kand ? geplant >= benoetigt : true
  const zeigeKandidaten = kandidatenQuery.isLoading || (kand && geplant < benoetigt)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buchung bestätigen</DialogTitle>
          <DialogDescription>
            {benoetigtRaum
              ? 'Dieses Angebot benötigt einen Raum. Bitte einen Raum wählen (kann auch später vergeben werden).'
              : 'Die anfragende Person erhält eine Zusage-E-Mail.'}
          </DialogDescription>
        </DialogHeader>

        {/* Besetzungs-Status */}
        {kand && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Referent:innen:</span>
            <Badge
              variant="outline"
              className={cn(
                vollBesetzt
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
              )}
            >
              {geplant} von {benoetigt} zugewiesen
            </Badge>
          </div>
        )}

        {benoetigtRaum && (
          <div className="space-y-2">
            <Label htmlFor="bestaetigen-raum">Raum</Label>
            <Select value={raumId} onValueChange={setRaumId}>
              <SelectTrigger id="bestaetigen-raum">
                <SelectValue placeholder={raeumeQuery.isLoading ? 'Lädt …' : 'Raum wählen (optional)'} />
              </SelectTrigger>
              <SelectContent>
                {(raeumeQuery.data ?? []).map((raum) => (
                  <SelectItem key={raum.id} value={raum.id}>
                    {raum.name} (Kapazität {raum.kapazitaet})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Kandidaten-Karten (bei Unterbesetzung) */}
        {zeigeKandidaten && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Referent:in auswählen</p>
            <div className="grid max-h-72 gap-2 overflow-auto pr-1 sm:grid-cols-2">
              {kandidatenQuery.isLoading &&
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
              {kand?.kandidaten.map((k) => (
                <KandidatKarte
                  key={k.id}
                  k={k}
                  assigning={assigning === k.id}
                  disabled={assigning !== null}
                  onAssign={() => void zuweisen(k)}
                />
              ))}
              {kand && kand.kandidaten.length === 0 && !kandidatenQuery.isLoading && (
                <p className="col-span-full py-4 text-center text-sm text-muted-foreground">
                  Keine aktiven Referent:innen angelegt.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              ⌀ = Durchschnitt aller Referent:innen. „Heute/Woche" bezieht sich auf den Termin dieser Buchung.
              Konflikte (Terminüberschneidung) sind ausgegraut.
            </p>
          </div>
        )}

        {/* Warnung + Grund (nur nach 422 „Trotzdem bestätigen") */}
        {warnung && (
          <>
            <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Trotz Hinweis bestätigen?</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc">
                  {warnung.unterbesetzt && (
                    <li>Es sind weniger Referent:innen zugewiesen als benötigt.</li>
                  )}
                  {warnung.raum_offen && <li>Es ist noch kein Raum vergeben.</li>}
                  {warnung.kollision && <li>Eine zugeordnete Person hat eine Terminüberschneidung.</li>}
                </ul>
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="bestaetigen-grund">Grund (Pflicht)</Label>
              <Textarea
                id="bestaetigen-grund"
                rows={2}
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                placeholder="z. B. Referent:in ist telefonisch zugesagt, Raum wird noch geklärt …"
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={() => void attempt(false)}
            disabled={busy || assigning !== null}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Bestätigen
          </Button>
          {warnung && (
            <Button
              type="button"
              onClick={() => void attempt(true)}
              disabled={busy || !grund.trim()}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Trotzdem bestätigen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KandidatKarte({
  k,
  assigning,
  disabled,
  onAssign,
}: {
  k: ReferentKandidat
  assigning: boolean
  disabled: boolean
  onAssign: () => void
}) {
  const konflikt = k.warnstufe === 'hart'
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border p-3', konflikt && 'opacity-50')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{k.name}</p>
          <div className="mt-1">
            <EignungBadge k={k} />
          </div>
        </div>
        <AuslastungBadge rel={k.auslastung_relativ} />
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/50 p-2 text-center">
        <Stat label="Heute" value={k.einsaetze_tag} />
        <Stat label="Woche" value={k.einsaetze_woche} />
        <Stat label="Gesamt" value={k.einsaetze_gesamt} />
      </div>
      {k.zugewiesen ? (
        <div className="flex items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> zugewiesen
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || konflikt}
          title={konflikt ? 'Terminüberschneidung – hier nicht zuweisbar' : undefined}
          onClick={onAssign}
        >
          {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Zuweisen
        </Button>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}
