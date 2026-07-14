import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { pb } from '@/lib/pocketbase'
import { adminBestaetigen } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import type { Raum } from '@/lib/types'

/**
 * Bestätigen-Aktion. Bei `benoetigtRaum=false` genügt ein Klick (Button ruft
 * direkt `onConfirm`). Bei `benoetigtRaum=true` öffnet sich ein Dialog zur
 * Raumauswahl (SPEC §5.3 „bei Seminar Raumauswahl/raum_id").
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

  const raeumeQuery = useQuery({
    queryKey: ['admin', 'raeume', 'aktiv'],
    queryFn: () => pb.collection('raeume').getFullList<Raum>({ filter: 'aktiv = true', sort: 'kapazitaet' }),
    enabled: open && benoetigtRaum,
  })

  async function runBestaetigen(body: { raum_id?: string }) {
    setBusy(true)
    try {
      await adminBestaetigen(buchungId, body)
      toast.success('Buchung wurde bestätigt.')
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Bestätigen fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  if (!benoetigtRaum) {
    return (
      <Button
        type="button"
        onClick={() => void runBestaetigen({})}
        disabled={busy}
        className="bg-emerald-600 text-white hover:bg-emerald-700"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Bestätigen
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buchung bestätigen</DialogTitle>
          <DialogDescription>
            Dieses Angebot benötigt einen Raum. Bitte wählen Sie einen Raum für den Termin aus.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bestaetigen-raum">Raum</Label>
          <Select value={raumId} onValueChange={setRaumId}>
            <SelectTrigger id="bestaetigen-raum">
              <SelectValue placeholder={raeumeQuery.isLoading ? 'Lädt …' : 'Raum wählen'} />
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={() => void runBestaetigen({ raum_id: raumId || undefined })}
            disabled={busy || !raumId}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
