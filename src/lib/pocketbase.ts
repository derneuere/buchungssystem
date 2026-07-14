import PocketBase from 'pocketbase'

/**
 * PocketBase-Client.
 *
 * Produktion: PocketBase serviert die SPA aus pb_public → same-origin
 * (`window.location.origin`). Entwicklung: Vite läuft auf :3000, PocketBase auf
 * :8090 → per `VITE_PB_URL=http://127.0.0.1:8090` (in .env) überschreiben.
 */
function resolveUrl(): string {
  const env = import.meta.env.VITE_PB_URL as string | undefined
  if (env) return env
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'http://127.0.0.1:8090'
}

export const pb = new PocketBase(resolveUrl())

// Auto-Cancellation aus: wir steuern Requests bewusst über react-query.
pb.autoCancellation(false)

export function isAuthenticated(): boolean {
  return pb.authStore.isValid && pb.authStore.record?.collectionName === 'mitarbeiter'
}
