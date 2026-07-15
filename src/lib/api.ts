import { pb } from './pocketbase'
import type {
  AdminBuchungInput,
  AuskunftBuchung,
  AuskunftBuchungDetail,
  BuchungsanfrageInput,
  BuchungsanfrageResponse,
  HerkunftReportZeile,
  IstErfassungInput,
  KandidatenResult,
  PruefeResult,
  ReferentenAuslastungZeile,
  Rolle,
  SlotsResponse,
  SollIstReport,
  TagStatus,
  TestDatenZaehler,
  TestStatus,
  VorschlagResult,
} from './types'

/**
 * Typed-Wrapper um die Custom-Go-Routen der PocketBase (docs/SPEC.md §4).
 * `pb.send` hängt automatisch die baseURL an und setzt bei Admin-Routen den
 * Authorization-Header aus dem authStore.
 */

// ---- Öffentlich -----------------------------------------------------------

export function getVerfuegbarkeitTage(params: {
  angebotsart_id: string
  thema_id: string
  monat: string // YYYY-MM
  gruppengroesse: number
}): Promise<TagStatus[]> {
  return pb.send('/api/public/verfuegbarkeit/tage', { method: 'GET', query: params })
}

export function getVerfuegbarkeitSlots(params: {
  angebotsart_id: string
  thema_id: string
  datum: string // YYYY-MM-DD
  gruppengroesse: number
}): Promise<SlotsResponse> {
  return pb.send('/api/public/verfuegbarkeit/slots', { method: 'GET', query: params })
}

export function submitBuchungsanfrage(
  body: BuchungsanfrageInput,
): Promise<BuchungsanfrageResponse> {
  return pb.send('/api/public/buchungsanfrage', { method: 'POST', body })
}

// ---- Admin: Buchungen -----------------------------------------------------

export function adminVorschlag(buchungId: string): Promise<VorschlagResult> {
  return pb.send(`/api/admin/buchungen/${buchungId}/vorschlag`, { method: 'POST' })
}

export function adminReferentPruefen(
  buchungId: string,
  referentId: string,
): Promise<PruefeResult> {
  return pb.send(`/api/admin/buchungen/${buchungId}/referenten/pruefe`, {
    method: 'POST',
    body: { referentId },
  })
}

/** Referent:innen-Kandidaten für eine Buchung inkl. Auslastungs-Kennzahlen. */
export function adminReferentenKandidaten(buchungId: string): Promise<KandidatenResult> {
  return pb.send(`/api/admin/buchungen/${buchungId}/referenten-kandidaten`, { method: 'GET' })
}

export interface BestaetigenWarnung {
  warnung: true
  geplant: number
  benoetigt: number
  min: number
  unterbesetzt: boolean
  raum_offen: boolean
  kollision: boolean
}

export function adminBestaetigen(
  buchungId: string,
  body: { raum_id?: string; trotzdem?: boolean; grund?: string } = {},
): Promise<{ status: string; unterbesetzt?: boolean; raum_offen?: boolean }> {
  return pb.send(`/api/admin/buchungen/${buchungId}/bestaetigen`, {
    method: 'POST',
    body,
  })
}

export function adminAblehnen(
  buchungId: string,
  body: { grund: string; grund_an_kunde_senden: boolean },
): Promise<{ status: string }> {
  return pb.send(`/api/admin/buchungen/${buchungId}/ablehnen`, { method: 'POST', body })
}

export function adminStornieren(
  buchungId: string,
  body: { grund: string },
): Promise<{ status: string }> {
  return pb.send(`/api/admin/buchungen/${buchungId}/stornieren`, {
    method: 'POST',
    body,
  })
}

/** Manuelle/telefonische Erfassung einer Buchung durch das Personal. */
export function adminBuchungAnlegen(
  body: AdminBuchungInput,
): Promise<{ id: string; status: string }> {
  return pb.send('/api/admin/buchungen', { method: 'POST', body })
}

/**
 * Feld-whitelistende Ist-Erfassung (alle drei Rollen). Ersetzt die früheren
 * Direkt-Writes auf buchungen/buchung_referenten. Setzt ausschließlich
 * teilnehmer_ist, status→durchgefuehrt sowie eingesetzt-Toggles/spontane
 * Vertretungen.
 */
