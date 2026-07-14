// Client-seitige Spiegelung der Bedarfsformel (SPEC §3.3/E5), NUR für die
// Anzeige des Bedarfs-Badges „x von y" ohne zusätzlichen Server-Roundtrip.
// Die verbindliche Berechnung bleibt serverseitig (`adminVorschlag`,
// `adminBestaetigen`) — diese Funktion dient ausschließlich der UI-Anzeige.

import type { Angebotsart } from './types'

export function berechneBenoetigteReferenten(
  angebotsart: Angebotsart | undefined | null,
  gruppengroesse: number,
): number {
  if (!angebotsart) return 1
  const basis = angebotsart.min_referenten && angebotsart.min_referenten > 0 ? angebotsart.min_referenten : 1
  if (!angebotsart.betreuungsschluessel || angebotsart.betreuungsschluessel <= 0) return basis
  return Math.max(basis, Math.ceil(gruppengroesse / angebotsart.betreuungsschluessel))
}
