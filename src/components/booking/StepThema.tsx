// Wizard-Schritt 2: Thema. Datenquelle: `themen` mit `aktiv=true` (öffentlich
// lesbar). Bewusst keine Referenten-Informationen (SPEC §5.1 Schritt 2).

import { useFormContext } from 'react-hook-form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormField, FormItem, FormMessage } from './form'
import { cn } from '@/lib/utils'
import type { Thema } from '@/lib/types'
import { lokalBeschreibung, lokalName } from '@/lib/types'
import { useSprache } from '@/lib/sprache'
import type { BuchungsFormValues } from '@/lib/booking-schema'

export function StepThema({ themen, isLoading }: { themen: Thema[]; isLoading: boolean }) {
  const { control } = useFormContext<BuchungsFormValues>()
  const { t, sprache } = useSprache()

  if (isLoading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    )
  }

  if (themen.length === 0) {
    return (
      <Alert>
        <AlertDescription>{t('stepThema.empty')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <FormField
      control={control}
      name="thema_id"
      render={({ field }) => (
        <FormItem>
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            className="grid gap-3"
            aria-label={t('stepThema.ariaLabel')}
          >
            {themen.map((thema) => {
              const inputId = `thema-${thema.id}`
              const active = field.value === thema.id
              const beschreibung = lokalBeschreibung(thema, sprache)
              return (
                <Label
                  key={thema.id}
                  htmlFor={inputId}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-accent/50',
                    active && 'border-primary bg-accent/40 ring-2 ring-primary/30',
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <RadioGroupItem value={thema.id} id={inputId} />
                    {lokalName(thema, sprache)}
                  </span>
                  {beschreibung && (
                    <span className="pl-6 text-sm font-normal text-muted-foreground">
                      {beschreibung}
                    </span>
                  )}
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
