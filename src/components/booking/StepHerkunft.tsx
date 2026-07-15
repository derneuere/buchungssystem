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
import { BUNDESLAENDER, lokalName } from '@/lib/types'
import type { Einrichtungstyp } from '@/lib/types'
import { useSprache } from '@/lib/sprache'
import { istDeutschlandLand, type BuchungsFormValues } from '@/lib/booking-schema'

export function StepHerkunft({ einrichtungstypen }: { einrichtungstypen: Einrichtungstyp[] }) {
  const { control } = useFormContext<BuchungsFormValues>()
  const { t, sprache } = useSprache()
  const land = useWatch({ control, name: 'herkunft_land' })
  const istDeutschland = istDeutschlandLand(land)

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={control}
          name="herkunft_land"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="herkunft_land">{t('stepHerkunft.land')}</FormLabel>
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
                <FormLabel htmlFor="herkunft_bundesland">{t('stepHerkunft.bundesland')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger id="herkunft_bundesland" className="h-11">
                      <SelectValue placeholder={t('common.pleaseSelect')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BUNDESLAENDER.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {sprache === 'en' ? b.label_en : b.label}
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
            <FormLabel htmlFor="herkunft_einrichtungstyp_id">
              {t('stepHerkunft.einrichtungstyp')}
            </FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger id="herkunft_einrichtungstyp_id" className="h-11">
                  <SelectValue placeholder={t('common.pleaseSelectOptional')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {einrichtungstypen.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {lokalName(e, sprache)}
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
                {t('stepHerkunft.einrichtungsname')}{' '}
                <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
              </FormLabel>
              <FormControl>
                <Input
                  id="herkunft_einrichtungsname"
                  className="h-11"
                  placeholder={t('stepHerkunft.einrichtungsnamePh')}
                  {...field}
                />
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
                {t('stepHerkunft.ort')}{' '}
                <span className="font-normal text-muted-foreground">{t('common.optional')}</span>
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
