import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { adminAblehnen } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import type { ReactNode } from 'react'

export function AblehnenDialog({
  buchungId,
  trigger,
  onSuccess,
}: {
  buchungId: string
  trigger: ReactNode
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [grund, setGrund] = useState('')
  const [grundSenden, setGrundSenden] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!grund.trim()) {
      setError('Bitte einen Ablehnungsgrund angeben.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await adminAblehnen(buchungId, { grund: grund.trim(), grund_an_kunde_senden: grundSenden })
      toast.success('Buchung wurde abgelehnt.')
      setOpen(false)
      setGrund('')
      onSuccess?.()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Ablehnen fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError('')
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buchung ablehnen</DialogTitle>
          <DialogDescription>
            Bitte geben Sie einen Grund für die Ablehnung an. Dieser wird intern gespeichert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ablehnen-grund">Grund *</Label>
            <Textarea
              id="ablehnen-grund"
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              rows={3}
              placeholder="z.B. Termin bereits ausgebucht, kein passender Referent verfügbar …"
            />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="ablehnen-senden"
              checked={grundSenden}
              onCheckedChange={(v) => setGrundSenden(v === true)}
            />
            <Label htmlFor="ablehnen-senden" className="cursor-pointer font-normal">
              Grund per E-Mail an Kunde/Kundin senden
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Ablehnen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
