// Wizard-Schritt 1: Angebotsart (Führung/Seminar) als Radio-Cards.
// Datenquelle: `angebotsarten` mit `aktiv=true` (öffentlich lesbar, SPEC §2.3).

import { useFormContext } from 'react-hook-form'
import { Clock, DoorOpen } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField, FormItem, FormMessage } from './form'
import { cn } from '@/lib/utils'
import type { Angebotsart } from '@/lib/types'
import { lokalBeschreibung, lokalName } from '@/lib/types'
import { useSprache } from '@/lib/sprache'
import type { BuchungsFormValues } from '@/lib/booking-schema'

export function StepAngebotsart({
  angebotsarten,
  isLoading,
}: {
  angebotsarten: Angebotsart[]
  isLoading: boolean
}) {
  const { control } = useFormContext<BuchungsFormValues>()
  const { t, sprache } = useSprache()

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    )
  }

  if (angebotsarten.length === 0) {
    return (
      <Alert>
        <AlertDescription>{t('stepAngebotsart.empty')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <FormField
      control={control}
      name="angebotsart_id"
      render={({ field }) => (
        <FormItem>
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            className="grid gap-3 sm:grid-cols-2"
            aria-label={t('stepAngebotsart.ariaLabel')}
          >
            {angebotsarten.map((a) => {
              const inputId = `angebotsart-${a.id}`
              const active = field.value === a.id
              const beschreibung = lokalBeschreibung(a, sprache)
              return (
                <Label
                  key={a.id}
                  htmlFor={inputId}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-accent/50',
                    active && 'border-primary bg-accent/40 ring-2 ring-primary/30',
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <RadioGroupItem value={a.id} id={inputId} />
                    {lokalName(a, sprache)}
                  </span>
                  {beschreibung && (
                    <span className="pl-6 text-sm font-normal text-muted-foreground">
                      {beschreibung}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-3 pl-6 text-xs font-normal text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('stepAngebotsart.duration', { dauer_minuten: a.dauer_minuten })}
                    </span>
                    {a.benoetigt_raum && (
                      <span className="inline-flex items-center gap-1">
                        <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('stepAngebotsart.roomRequired')}
                      </span>
                    )}
                  </span>
                </Label>
              )
            })}
          </RadioGroup>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
