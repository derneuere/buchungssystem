// Wizard-Schritt 7: Zusammenfassung — read-only Übersicht mit "Zurück zu
// Schritt X"-Bearbeiten-Links je Abschnitt (SPEC §5.1 Schritt 6/7).

import type { ReactNode } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Pencil, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { bundeslandLabel, lokalName } from '@/lib/types'
import type { Angebotsart, Einrichtungstyp, Thema } from '@/lib/types'
import { useSprache } from '@/lib/sprache'
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
  const { t } = useSprache()
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
          {t('summary.edit')}
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
  const { t, sprache } = useSprache()
  const values = useWatch({ control })

  const angebotsart = angebotsarten.find((a) => a.id === values.angebotsart_id)
  const thema = themen.find((th) => th.id === values.thema_id)
  const einrichtungstyp = einrichtungstypen.find((e) => e.id === values.herkunft_einrichtungstyp_id)
  const bundesland = bundeslandLabel(values.herkunft_bundesland, sprache)

  return (
    <div className="space-y-4">
      <SummarySection title={t('summary.secAngebot')} step={1} onEdit={onEdit}>
        <SummaryRow label={t('summary.angebotsart')} value={lokalName(angebotsart, sprache) || undefined} />
        <SummaryRow label={t('summary.thema')} value={lokalName(thema, sprache) || undefined} />
        <SummaryRow
          label={t('summary.gruppengroesse')}
          value={values.gruppengroesse ? t('summary.personen', { n: values.gruppengroesse }) : undefined}
        />
      </SummarySection>

      <SummarySection title={t('summary.secWunschtermin')} step={4} onEdit={onEdit}>
        <SummaryRow
          label={t('summary.datum')}
          value={values.datum ? formatDateLong(values.datum, sprache) : undefined}
        />
        <SummaryRow
          label={t('summary.uhrzeit')}
          value={
            values.slot_start
              ? t('summary.slot', { start: values.slot_start, ende: values.slot_ende ?? '' })
              : undefined
          }
        />
      </SummarySection>

      <SummarySection title={t('summary.secHerkunft')} step={5} onEdit={onEdit}>
        <SummaryRow label={t('summary.land')} value={values.herkunft_land} />
        <SummaryRow label={t('summary.bundesland')} value={bundesland || undefined} />
        <SummaryRow label={t('summary.einrichtungstyp')} value={lokalName(einrichtungstyp, sprache) || undefined} />
        <SummaryRow label={t('summary.einrichtung')} value={values.herkunft_einrichtungsname} />
        <SummaryRow label={t('summary.ort')} value={values.herkunft_ort} />
      </SummarySection>

      <SummarySection title={t('summary.secKontakt')} step={6} onEdit={onEdit}>
        <SummaryRow label={t('summary.name')} value={values.kontakt_name} />
        <SummaryRow label={t('summary.email')} value={values.kontakt_email} />
        <SummaryRow label={t('summary.telefon')} value={values.kontakt_telefon} />
        <SummaryRow label={t('summary.nachricht')} value={values.nachricht} />
      </SummarySection>

      <Separator />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>{t('summary.hinweis')}</AlertDescription>
      </Alert>
    </div>
  )
}
