// Dünner Wrapper um den gemeinsamen GrundDialog (siehe shared/GrundDialog.tsx).
import type { ReactNode } from 'react'
import { GrundDialog } from '@/components/admin/shared/GrundDialog'
import { adminStornieren } from '@/lib/api'

export function StornierenDialog({
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
      titel="Buchung stornieren"
      beschreibung="Die Kapazität (Termin, Raum, Referenten) wird sofort wieder freigegeben. Die Zuordnungen bleiben fürs Reporting erhalten."
      platzhalter="z.B. Anfrage der Kundin/des Kunden, Krankheit, höhere Gewalt …"
      pflichtFehler="Bitte einen Grund für die Stornierung angeben."
      submitLabel="Stornieren"
      erfolgMeldung="Buchung wurde storniert."
      fehlerMeldung="Stornieren fehlgeschlagen."
      onSubmit={(grund) => adminStornieren(buchungId, { grund })}
      onSuccess={onSuccess}
    />
  )
}
