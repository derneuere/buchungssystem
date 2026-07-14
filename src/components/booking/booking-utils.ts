// Hilfsfunktionen für den öffentlichen Buchungswizard: Datum/Zeit-Formatierung
// und die Zusammenführung von Kalendertag + Slot-Startzeit zu einem
// ISO-Datetime für `BuchungsanfrageInput.start`.

import { format, parse } from 'date-fns'
import { de } from 'date-fns/locale'

export const DATE_KEY_FORMAT = 'yyyy-MM-dd'
export const MONTH_KEY_FORMAT = 'yyyy-MM'

export function toDateKey(date: Date): string {
  return format(date, DATE_KEY_FORMAT)
}

export function toMonthKey(date: Date): string {
  return format(date, MONTH_KEY_FORMAT)
}

export function parseDateKey(key: string): Date {
  return parse(key, DATE_KEY_FORMAT, new Date())
}

export function formatDateLong(key: string): string {
  if (!key) return ''
  try {
    return format(parseDateKey(key), 'EEEE, d. MMMM yyyy', { locale: de })
  } catch {
    return key
  }
}

/**
 * Baut aus Kalendertag ("yyyy-MM-dd") + Slot-Startzeit ("HH:mm") ein
 * ISO-Datetime für den Request-Body.
 *
 * Abweichung von SPEC.md §2.1: Die SPEC sieht eine feste Konvertierung über
 * `date-fns-tz` (Europe/Berlin) vor. Das Paket ist in diesem Projekt nicht
 * installiert und darf laut Auftrag nicht nachinstalliert werden. Stattdessen
 * wird Datum+Uhrzeit als lokale Zeit im Browser der/des Anfragenden
 * interpretiert (bei Besuchenden aus Deutschland i.d.R. deckungsgleich mit
 * Europe/Berlin). Die serverseitige Slot-/Kapazitätsprüfung (SPEC §3.8,
 * Race-Recheck in der Transaktion) bleibt so oder so die Wahrheitsquelle;
 * ein DST-Kantenfall führt bestenfalls zu einem 409 statt einer stillen
 * Fehlbuchung.
 */
export function buildStartIso(datum: string, hhmm: string): string {
  const [hoursRaw, minutesRaw] = hhmm.split(':')
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  const date = parseDateKey(datum)
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)
  return date.toISOString()
}
