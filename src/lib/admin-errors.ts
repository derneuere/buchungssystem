// Fehler-Helfer fürs Admin-Panel: einheitliche, deutsche Toast-Nachrichten aus
// PocketBase-`ClientResponseError`s (und sonstigen Fehlern) extrahieren.

import { ClientResponseError } from 'pocketbase'

/**
 * Liefert eine möglichst sprechende, deutsche Fehlermeldung.
 * PocketBase-Feldfehler (`response.data.<feld>.message`) werden bevorzugt
 * ausgelesen, da `err.message` oft nur "Failed to create record." o.ä. ist.
 */
export function getErrorMessage(err: unknown, fallback = 'Ein Fehler ist aufgetreten.'): string {
  if (err instanceof ClientResponseError) {
    const data = err.response?.data as Record<string, { message?: string }> | undefined
    if (data && typeof data === 'object') {
      const firstFieldError = Object.values(data).find((v) => v && typeof v.message === 'string')
      if (firstFieldError?.message) return firstFieldError.message
    }
    const topMessage = (err.response as { message?: string } | undefined)?.message
    if (topMessage && topMessage !== 'Failed to create record.' && topMessage !== 'Failed to update record.') {
      return topMessage
    }
    if (err.status === 400) return fallback
    if (err.status === 401 || err.status === 403) return 'Keine Berechtigung für diese Aktion.'
    if (err.status === 404) return 'Datensatz wurde nicht gefunden.'
    if (err.status === 0 || err.isAbort) return 'Verbindung zum Server fehlgeschlagen.'
    return err.message || fallback
  }
  if (err instanceof Error) return err.message || fallback
  return fallback
}

/** Hinweis für den häufigsten Lösch-Fehlerfall: Datensatz ist noch referenziert. */
export function getDeleteErrorMessage(err: unknown, bezeichnung = 'Datensatz'): string {
  if (err instanceof ClientResponseError && (err.status === 400 || err.status === 409)) {
    return `${bezeichnung} kann nicht gelöscht werden, da er noch verwendet wird. Bitte stattdessen deaktivieren.`
  }
  return getErrorMessage(err, `${bezeichnung} konnte nicht gelöscht werden.`)
}
