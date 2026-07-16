// Abschnitt (c) der Buchungsdetailseite (SPEC §5.3/§3.7): Ist-Erfassung ab
// Termin-Datum. Schreibt ausschließlich Ist-Felder (`eingesetzt`,
// `teilnehmer_ist`) sowie den Abschluss-Status `durchgefuehrt`.

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import { adminIstErfassung } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import type { Buchung, BuchungReferent, Referent } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { Lock } from 'lucide-react'

export function BuchungIstErfassung({
  buchung,
  onChanged,
  gesperrt = false,
  terminDatum,
}: {
  buchung: Buchung
  onChanged: () => void
  /** Vor dem Termin: Karte sichtbar, aber ausgegraut und deaktiviert. */
  gesperrt?: boolean
  /** Anzeige-Datum für den Freischalt-Hinweis (nur bei gesperrt). */
  terminDatum?: string
}) {
  const queryClient = useQueryClient()
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

  const referentenQuery = useQuery({
    queryKey: ['admin', 'referenten', 'aktiv'],
    queryFn: () => pb.collection('referenten').getFullList<Referent>({ filter: 'aktiv = true', sort: 'name' }),
  })

  const [teilnehmerIst, setTeilnehmerIst] = useState<string>(
    String(buchung.teilnehmer_ist ?? buchung.teilnehmer_geplant),
  )
  useEffect(() => {
    setTeilnehmerIst(String(buchung.teilnehmer_ist ?? buchung.teilnehmer_geplant))
  }, [buchung.teilnehmer_ist, buchung.teilnehmer_geplant])

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [savingTeilnehmer, setSavingTeilnehmer] = useState(false)
  const [markingDurchgefuehrt, setMarkingDurchgefuehrt] = useState(false)
  const [comboOpen, setComboOpen] = useState(false)

  function invalidateZuordnungen() {
    queryClient.invalidateQueries({ queryKey: zuordnungenKey })
  }

  async function handleToggleEingesetzt(rowId: string, next: boolean) {
    setTogglingId(rowId)
    try {
      await adminIstErfassung(buchung.id, { eingesetzt: [{ zuordnung_id: rowId, eingesetzt: next }] })
      invalidateZuordnungen()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setTogglingId(null)
    }
  }

  async function handleSaveTeilnehmerIst(statusUeberschreiben?: 'durchgefuehrt') {
    const wert = Number(teilnehmerIst)
    if (!Number.isFinite(wert) || wert < 0) {
      toast.error('Bitte eine gültige Teilnehmerzahl (Ist) angeben.')
      return
    }
    const setBusy = statusUeberschreiben ? setMarkingDurchgefuehrt : setSavingTeilnehmer
    setBusy(true)
    try {
      await adminIstErfassung(buchung.id, {
        teilnehmer_ist: wert,
        ...(statusUeberschreiben ? { durchgefuehrt: true } : {}),
      })
      toast.success(statusUeberschreiben ? 'Buchung als durchgeführt markiert.' : 'Ist-Teilnehmerzahl gespeichert.')
      onChanged()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleNiemandErschienen() {
    setMarkingDurchgefuehrt(true)
    try {
      // Niemand erschienen: teilnehmer_ist=0, alle Zuordnungen auf nicht eingesetzt,
      // Abschluss durchgeführt — alles über die feld-whitelistende Ist-Route.
      await adminIstErfassung(buchung.id, {
        teilnehmer_ist: 0,
        durchgefuehrt: true,
        eingesetzt: (zuordnungenQuery.data ?? []).map((z) => ({ zuordnung_id: z.id, eingesetzt: false })),
      })
      setTeilnehmerIst('0')
      toast.success('Als „niemand erschienen" erfasst.')
      invalidateZuordnungen()
      onChanged()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setMarkingDurchgefuehrt(false)
    }
  }

  const zuordnungen = zuordnungenQuery.data ?? []
  const zugewieseneIds = new Set(zuordnungen.map((z) => z.referent))
  const weitereReferenten = (referentenQuery.data ?? []).filter((r) => !zugewieseneIds.has(r.id))

  async function handleAddSpontan(referent: Referent) {
    setComboOpen(false)
    try {
      await adminIstErfassung(buchung.id, { spontane_vertretung: [{ referent_id: referent.id }] })
      toast.success(`${referent.name} als spontane Vertretung erfasst.`)
      invalidateZuordnungen()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Hinzufügen fehlgeschlagen.'))
    }
  }

  return (
    <Card className={cn(gesperrt && 'border-dashed')}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Ist-Erfassung</CardTitle>
          <CardDescription>
            Wer war tatsächlich im Einsatz? Wie viele Personen sind erschienen? Ab Termindatum ausfüllbar.
          </CardDescription>
        </div>
        {gesperrt && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Gesperrt
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {gesperrt && (
          <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Die Ist-Erfassung wird ab dem Termindatum{terminDatum ? ` (${terminDatum})` : ''} freigeschaltet.
              Sie ist hier bereits sichtbar, aber noch nicht ausfüllbar.
            </span>
          </div>
        )}
        <fieldset
          disabled={gesperrt}
          className={cn('m-0 min-w-0 space-y-4 border-0 p-0', gesperrt && 'pointer-events-none opacity-60')}
        >
        {zuordnungenQuery.isLoading && <Skeleton className="h-10 w-full" />}
        {!zuordnungenQuery.isLoading && zuordnungen.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine Referent:innen zugewiesen.</p>
        )}
        <ul className="space-y-2">
          {zuordnungen.map((z) => (
            <li key={z.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <Checkbox
                id={`eingesetzt-${z.id}`}
                checked={z.eingesetzt}
                disabled={togglingId === z.id}
                onCheckedChange={(v) => handleToggleEingesetzt(z.id, v === true)}
              />
              <Label htmlFor={`eingesetzt-${z.id}`} className="flex-1 cursor-pointer font-normal">
                {z.expand?.referent?.name ?? 'Unbekannt'}
                {!z.geplant && <span className="ml-2 text-xs text-muted-foreground">(nicht geplant)</span>}
              </Label>
              {togglingId === z.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
            </li>
          ))}
        </ul>

        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <UserPlus className="h-4 w-4" />
              Spontane Vertretung erfassen
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Referent:in suchen …" />
              <CommandList>
                <CommandEmpty>Keine Referent:innen gefunden.</CommandEmpty>
                <CommandGroup>
                  {weitereReferenten.map((r) => (
                    <CommandItem key={r.id} value={r.name} onSelect={() => handleAddSpontan(r)}>
                      {r.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex flex-wrap items-end gap-3 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="teilnehmer-ist">Teilnehmer:innen (Ist)</Label>
            <Input
              id="teilnehmer-ist"
              type="number"
              min={0}
              value={teilnehmerIst}
              onChange={(e) => setTeilnehmerIst(e.target.value)}
              className="w-32"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSaveTeilnehmerIst()}
            disabled={savingTeilnehmer}
          >
            {savingTeilnehmer && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Speichern
          </Button>
          {buchung.status !== 'durchgefuehrt' && (
            <>
              <Button
                type="button"
                onClick={() => handleSaveTeilnehmerIst('durchgefuehrt')}
                disabled={markingDurchgefuehrt}
              >
                {markingDurchgefuehrt && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Als durchgeführt markieren
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleNiemandErschienen}
                disabled={markingDurchgefuehrt}
              >
                Niemand erschienen
              </Button>
            </>
          )}
        </div>
        </fieldset>
      </CardContent>
    </Card>
  )
}
