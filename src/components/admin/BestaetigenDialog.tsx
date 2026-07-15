import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, TriangleAlert, UserPlus } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { pb } from '@/lib/pocketbase'
import { adminBestaetigen, adminReferentenKandidaten, type BestaetigenWarnung } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import { cn } from '@/lib/utils'
import type { Raum, ReferentKandidat } from '@/lib/types'

/**
 * Bestätigen-Aktion mit Kapazitäts-Handling (docs/KAPAZITAET.md §2) UND
 * Referenten-Auswahl bei Unterbesetzung: Der Server blockiert nur einen belegten
 * Raum hart (409). Fehlen Referent:innen/Raum oder gibt es eine Kollision,
 * antwortet er mit 422; dann werden Kandidat:innen samt Auslastungs-Kennzahlen
 * (Einsätze heute/Woche/gesamt, über/unter Schnitt) angezeigt und direkt hier
 * zuweisbar. Danach erneut bestätigen oder – mit Pflicht-Grund – „trotzdem".
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
    enabled: open && warnung !== null,
  })

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
      queryClient.invalidateQueries({ queryKey: ['admin', 'kandidaten', buchungId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'buchung-referenten', buchungId] })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Zuweisen fehlgeschlagen.'))
    } finally {
      setAssigning(null)
    }
  }

  const kand = kandidatenQuery.data

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
              ? 'Dieses Angebot benötigt einen Raum. Bitte einen Raum wählen (optional – kann auch später vergeben werden).'
              : 'Die anfragende Person erhält eine Zusage-E-Mail.'}
          </DialogDescription>
        </DialogHeader>

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

        {warnung && (
          <>
            <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Hinweis vor dem Bestätigen</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc">
                  {warnung.unterbesetzt && (
                    <li>
                      Es sind erst {warnung.geplant} von {warnung.benoetigt} benötigten Referent:innen eingeplant –
                      bitte unten zuweisen.
                    </li>
                  )}
                  {warnung.raum_offen && <li>Es ist noch kein Raum vergeben.</li>}
                  {warnung.kollision && <li>Eine zugeordnete Person hat eine Terminüberschneidung.</li>}
                </ul>
              </AlertDescription>
            </Alert>

            {(warnung.unterbesetzt || (kand && kand.kandidaten.length > 0)) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Referent:in auswählen</p>
                <div className="max-h-64 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Eignung</TableHead>
                        <TableHead className="text-right" title="Einsätze am Termintag">
                          Heute
                        </TableHead>
                        <TableHead className="text-right" title="Einsätze in der Termin-Woche">
                          Woche
                        </TableHead>
                        <TableHead className="text-right" title="Bereits durchgeführte Einsätze (gesamt)">
                          Gesamt
                        </TableHead>
                        <TableHead>Auslastung</TableHead>
                        <TableHead className="text-right">Aktion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kandidatenQuery.isLoading && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          </TableCell>
                        </TableRow>
                      )}
                      {kand?.kandidaten.map((k) => (
                        <TableRow key={k.id}>
                          <TableCell className="font-medium">{k.name}</TableCell>
                          <TableCell>
                            <EignungBadge k={k} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{k.einsaetze_tag}</TableCell>
                          <TableCell className="text-right tabular-nums">{k.einsaetze_woche}</TableCell>
                          <TableCell className="text-right tabular-nums">{k.einsaetze_gesamt}</TableCell>
                          <TableCell>
                            <AuslastungBadge rel={k.auslastung_relativ} />
                          </TableCell>
                          <TableCell className="text-right">
                            {k.zugewiesen ? (
                              <span className="text-xs text-muted-foreground">zugewiesen</span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={assigning !== null}
                                onClick={() => void zuweisen(k)}
                              >
                                {assigning === k.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UserPlus className="h-4 w-4" />
                                )}
                                Zuweisen
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {kand && kand.kandidaten.length === 0 && !kandidatenQuery.isLoading && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                            Keine aktiven Referent:innen angelegt.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⌀ = Durchschnitt aller Referent:innen. „Heute/Woche" bezieht sich auf den Termin dieser Buchung.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="bestaetigen-grund">Grund (nur bei „Trotzdem bestätigen")</Label>
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
          {!warnung ? (
            <Button
              type="button"
              onClick={() => void attempt(false)}
              disabled={busy}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Bestätigen
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void attempt(false)}
                disabled={busy || assigning !== null}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Erneut bestätigen
              </Button>
              <Button
                type="button"
                onClick={() => void attempt(true)}
                disabled={busy || !grund.trim()}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                Trotzdem bestätigen
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EignungBadge({ k }: { k: ReferentKandidat }) {
  if (k.warnstufe === 'hart') {
    return (
      <Badge
        variant="outline"
        className="border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        title="Terminüberschneidung mit einer anderen Buchung"
      >
        Konflikt
      </Badge>
    )
  }
  if (k.warnstufe === 'weich') {
    const grund = !k.themaMatch ? 'Thema nicht hinterlegt' : 'außerhalb der Verfügbarkeit'
    return (
      <Badge
        variant="outline"
        className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
        title={grund}
      >
        eingeschränkt
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    >
      geeignet
    </Badge>
  )
}

function AuslastungBadge({ rel }: { rel: ReferentKandidat['auslastung_relativ'] }) {
  const map = {
    ueber: {
      label: 'über ⌀',
      cls: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
    unter: {
      label: 'unter ⌀',
      cls: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
    },
    schnitt: { label: 'im ⌀', cls: 'text-muted-foreground' },
  }[rel]
  return (
    <Badge variant="outline" className={cn(map.cls)}>
      {map.label}
    </Badge>
  )
}
