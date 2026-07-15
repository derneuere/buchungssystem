// Wiederverwendbarer Buchungswizard für Führungen/Seminare der Gedenkstätte
// Deutscher Widerstand (SPEC.md §5.1). Wird identisch von `/` (showChrome)
// und `/embed` (chromeless) verwendet — siehe jeweilige Route-Dateien.
//
// Schritt-Reihenfolge — bewusste Abweichung von SPEC §5.1 (dort: Angebotsart,
// Thema, Termin, Gruppengröße&Herkunft, Kontakt, Zusammenfassung):
// Die Verfügbarkeitsberechnung (§3.4 `berechneSlots`) benötigt die
// Gruppengröße als Query-Parameter (Kandidaten-Filter nach benötigten
// Referent:innen hängt von ihr ab). Gruppengröße muss daher VOR dem Kalender
// erfasst werden, sonst müsste der Kalender-Schritt nachträglich komplett neu
// geladen werden, sobald die Gruppengröße feststeht. Reihenfolge hier:
// 1 Angebotsart · 2 Thema · 3 Gruppengröße · 4 Wunschtermin · 5 Herkunft ·
// 6 Kontakt · 7 Zusammenfassung.

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import type { FieldErrors, Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClientResponseError } from 'pocketbase'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { pb } from '@/lib/pocketbase'
import { submitBuchungsanfrage } from '@/lib/api'
import type { Angebotsart, Bundesland, Einrichtungstyp, Thema } from '@/lib/types'
import { useSprache } from '@/lib/sprache'
import {
  STEP_COUNT,
  STEP_FIELDS,
  buildBuchungsSchema,
  defaultBuchungsFormValues,
  istDeutschlandLand,
  stepForField,
  type BuchungsFormValues,
} from '@/lib/booking-schema'
import { Form } from './form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { StepIndicator } from './StepIndicator'
import { StepAngebotsart } from './StepAngebotsart'
import { StepThema } from './StepThema'
import { StepGruppengroesse } from './StepGruppengroesse'
import { StepTermin } from './StepTermin'
import { StepHerkunft } from './StepHerkunft'
import { StepKontakt } from './StepKontakt'
import { StepZusammenfassung } from './StepZusammenfassung'
import { buildStartIso } from './booking-utils'

