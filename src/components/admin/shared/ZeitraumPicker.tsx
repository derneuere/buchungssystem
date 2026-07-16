// Einheitlicher Von/Bis-Datumsbereich fürs Admin-Panel (Spec docs/ZEITRAUM-PICKER.md).
// Ein Trigger-Button öffnet ein Popover mit Presets + Bereichskalender
// (react-day-picker v8, mode="range"). Wert nach außen als "yyyy-MM-dd"-Paar.

import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns'
import { de } from 'date-fns/locale'

import { cn } from '@/lib/utils'
import { formatDatumsbereich } from '@/lib/admin-format'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type Zeitraum = { von?: string; bis?: string } // 'yyyy-MM-dd', lokal (≈ Europe/Berlin)

export type ZeitraumPreset = { label: string; bereich: () => Required<Zeitraum> }

type ZeitraumPickerProps = {
  id?: string
  value: Zeitraum
  onChange: (z: Zeitraum) => void
  /** Presets in der linken Spalte des Popovers; [] blendet die Spalte aus. */
  presets?: ZeitraumPreset[]
  /** true: „Zurücksetzen" im Popover, leerer Zustand erlaubt (Filter). Default false (Pflichtbereich). */
  clearable?: boolean
  placeholder?: string // Default: 'Zeitraum wählen'
  className?: string
}

// "yyyy-MM-dd" ↔ Date (Browser-Lokalzeit, wie tagKey in admin-format.ts).
const toKey = (d: Date) => format(d, 'yyyy-MM-dd')
const fromKey = (s: string) => parseISO(s)

// Zeitraum → DateRange-Draft für react-day-picker (from Pflicht, to optional).
function toRange(z: Zeitraum): DateRange | undefined {
  if (!z.von && !z.bis) return undefined
  const from = z.von ? fromKey(z.von) : z.bis ? fromKey(z.bis) : undefined
  if (!from) return undefined
  return { from, to: z.bis ? fromKey(z.bis) : undefined }
}

export function ZeitraumPicker({
  id,
  value,
  onChange,
  presets = [],
  clearable = false,
  placeholder = 'Zeitraum wählen',
  className,
}: ZeitraumPickerProps) {
  const [offen, setOffen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>(() => toRange(value))

  const leer = !value.von && !value.bis

  // Popover öffnen: Draft frisch aus dem aktuellen Wert übernehmen.
  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(toRange(value))
      setOffen(true)
      return
    }
    // Schließen: unvollständigen Draft ({from} ohne {to}) je nach Modus committen.
    if (draft?.from && !draft.to) {
      const von = toKey(draft.from)
      commit(clearable ? { von } : { von, bis: von })
    }
    setOffen(false)
  }

  // `onChange` nur bei echter Änderung feuern.
  function commit(z: Zeitraum) {
    if (z.von === value.von && z.bis === value.bis) return
    onChange(z)
  }

  function handleSelect(range: DateRange | undefined) {
    setDraft(range)
    // Vollständiger Bereich (react-day-picker ordnet from/to chronologisch):
    // committen und schließen.
    if (range?.from && range.to) {
      commit({ von: toKey(range.from), bis: toKey(range.to) })
      setOffen(false)
    }
  }

  function handlePreset(p: ZeitraumPreset) {
    const b = p.bereich()
    setDraft({ from: fromKey(b.von), to: fromKey(b.bis) })
    commit(b)
    setOffen(false)
  }

  function handleReset() {
    setDraft(undefined)
    commit({})
    setOffen(false)
  }

  const beschriftung = formatDatumsbereich(value.von, value.bis)

  return (
    <Popover open={offen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          className={cn('w-full justify-start text-left font-normal', leer && 'text-muted-foreground', className)}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="truncate">{leer ? placeholder : beschriftung}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          {presets.length > 0 && (
            <div className="flex flex-col gap-1 border-b p-2 sm:border-b-0 sm:border-r">
              {presets.map((p) => (
                <Button
                  key={p.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start font-normal"
                  onClick={() => handlePreset(p)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          )}
          <div>
            <Calendar
              mode="range"
              selected={draft}
              onSelect={handleSelect}
              numberOfMonths={2}
              locale={de}
              defaultMonth={value.von ? fromKey(value.von) : new Date()}
            />
            {clearable && !leer && (
              <div className="border-t p-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
                  Zurücksetzen
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Presets für Buchungslisten (Blick nach vorn), Wochenstart Montag.
export const BUCHUNGS_PRESETS: ZeitraumPreset[] = [
  { label: 'Heute', bereich: () => ({ von: toKey(new Date()), bis: toKey(new Date()) }) },
  {
    label: 'Diese Woche',
    bereich: () => ({
      von: toKey(startOfWeek(new Date(), { weekStartsOn: 1 })),
      bis: toKey(endOfWeek(new Date(), { weekStartsOn: 1 })),
    }),
  },
  {
    label: 'Dieser Monat',
    bereich: () => ({ von: toKey(startOfMonth(new Date())), bis: toKey(endOfMonth(new Date())) }),
  },
  { label: 'Nächste 30 Tage', bereich: () => ({ von: toKey(new Date()), bis: toKey(addDays(new Date(), 30)) }) },
  {
    label: 'Dieses Jahr',
    bereich: () => ({ von: toKey(startOfYear(new Date())), bis: toKey(endOfYear(new Date())) }),
  },
]

// Presets für Auswertungen (Blick zurück).
export const REPORT_PRESETS: ZeitraumPreset[] = [
  { label: 'Letzte 30 Tage', bereich: () => ({ von: toKey(subDays(new Date(), 30)), bis: toKey(new Date()) }) },
  { label: 'Letzte 6 Monate', bereich: () => ({ von: toKey(subMonths(new Date(), 6)), bis: toKey(new Date()) }) },
  { label: 'Dieses Jahr', bereich: () => ({ von: toKey(startOfYear(new Date())), bis: toKey(new Date()) }) },
  {
    label: 'Letztes Jahr',
    bereich: () => ({
      von: toKey(startOfYear(subYears(new Date(), 1))),
      bis: toKey(endOfYear(subYears(new Date(), 1))),
    }),
  },
]
