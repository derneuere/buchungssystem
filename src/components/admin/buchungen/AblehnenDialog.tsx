// Dünner Wrapper um den gemeinsamen GrundDialog (siehe shared/GrundDialog.tsx).
import type { ReactNode } from 'react'
import { GrundDialog } from '@/components/admin/shared/GrundDialog'
import { adminAblehnen } from '@/lib/api'

export function AblehnenDialog({
  buchungId,
  trigger,
  onSuccess,
}: {
  buchungId: string
  trigger: ReactNode
  onSuccess?: () => void
}) {
  return (
    <GrundDialog
      trigger={trigger}
      titel="Buchung ablehnen"
      beschreibung="Bitte geben Sie einen Grund für die Ablehnung an. Dieser wird intern gespeichert."
      platzhalter="z.B. Termin bereits ausgebucht, kein passender Referent verfügbar …"
      pflichtFehler="Bitte einen Ablehnungsgrund angeben."
      submitLabel="Ablehnen"
      erfolgMeldung="Buchung wurde abgelehnt."
      fehlerMeldung="Ablehnen fehlgeschlagen."
      checkbox={{ label: 'Grund per E-Mail an Kunde/Kundin senden', initial: true }}
      onSubmit={(grund, grundSenden) =>
        adminAblehnen(buchungId, { grund, grund_an_kunde_senden: grundSenden })
      }
      onSuccess={onSuccess}
    />
  )
}
