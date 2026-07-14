import { useState, type ReactNode } from 'react'
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
import { adminStornieren } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'

export function StornierenDialog({
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!grund.trim()) {
      setError('Bitte einen Grund für die Stornierung angeben.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await adminStornieren(buchungId, { grund: grund.trim() })
      toast.success('Buchung wurde storniert.')
      setOpen(false)
      setGrund('')
      onSuccess?.()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Stornieren fehlgeschlagen.'))
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
          <DialogTitle>Buchung stornieren</DialogTitle>
          <DialogDescription>
            Die Kapazität (Termin, Raum, Referenten) wird sofort wieder freigegeben. Die Zuordnungen bleiben fürs
            Reporting erhalten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="stornieren-grund">Grund *</Label>
          <Textarea
            id="stornieren-grund"
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            rows={3}
            placeholder="z.B. Anfrage der Kundin/des Kunden, Krankheit, höhere Gewalt …"
          />
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Stornieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
