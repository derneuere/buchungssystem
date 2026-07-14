// Wizard-Schritt 6: Kontaktdaten + Pflicht-Checkbox Datenschutz.

import { useFormContext, useWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from './form'
import type { BuchungsFormValues } from '@/lib/booking-schema'

const NACHRICHT_MAX = 1000

export function StepKontakt() {
  const { control } = useFormContext<BuchungsFormValues>()
  const nachricht = useWatch({ control, name: 'nachricht' })

  return (
    <div className="space-y-5">
      <FormField
        control={control}
        name="kontakt_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="kontakt_name">Name</FormLabel>
            <FormControl>
              <Input id="kontakt_name" className="h-11" autoComplete="name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={control}
          name="kontakt_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="kontakt_email">E-Mail</FormLabel>
              <FormControl>
                <Input
                  id="kontakt_email"
                  type="email"
                  className="h-11"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="kontakt_telefon"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="kontakt_telefon">
                Telefon <span className="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input
                  id="kontakt_telefon"
                  type="tel"
                  className="h-11"
                  autoComplete="tel"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="nachricht"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="nachricht">
              Anmerkungen <span className="font-normal text-muted-foreground">(optional)</span>
            </FormLabel>
            <FormControl>
              <Textarea id="nachricht" rows={4} maxLength={NACHRICHT_MAX} {...field} />
            </FormControl>
            <FormDescription>{(nachricht ?? '').length}/{NACHRICHT_MAX} Zeichen</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="datenschutz_zugestimmt"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <FormControl>
                <Checkbox
                  id="datenschutz_zugestimmt"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5 h-5 w-5"
                />
              </FormControl>
              <FormLabel htmlFor="datenschutz_zugestimmt" className="cursor-pointer text-sm font-normal leading-relaxed">
                Ich habe die{' '}
                <a
                  href="/datenschutz"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Datenschutzerklärung
                </a>{' '}
                zur Kenntnis genommen und bin mit der Verarbeitung meiner Daten zur Bearbeitung
                dieser Anfrage einverstanden.
              </FormLabel>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
