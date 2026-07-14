// Wizard-Schritt 7: Zusammenfassung — read-only Übersicht mit "Zurück zu
// Schritt X"-Bearbeiten-Links je Abschnitt (SPEC §5.1 Schritt 6/7).

import type { ReactNode } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Pencil, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BUNDESLAENDER } from '@/lib/types'
import type { Angebotsart, Einrichtungstyp, Thema } from '@/lib/types'
import type { BuchungsFormValues } from '@/lib/booking-schema'
import { formatDateLong } from './booking-utils'

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 py-1 sm:flex-row sm:gap-2">
      <dt className="w-40 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

function SummarySection({
  title,
  step,
  onEdit,
  children,
}: {
  title: string
  step: number
  onEdit: (step: number) => void
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => onEdit(step)}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          Bearbeiten
        </Button>
      </div>
      <dl className="space-y-0.5">{children}</dl>
    </section>
  )
}

export function StepZusammenfassung({
  angebotsarten,
  themen,
  einrichtungstypen,
  onEdit,
}: {
  angebotsarten: Angebotsart[]
  themen: Thema[]
  einrichtungstypen: Einrichtungstyp[]
  onEdit: (step: number) => void
}) {
  const { control } = useFormContext<BuchungsFormValues>()
  const values = useWatch({ control })

  const angebotsart = angebotsarten.find((a) => a.id === values.angebotsart_id)
  const thema = themen.find((t) => t.id === values.thema_id)
  const einrichtungstyp = einrichtungstypen.find((e) => e.id === values.herkunft_einrichtungstyp_id)
  const bundeslandLabel = BUNDESLAENDER.find((b) => b.value === values.herkunft_bundesland)?.label

  return (
    <div className="space-y-4">
      <SummarySection title="Angebot" step={1} onEdit={onEdit}>
        <SummaryRow label="Angebotsart" value={angebotsart?.name} />
        <SummaryRow label="Thema" value={thema?.name} />
        <SummaryRow label="Gruppengröße" value={values.gruppengroesse ? `${values.gruppengroesse} Personen` : undefined} />
      </SummarySection>

      <SummarySection title="Wunschtermin" step={4} onEdit={onEdit}>
        <SummaryRow label="Datum" value={values.datum ? formatDateLong(values.datum) : undefined} />
        <SummaryRow
          label="Uhrzeit"
          value={values.slot_start ? `${values.slot_start}–${values.slot_ende} Uhr` : undefined}
        />
      </SummarySection>

      <SummarySection title="Herkunft" step={5} onEdit={onEdit}>
        <SummaryRow label="Land" value={values.herkunft_land} />
        <SummaryRow label="Bundesland" value={bundeslandLabel} />
        <SummaryRow label="Einrichtungstyp" value={einrichtungstyp?.name} />
        <SummaryRow label="Einrichtung" value={values.herkunft_einrichtungsname} />
        <SummaryRow label="Ort" value={values.herkunft_ort} />
      </SummarySection>

      <SummarySection title="Kontakt" step={6} onEdit={onEdit}>
        <SummaryRow label="Name" value={values.kontakt_name} />
        <SummaryRow label="E-Mail" value={values.kontakt_email} />
        <SummaryRow label="Telefon" value={values.kontakt_telefon} />
        <SummaryRow label="Nachricht" value={values.nachricht} />
      </SummarySection>

      <Separator />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Dies ist eine Anfrage. Verbindlich wird die Buchung erst nach Bestätigung durch die
          Gedenkstätte.
        </AlertDescription>
      </Alert>
    </div>
  )
}
