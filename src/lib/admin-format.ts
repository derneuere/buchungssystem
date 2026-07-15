// Formatierungs-Helfer für das Admin-Panel (Datum/Zeit, Enums, Fehler).
// Gleiche Zeitzonen-Konvention wie `src/components/booking/booking-utils.ts`:
// `date-fns-tz` ist nicht installiert und darf laut Auftrag nicht
// nachinstalliert werden; Datum/Zeit werden im Browser-Lokalzeit-Kontext
// formatiert (bei Personal in Deutschland deckungsgleich mit Europe/Berlin).

import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { BUNDESLAENDER, STATUS_LABEL, WOCHENTAGE, type Bundesland, type BuchungStatus, type Wochentag } from './types'

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '–'
  try {
    return format(parseISO(iso), 'dd.MM.yyyy, HH:mm', { locale: de }) + ' Uhr'
  } catch {
    return iso
  }
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '–'
  try {
    return format(parseISO(iso), 'dd.MM.yyyy', { locale: de })
  } catch {
    return iso
  }
}

export function formatDateLong(iso?: string | null): string {
  if (!iso) return '–'
  try {
    return format(parseISO(iso), 'EEEE, d. MMMM yyyy', { locale: de })
  } catch {
    return iso
  }
}

export function formatTime(iso?: string | null): string {
  if (!iso) return '–'
  try {
    return format(parseISO(iso), 'HH:mm', { locale: de }) + ' Uhr'
  } catch {
    return iso
  }
}

export function formatZeitraum(startIso?: string | null, endeIso?: string | null): string {
  if (!startIso) return '–'
  const start = formatDateTime(startIso)
  if (!endeIso) return start
  try {
    const ende = format(parseISO(endeIso), 'HH:mm', { locale: de })
    return `${start}–${ende} Uhr`
  } catch {
    return start
  }
}

export function formatDauer(minuten?: number | null): string {
  if (!minuten && minuten !== 0) return '–'
  const h = Math.floor(minuten / 60)
  const m = minuten % 60
  if (h === 0) return `${m} Min.`
  if (m === 0) return `${h} Std.`
  return `${h} Std. ${m} Min.`
}

/**
 * Kalendertag-Schlüssel ("yyyy-MM-dd") in Browser-Lokalzeit (≈ Europe/Berlin).
 * Für tages- statt uhrzeitgenaue Vergleiche (z. B. Ist-Erfassung ab dem
 * Termintag, nicht erst ab der Termin-Uhrzeit). Lexikografischer Vergleich der
 * Rückgabe entspricht dem chronologischen.
 */
export function tagKey(value: Date | string): string {
  const d = typeof value === 'string' ? parseISO(value) : value
  return format(d, 'yyyy-MM-dd')
}

/** Für `<input type="date">`-Wertebindung: ISO-Datetime -> "yyyy-MM-dd". */
export function toDateInputValue(iso?: string | null): string {
  if (!iso) return ''
  try {
    return format(parseISO(iso), 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

/** Für `<input type="datetime-local">`-Wertebindung: ISO-Datetime -> "yyyy-MM-ddTHH:mm". */
export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return ''
  try {
    return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
  } catch {
    return ''
  }
}

/** Lokalen Datums-String ("yyyy-MM-dd") in ISO-Datetime (Tagesbeginn) wandeln. */
export function dateInputToIso(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString()
}

/** Lokalen `datetime-local`-String in ISO-Datetime wandeln. */
export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString()
}

export function statusLabel(status: BuchungStatus): string {
  return STATUS_LABEL[status] ?? status
}

export function bundeslandLabel(value?: Bundesland | string | null): string {
  if (!value) return '–'
  return BUNDESLAENDER.find((b) => b.value === value)?.label ?? value
}

export function wochentagLabel(value?: Wochentag | string | null): string {
  if (!value) return '–'
  return WOCHENTAGE.find((w) => w.value === value)?.label ?? value
}

/** Badge-Farbklassen je Buchungsstatus (Ergänzung zu den shadcn-Badge-Varianten). */
export const STATUS_BADGE_CLASS: Record<BuchungStatus, string> = {
  angefragt: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  warteliste: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
  bestaetigt:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  abgelehnt: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
  storniert: 'border-muted bg-muted text-muted-foreground',
  verfallen: 'border-muted bg-muted text-muted-foreground',
  durchgefuehrt:
    'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300',
}