export function adminIstErfassung(
  buchungId: string,
  body: IstErfassungInput,
): Promise<{ ok: true }> {
  return pb.send(`/api/admin/buchungen/${buchungId}/ist`, { method: 'POST', body })
}

// ---- Auskunft: projizierte Read-Ansicht ----------------------------------
// Serverseitig auf status IN (bestaetigt, durchgefuehrt) gefiltert und auf die
// erlaubten Felder projiziert (keine E-Mail/Herkunft/Nachricht/Notizen).

export function auskunftBuchungen(params?: {
  von?: string
  bis?: string
}): Promise<AuskunftBuchung[]> {
  return pb.send('/api/auskunft/buchungen', { method: 'GET', query: params ?? {} })
}

export function auskunftBuchung(id: string): Promise<AuskunftBuchungDetail> {
  return pb.send(`/api/auskunft/buchungen/${id}`, { method: 'GET' })
}

// ---- Admin: Reports -------------------------------------------------------

export function reportHerkunft(params: {
  von: string
  bis: string
  gruppieren_nach: 'bundesland' | 'land' | 'einrichtungstyp'
  status?: string
}): Promise<HerkunftReportZeile[]> {
  return pb
    .send('/api/admin/reports/herkunft', { method: 'GET', query: params })
    .then((r: { gruppen?: HerkunftReportZeile[] }) => r.gruppen ?? [])
}

export function reportSollIst(params: {
  von: string
  bis: string
}): Promise<SollIstReport> {
  return pb.send('/api/admin/reports/soll-ist', { method: 'GET', query: params })
}

export function reportReferentenAuslastung(params: {
  von: string
  bis: string
  referent_id?: string
}): Promise<ReferentenAuslastungZeile[]> {
  return pb
    .send('/api/admin/reports/referenten-auslastung', { method: 'GET', query: params })
    .then((r: { referenten?: ReferentenAuslastungZeile[] }) => r.referenten ?? [])
}

// ---- Admin: Mitarbeiter-Einladung ----------------------------------------

export function mitarbeiterEinladen(body: {
  email: string
  rolle: Rolle
}): Promise<{ id: string; email: string; rolle: string; link: string }> {
  return pb.send('/api/admin/mitarbeiter/einladen', { method: 'POST', body })
}

export function einladungPruefen(params: {
  id: string
  token: string
}): Promise<{ valid: boolean; email?: string }> {
  return pb.send('/api/public/einladung', { method: 'GET', query: params })
}

export function einladungAnnehmen(body: {
  id: string
  token: string
  name: string
  password: string
}): Promise<{ email: string }> {
  return pb.send('/api/public/einladung/annehmen', { method: 'POST', body })
}

// ---- QA-/Testmodus --------------------------------------------------------
// Alle Routen liefern 404, wenn der Server ohne TEST_MODE läuft (Produktion),
// und sind zusätzlich hinter mitarbeiter-Auth. `pb.send` wirft dann — die
// Aufrufer (useTestStatus) behandeln das als „kein Testmodus".

export function testStatus(): Promise<TestStatus> {
  return pb.send('/api/test/status', { method: 'GET' })
}

export function testSetJetzt(body: {
  datum?: string // YYYY-MM-DD (Berlin-lokal, tagesgenau)
  iso?: string // ISO-Datetime (sekundengenau)
  reset?: boolean // true → zurück auf Echtzeit
}): Promise<TestStatus> {
  return pb.send('/api/test/jetzt', { method: 'POST', body })
}

export function testSeed(): Promise<TestDatenZaehler> {
  return pb.send('/api/test/seed', { method: 'POST' })
}

export function testReset(): Promise<TestDatenZaehler> {
  return pb.send('/api/test/reset', { method: 'POST' })
}

export function testVerfall(): Promise<{ verfallen: number }> {
  return pb.send('/api/test/cron/verfall', { method: 'POST' })
}

/** QA-Rollen-Override: eigene wirksame Rolle temporär umschalten. */
export function testSetRolle(rolle: Rolle): Promise<TestStatus> {
  return pb.send('/api/test/rolle', { method: 'POST', body: { rolle } })
}

/** QA-Rollen-Override zurücksetzen (immer erreichbar, auch als auskunft). */
export function testResetRolle(): Promise<TestStatus> {
  return pb.send('/api/test/rolle/reset', { method: 'POST' })
}
