import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, TriangleAlert } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { pb } from '@/lib/pocketbase'
import { adminBestaetigen, type BestaetigenWarnung } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import type { Raum } from '@/lib/types'

/**
 * Bestätigen-Aktion mit Kapazitäts-Handling (docs/KAPAZITAET.md §2): der Server
 * blockiert nur einen belegten Raum hart (409). Bei Unterbesetzung, fehlendem
 * Raum oder Referenten-Kollision antwortet er mit 422 + Warndetails; dann wird
 * ein Hinweis samt Pflicht-Grund gezeigt und „Trotzdem bestätigen" möglich.
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
  const [open, setOpen] = useState(false)
  const [raumId, setRaumId] = useState('')
  const [busy, setBusy] = useState(false)
  const [warnung, setWarnung] = useState<BestaetigenWarnung | null>(null)
  const [grund, setGrund] = useState('')

  const raeumeQuery = useQuery({
    queryKey: ['admin', 'raeume', 'aktiv'],
    queryFn: () => pb.collection('raeume').getFullList<Raum>({ filter: 'aktiv = true', sort: 'kapazitaet' }),
    enabled: open && benoetigtRaum,
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

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
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
              <AlertTitle>Bestätigen trotz Hinweis?</AlertTitle>
              <AlertDescription>
                <ul className="list-inside list-disc">
                  {warnung.unterbesetzt && (
                    <li>
                      Es sind erst {warnung.geplant} von {warnung.benoetigt} benötigten Referent:innen eingeplant.
                    </li>
                  )}
                  {warnung.raum_offen && <li>Es ist noch kein Raum vergeben.</li>}
                  {warnung.kollision && <li>Eine zugeordnete Person hat eine Terminüberschneidung.</li>}
                </ul>
                Sie können trotzdem bestätigen – bitte kurz begründen (wird intern vermerkt).
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
            <Button
              type="button"
              onClick={() => void attempt(true)}
              disabled={busy || !grund.trim()}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Trotzdem bestätigen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
