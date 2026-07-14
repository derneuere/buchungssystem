// Wizard-Schritt 4: Wunschtermin — Kalender (Monatsstatus) + Slot-Auswahl.
// Reihenfolge bewusst NACH Gruppengröße (SPEC §3.4 benötigt `gruppengroesse`
// als Query-Parameter für die Verfügbarkeitsberechnung).

import { useEffect, useMemo, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { startOfMonth, startOfToday } from 'date-fns'
import { de } from 'date-fns/locale'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField, FormItem, FormMessage } from './form'
import { getVerfuegbarkeitSlots, getVerfuegbarkeitTage } from '@/lib/api'
import type { Angebotsart } from '@/lib/types'
import type { BuchungsFormValues } from '@/lib/booking-schema'
import { cn } from '@/lib/utils'
import { formatDateLong, parseDateKey, toDateKey, toMonthKey } from './booking-utils'

export function StepTermin({
  angebotsart,
  themaId,
  gruppengroesse,
}: {
  angebotsart?: Angebotsart
  themaId?: string
  gruppengroesse?: number | string
}) {
  const { control, setValue, getValues } = useFormContext<BuchungsFormValues>()
  const datum = useWatch({ control, name: 'datum' })
  const slotStart = useWatch({ control, name: 'slot_start' })

  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()))

  const groesseNum = Number(gruppengroesse)
  const hasBasics =
    Boolean(angebotsart?.id) && Boolean(themaId) && Number.isFinite(groesseNum) && groesseNum > 0

  // Wenn Angebotsart/Thema/Gruppengröße sich ändern, ist ein zuvor gewählter
  // Termin ggf. nicht mehr gültig -> zurücksetzen, damit nie ein veralteter
  // Slot mitgeschickt wird.
  useEffect(() => {
    if (getValues('datum') || getValues('slot_start')) {
      setValue('datum', '', { shouldValidate: false })
      setValue('slot_start', '', { shouldValidate: false })
      setValue('slot_ende', '', { shouldValidate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angebotsart?.id, themaId, groesseNum])

  const monatKey = toMonthKey(month)

  const tageQuery = useQuery({
    queryKey: ['public', 'verfuegbarkeit', 'tage', angebotsart?.id, themaId, monatKey, groesseNum],
    queryFn: () =>
      getVerfuegbarkeitTage({
        angebotsart_id: angebotsart!.id,
        thema_id: themaId!,
        monat: monatKey,
        gruppengroesse: groesseNum,
      }),
    enabled: hasBasics,
    placeholderData: keepPreviousData,
  })

  const slotsQuery = useQuery({
    queryKey: ['public', 'verfuegbarkeit', 'slots', angebotsart?.id, themaId, datum, groesseNum],
    queryFn: () =>
      getVerfuegbarkeitSlots({
        angebotsart_id: angebotsart!.id,
        thema_id: themaId!,
        datum,
        gruppengroesse: groesseNum,
      }),
    enabled: hasBasics && Boolean(datum),
  })

  const { disabledKeys, knappKeys, hatOffeneTage } = useMemo(() => {
    const disabled = new Set<string>()
    const knapp = new Set<string>()
    let offen = false
    for (const tag of tageQuery.data ?? []) {
      if (tag.status === 'ausgebucht') {
        disabled.add(tag.datum)
      } else {
        offen = true
        if (tag.status === 'knapp') knapp.add(tag.datum)
      }
    }
    return { disabledKeys: disabled, knappKeys: knapp, hatOffeneTage: offen }
  }, [tageQuery.data])

  const selectedDate = datum ? parseDateKey(datum) : undefined

  function handleSelectDate(date: Date | undefined) {
    if (!date) return
    setValue('datum', toDateKey(date), { shouldValidate: true })
    setValue('slot_start', '', { shouldValidate: false })
    setValue('slot_ende', '', { shouldValidate: false })
  }

  if (!hasBasics) {
    return (
      <Alert>
        <AlertDescription>
          Bitte wählen Sie zunächst Angebotsart, Thema und Gruppengröße aus.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-medium">Datum</h3>
        <div className="relative rounded-lg border p-2 sm:p-3">
          {tageQuery.isFetching && (
            <div className="absolute right-3 top-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="sr-only">Verfügbarkeit wird geladen …</span>
            </div>
          )}
          <Calendar
            mode="single"
            locale={de}
            month={month}
            onMonthChange={setMonth}
            selected={selectedDate}
            onSelect={handleSelectDate}
            fromMonth={startOfMonth(new Date())}
            disabled={[{ before: startOfToday() }, (day: Date) => disabledKeys.has(toDateKey(day))]}
            modifiers={{ knapp: (day: Date) => knappKeys.has(toDateKey(day)) }}
            modifiersClassNames={{
              knapp:
                'relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-amber-500 after:content-[""]',
            }}
            className="mx-auto"
          />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
            aria-hidden="true"
          />
          Tage mit Punkt: nur noch wenige Termine frei
        </p>
        {!tageQuery.isLoading && !tageQuery.isFetching && !hatOffeneTage && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Keine Termine frei</AlertTitle>
            <AlertDescription>
              Für diesen Zeitraum sind aktuell keine Termine frei – bitte anderen Monat wählen oder
              die Gedenkstätte kontaktieren.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {datum && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Uhrzeit am {formatDateLong(datum)}</h3>
          {slotsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          ) : (slotsQuery.data?.slots.length ?? 0) === 0 ? (
            <Alert>
              <AlertDescription>
                An diesem Tag sind keine Zeitfenster verfügbar. Bitte wählen Sie einen anderen Tag.
              </AlertDescription>
            </Alert>
          ) : (
            <FormField
              control={control}
              name="slot_start"
              render={({ field }) => (
                <FormItem>
                  <RadioGroup
                    value={field.value}
                    onValueChange={(value) => {
                      const slot = slotsQuery.data?.slots.find((s) => s.start === value)
                      field.onChange(value)
                      setValue('slot_ende', slot?.ende ?? '', { shouldValidate: true })
                    }}
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                    aria-label="Uhrzeit auswählen"
                  >
                    {slotsQuery.data?.slots.map((slot) => {
                      const inputId = `slot-${slot.start}`
                      const active = slotStart === slot.start
                      return (
                        <Label
                          key={slot.start}
                          htmlFor={inputId}
                          className={cn(
                            'flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50',
                            !slot.buchbar && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                            active && 'border-primary bg-accent/40 ring-2 ring-primary/30',
                          )}
                        >
                          <RadioGroupItem value={slot.start} id={inputId} disabled={!slot.buchbar} />
                          {slot.start}–{slot.ende} Uhr
                        </Label>
                      )
                    })}
                  </RadioGroup>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      )}
    </div>
  )
}
