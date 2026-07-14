// Wizard-Schritt 5: Herkunft. Bundesland nur bei Land=Deutschland (BUNDESLAENDER
// aus src/lib/types.ts), Einrichtungstyp aus `einrichtungstypen` (aktiv=true).

import { useFormContext, useWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from './form'
import { BUNDESLAENDER } from '@/lib/types'
import type { Einrichtungstyp } from '@/lib/types'
import type { BuchungsFormValues } from '@/lib/booking-schema'

export function StepHerkunft({ einrichtungstypen }: { einrichtungstypen: Einrichtungstyp[] }) {
  const { control } = useFormContext<BuchungsFormValues>()
  const land = useWatch({ control, name: 'herkunft_land' })
  const istDeutschland = (land ?? '').trim().toLowerCase() === 'deutschland'

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={control}
          name="herkunft_land"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="herkunft_land">Land</FormLabel>
              <FormControl>
                <Input id="herkunft_land" className="h-11" autoComplete="country-name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {istDeutschland && (
          <FormField
            control={control}
            name="herkunft_bundesland"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="herkunft_bundesland">Bundesland</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger id="herkunft_bundesland" className="h-11">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BUNDESLAENDER.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <FormField
        control={control}
        name="herkunft_einrichtungstyp_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="herkunft_einrichtungstyp_id">Einrichtungstyp</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger id="herkunft_einrichtungstyp_id" className="h-11">
                  <SelectValue placeholder="Bitte wählen (optional)" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {einrichtungstypen.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={control}
          name="herkunft_einrichtungsname"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="herkunft_einrichtungsname">
                Name der Einrichtung <span className="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input id="herkunft_einrichtungsname" className="h-11" placeholder="z. B. Musterschule" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="herkunft_ort"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="herkunft_ort">
                Ort <span className="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input id="herkunft_ort" className="h-11" autoComplete="address-level2" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
