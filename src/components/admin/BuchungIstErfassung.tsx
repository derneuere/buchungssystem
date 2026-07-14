// Abschnitt (c) der Buchungsdetailseite (SPEC §5.3/§3.7): Ist-Erfassung ab
// Termin-Datum. Schreibt ausschließlich Ist-Felder (`eingesetzt`,
// `teilnehmer_ist`) sowie den Abschluss-Status `durchgefuehrt`.

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
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

export function BuchungIstErfassung({
  buchung,
  onChanged,
}: {
  buchung: Buchung
  onChanged: () => void
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
      await pb.collection('buchung_referenten').update(rowId, { eingesetzt: next })
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
      await pb.collection('buchungen').update(buchung.id, {
        teilnehmer_ist: wert,
        ...(statusUeberschreiben ? { status: statusUeberschreiben } : {}),
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
      await pb.collection('buchungen').update(buchung.id, { teilnehmer_ist: 0, status: 'durchgefuehrt' })
      setTeilnehmerIst('0')
      toast.success('Als „niemand erschienen" erfasst.')
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
      await pb.collection('buchung_referenten').create({
        buchung: buchung.id,
        referent: referent.id,
        geplant: false,
        eingesetzt: true,
        quelle: 'manuell',
        notiz: 'Spontane Vertretung (Ist-Erfassung)',
      })
      toast.success(`${referent.name} als spontane Vertretung erfasst.`)
      invalidateZuordnungen()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Hinzufügen fehlgeschlagen.'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ist-Erfassung</CardTitle>
        <CardDescription>
          Wer war tatsächlich im Einsatz? Wie viele Personen sind erschienen? Ab Termindatum ausfüllbar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  )
}
