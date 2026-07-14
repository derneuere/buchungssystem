import { pb } from './pocketbase'
import type {
  BuchungsanfrageInput,
  BuchungsanfrageResponse,
  HerkunftReportZeile,
  PruefeResult,
  ReferentenAuslastungZeile,
  SlotsResponse,
  SollIstReport,
  TagStatus,
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

export function adminBestaetigen(
  buchungId: string,
  body: { raum_id?: string } = {},
): Promise<{ status: string }> {
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