export function BuchungsWizard({ showChrome }: { showChrome: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t, sprache } = useSprache()

  const stepTitle = useCallback((n: number) => t(`stepTitle.${n}`), [t])

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const angebotsartRef = useRef<Angebotsart | undefined>(undefined)

  // ---- Stammdaten (öffentlich, aktiv=true) ---------------------------------
  const angebotsartenQuery = useQuery({
    queryKey: ['public', 'angebotsarten'],
    queryFn: () =>
      pb.collection('angebotsarten').getFullList<Angebotsart>({
        filter: 'aktiv = true',
        sort: 'sort_order',
      }),
  })
  const themenQuery = useQuery({
    queryKey: ['public', 'themen'],
    queryFn: () =>
      pb.collection('themen').getFullList<Thema>({ filter: 'aktiv = true', sort: 'sort_order' }),
  })
  const einrichtungstypenQuery = useQuery({
    queryKey: ['public', 'einrichtungstypen'],
    queryFn: () =>
      pb.collection('einrichtungstypen').getFullList<Einrichtungstyp>({
        filter: 'aktiv = true',
        sort: 'sort_order',
      }),
  })

  // Resolver liest die jeweils aktuelle Angebotsart aus einer Ref, damit das
  // dynamische `max` für Gruppengröße (E11) berücksichtigt wird, ohne bei
  // jedem Wechsel eine neue `useForm`-Instanz erzeugen zu müssen. Lose
  // getypte Parameter + äußerer Cast, weil `z.coerce.number()` Input-Typ
  // (unknown) und Output-Typ (number) von `BuchungsFormValues` divergieren —
  // zur Laufzeit unproblematisch, `zodResolver` parst/coerciert ohnehin neu.
  const resolver = useMemo<Resolver<BuchungsFormValues>>(() => {
    const dynamicResolver = async (values: unknown, context: unknown, options: unknown) => {
      const schema = buildBuchungsSchema(angebotsartRef.current, t)
      return zodResolver(schema)(values as never, context as never, options as never)
    }
    return dynamicResolver as unknown as Resolver<BuchungsFormValues>
  }, [t])

  const form = useForm<BuchungsFormValues>({
    resolver,
    defaultValues: defaultBuchungsFormValues(sprache),
    mode: 'onBlur',
  })

  const { handleSubmit, trigger, setValue, watch } = form

  const angebotsartId = watch('angebotsart_id')
  const themaId = watch('thema_id')
  const gruppengroesse = watch('gruppengroesse')

  const selectedAngebotsart = useMemo(
    () => angebotsartenQuery.data?.find((a) => a.id === angebotsartId),
    [angebotsartenQuery.data, angebotsartId],
  )

  useEffect(() => {
    angebotsartRef.current = selectedAngebotsart
  }, [selectedAngebotsart])

  // Fokus-Management: bei Schrittwechsel Überschrift fokussieren (SPEC §5.1 A11y).
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const goToStep = useCallback((n: number) => {
    setStep(n)
  }, [])

  async function handleNext() {
    const fields = STEP_FIELDS[step] ?? []
    const valid = fields.length === 0 ? true : await trigger(fields as never, { shouldFocus: true })
    if (!valid) return
    setStep((s) => Math.min(s + 1, STEP_COUNT))
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1))
  }

  async function onSubmit(values: BuchungsFormValues) {
    setSubmitting(true)
    try {
      const start = buildStartIso(values.datum, values.slot_start)
      const istDeutschland = istDeutschlandLand(values.herkunft_land)

      const res = await submitBuchungsanfrage({
        angebotsart_id: values.angebotsart_id,
        thema_id: values.thema_id,
        start,
        teilnehmer_geplant: Number(values.gruppengroesse),
        herkunft_land: values.herkunft_land,
        herkunft_bundesland: istDeutschland
          ? ((values.herkunft_bundesland || '') as Bundesland | '')
          : '',
        herkunft_einrichtungstyp_id: values.herkunft_einrichtungstyp_id || undefined,
        herkunft_einrichtungsname: values.herkunft_einrichtungsname || undefined,
        herkunft_ort: values.herkunft_ort || undefined,
        kontakt_name: values.kontakt_name,
        kontakt_email: values.kontakt_email,
        kontakt_telefon: values.kontakt_telefon || undefined,
        nachricht: values.nachricht || undefined,
        datenschutz_einwilligung: values.datenschutz_zugestimmt,
        firma_website: values.firma_website || '',
        formular_geladen_ts: values.formular_geladen_ts,
      })

      navigate({
        to: '/buchung/danke',
        search: { id: res.id, lang: sprache === 'en' ? 'en' : undefined },
      })
    } catch (err) {
      handleSubmitError(err)
    } finally {
      setSubmitting(false)
    }
  }

  function handleSubmitError(err: unknown) {
    if (err instanceof ClientResponseError) {
      if (err.status === 429) {
        toast.error(t('wizard.toast.rate'))
        return
      }
      if (err.status === 409) {
        toast.error(t('wizard.toast.conflict'))
        queryClient.invalidateQueries({ queryKey: ['public', 'verfuegbarkeit'] })
        setValue('slot_start', '', { shouldValidate: false })
        setValue('slot_ende', '', { shouldValidate: false })
        setStep(4)
        return
      }
    }
    toast.error(t('wizard.toast.error'))
  }

  function onInvalid(errors: FieldErrors<BuchungsFormValues>) {
    const firstField = Object.keys(errors)[0]
    if (!firstField) return
    const target = stepForField(firstField)
    if (target !== step) {
      toast.error(t('wizard.toast.validation', { target, titel: stepTitle(target) }))
      setStep(target)
    }
  }

  const isLastStep = step === STEP_COUNT

  return (
    <div className={cn('mx-auto w-full max-w-2xl', showChrome ? 'px-4 py-8 sm:py-12' : 'px-3 py-4')}>
      <div aria-live="polite" className="sr-only">
        {t('wizard.stepStatus', { step, count: STEP_COUNT, titel: stepTitle(step) })}
      </div>

      <StepIndicator step={step} total={STEP_COUNT} titel={stepTitle(step)} />

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="pb-24 sm:pb-0">
          {/* Honeypot (E10, §4.3) — für Menschen unsichtbar, für Bots ausfüllbar */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '-9999px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            <label htmlFor="firma_website">{t('wizard.honeypot')}</label>
            <input
              id="firma_website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...form.register('firma_website')}
            />
          </div>

          <Wrapper showChrome={showChrome}>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="mb-4 text-xl font-semibold tracking-tight outline-none sm:text-2xl"
            >
              {t('wizard.stepHeading', { step, titel: stepTitle(step) })}
            </h2>

            {step === 1 && (
              <StepAngebotsart
                angebotsarten={angebotsartenQuery.data ?? []}
                isLoading={angebotsartenQuery.isLoading}
              />
            )}
            {step === 2 && (
              <StepThema themen={themenQuery.data ?? []} isLoading={themenQuery.isLoading} />
            )}
            {step === 3 && <StepGruppengroesse angebotsart={selectedAngebotsart} />}
            {step === 4 && (
              <StepTermin
                angebotsart={selectedAngebotsart}
                themaId={themaId}
                gruppengroesse={gruppengroesse}
              />
            )}
            {step === 5 && <StepHerkunft einrichtungstypen={einrichtungstypenQuery.data ?? []} />}
            {step === 6 && <StepKontakt />}
            {step === 7 && (
              <StepZusammenfassung
                angebotsarten={angebotsartenQuery.data ?? []}
                themen={themenQuery.data ?? []}
                einrichtungstypen={einrichtungstypenQuery.data ?? []}
                onEdit={goToStep}
              />
            )}
          </Wrapper>

          <div
            className={cn(
              'mt-6 flex items-center justify-between gap-3 border-t bg-background py-4',
              'sticky bottom-0 sm:static sm:border-t-0 sm:pt-6',
            )}
          >
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={step === 1 || submitting}
              className="min-h-11"
            >
              {t('wizard.back')}
            </Button>
            {isLastStep ? (
              <Button type="submit" disabled={submitting} className="min-h-11 min-w-40">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t('wizard.sending')}
                  </>
                ) : (
                  t('wizard.submit')
                )}
              </Button>
            ) : (
              <Button type="button" onClick={handleNext} className="min-h-11">
                {t('wizard.next')}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}

function Wrapper({ showChrome, children }: { showChrome: boolean; children: ReactNode }) {
  if (!showChrome) {
    return <div>{children}</div>
  }
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
    </Card>
  )
}
