// Wizard-Schritt 3: Gruppengröße. Bewusst VOR dem Kalender (Schritt 4), da die
// Verfügbarkeitsberechnung (`/verfuegbarkeit/tage|slots`) die Gruppengröße als
// Query-Parameter benötigt (SPEC §3.4) — siehe Hinweis in BuchungsWizard.tsx.

import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from './form'
import type { Angebotsart } from '@/lib/types'
import type { BuchungsFormValues } from '@/lib/booking-schema'

export function StepGruppengroesse({ angebotsart }: { angebotsart?: Angebotsart }) {
  const { control } = useFormContext<BuchungsFormValues>()
  const min = angebotsart?.min_teilnehmer && angebotsart.min_teilnehmer > 0 ? angebotsart.min_teilnehmer : 1
  const max = angebotsart?.max_teilnehmer

  return (
    <FormField
      control={control}
      name="gruppengroesse"
      render={({ field }) => (
        <FormItem>
          <FormLabel htmlFor="gruppengroesse">Anzahl Teilnehmende</FormLabel>
          <FormControl>
            <Input
              id="gruppengroesse"
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              className="h-11 max-w-[10rem]"
              {...field}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
            />
          </FormControl>
          <FormDescription>
            {max
              ? `Zwischen ${min} und ${max} Personen für „${angebotsart?.name}".`
              : `Mindestens ${min} Personen.`}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
