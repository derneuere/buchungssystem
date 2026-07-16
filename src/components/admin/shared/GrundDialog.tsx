// Gemeinsamer Dialog für Status-Aktionen mit Pflicht-Grund (Ablehnen,
// Stornieren): Textarea + optionale Checkbox, destruktiver Submit-Button.
// Die konkreten Aktionen sind dünne Wrapper (AblehnenDialog, StornierenDialog).

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
import { Checkbox } from '@/components/ui/checkbox'
import { getErrorMessage } from '@/lib/admin-errors'

export function GrundDialog({
  trigger,
  titel,
  beschreibung,
  platzhalter,
  pflichtFehler,
  submitLabel,
  erfolgMeldung,
  fehlerMeldung,
  checkbox,
  onSubmit,
  onSuccess,
}: {
  trigger: ReactNode
  titel: string
  beschreibung: string
  platzhalter: string
  pflichtFehler: string
  submitLabel: string
  erfolgMeldung: string
  fehlerMeldung: string
  checkbox?: { label: string; initial: boolean }
  onSubmit: (grund: string, checkboxWert: boolean) => Promise<unknown>
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [grund, setGrund] = useState('')
  const [checkboxWert, setCheckboxWert] = useState(checkbox?.initial ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Eindeutige Feld-IDs pro Dialog-Instanz (Label-Zuordnung).
  const feldId = `grund-${titel.replace(/\W+/g, '-').toLowerCase()}`

  async function handleSubmit() {
    if (!grund.trim()) {
      setError(pflichtFehler)
      return
    }
    setError('')
    setBusy(true)
    try {
      await onSubmit(grund.trim(), checkboxWert)
      toast.success(erfolgMeldung)
      setOpen(false)
      setGrund('')
      onSuccess?.()
    } catch (err) {
      toast.error(getErrorMessage(err, fehlerMeldung))
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
          <DialogTitle>{titel}</DialogTitle>
          <DialogDescription>{beschreibung}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={feldId}>Grund *</Label>
            <Textarea
              id={feldId}
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              rows={3}
              placeholder={platzhalter}
            />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          </div>
          {checkbox && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${feldId}-checkbox`}
                checked={checkboxWert}
                onCheckedChange={(v) => setCheckboxWert(v === true)}
              />
              <Label htmlFor={`${feldId}-checkbox`} className="cursor-pointer font-normal">
                {checkbox.label}
              </Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
