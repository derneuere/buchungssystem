// Typen für PocketBase-Records und Custom-API-Contracts.
// Bezeichner deutsch, spiegeln docs/SPEC.md §2.3.

import type { Sprache } from './i18n'

export interface BaseRecord {
  id: string
  created: string
  updated: string
  collectionId?: string
  collectionName?: string
}

// ---- Enums / feste Wertelisten -------------------------------------------

export type Rolle = 'mitarbeiter' | 'leitung' | 'auskunft'

export type BuchungStatus =
  | 'angefragt'
  | 'warteliste'
  | 'bestaetigt'
  | 'abgelehnt'
  | 'storniert'
  | 'verfallen'
  | 'durchgefuehrt'

export type VerfuegbarkeitArt = 'verfuegbar' | 'gesperrt'
export type Wiederholung = 'einmalig' | 'woechentlich'
export type Wochentag = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so'
export type QuelleZuordnung = 'auto' | 'manuell'
export type TagStatusWert = 'frei' | 'knapp' | 'ausgebucht'

export const WOCHENTAGE: { value: Wochentag; label: string }[] = [
  { value: 'mo', label: 'Montag' },
  { value: 'di', label: 'Dienstag' },
  { value: 'mi', label: 'Mittwoch' },
  { value: 'do', label: 'Donnerstag' },
  { value: 'fr', label: 'Freitag' },
  { value: 'sa', label: 'Samstag' },
  { value: 'so', label: 'Sonntag' },
]

export type Bundesland =
  | 'baden_wuerttemberg'
  | 'bayern'
  | 'berlin'
  | 'brandenburg'
  | 'bremen'
  | 'hamburg'
  | 'hessen'
  | 'mecklenburg_vorpommern'
  | 'niedersachsen'
  | 'nordrhein_westfalen'
  | 'rheinland_pfalz'
  | 'saarland'
  | 'sachsen'
  | 'sachsen_anhalt'
  | 'schleswig_holstein'
  | 'thueringen'
  | 'ausland_oder_keine_angabe'

export const BUNDESLAENDER: { value: Bundesland; label: string; label_en: string }[] = [
  { value: 'baden_wuerttemberg', label: 'Baden-Württemberg', label_en: 'Baden-Württemberg' },
  { value: 'bayern', label: 'Bayern', label_en: 'Bavaria' },
  { value: 'berlin', label: 'Berlin', label_en: 'Berlin' },
  { value: 'brandenburg', label: 'Brandenburg', label_en: 'Brandenburg' },
  { value: 'bremen', label: 'Bremen', label_en: 'Bremen' },
  { value: 'hamburg', label: 'Hamburg', label_en: 'Hamburg' },
  { value: 'hessen', label: 'Hessen', label_en: 'Hesse' },
  {
    value: 'mecklenburg_vorpommern',
    label: 'Mecklenburg-Vorpommern',
    label_en: 'Mecklenburg-Western Pomerania',
  },
  { value: 'niedersachsen', label: 'Niedersachsen', label_en: 'Lower Saxony' },
  { value: 'nordrhein_westfalen', label: 'Nordrhein-Westfalen', label_en: 'North Rhine-Westphalia' },
  { value: 'rheinland_pfalz', label: 'Rheinland-Pfalz', label_en: 'Rhineland-Palatinate' },
  { value: 'saarland', label: 'Saarland', label_en: 'Saarland' },
  { value: 'sachsen', label: 'Sachsen', label_en: 'Saxony' },
  { value: 'sachsen_anhalt', label: 'Sachsen-Anhalt', label_en: 'Saxony-Anhalt' },
  { value: 'schleswig_holstein', label: 'Schleswig-Holstein', label_en: 'Schleswig-Holstein' },
  { value: 'thueringen', label: 'Thüringen', label_en: 'Thuringia' },
  {
    value: 'ausland_oder_keine_angabe',
    label: 'Ausland / keine Angabe',
    label_en: 'Abroad / no information',
  },
]

/** Bundesland-Label je Sprache (Fallback auf DE). */
export function bundeslandLabel(value: string | undefined, sprache: Sprache): string {
  const b = BUNDESLAENDER.find((x) => x.value === value)
  if (!b) return ''
  return sprache === 'en' ? b.label_en : b.label
}

/** Lokalisierter Name mit Fallback auf DE (`name`), falls kein `name_en`. */
export function lokalName(
  record: { name: string; name_en?: string } | null | undefined,
  sprache: Sprache,
): string {
  if (!record) return ''
  return sprache === 'en' && record.name_en?.trim() ? record.name_en : record.name
}

/** Lokalisierte Beschreibung mit Fallback auf DE (`beschreibung`). */
export function lokalBeschreibung(
  record: { beschreibung?: string; beschreibung_en?: string } | null | undefined,
  sprache: Sprache,
): string {
  if (!record) return ''
  return sprache === 'en' && record.beschreibung_en?.trim()
    ? record.beschreibung_en
    : (record.beschreibung ?? '')
}

export const STATUS_LABEL: Record<BuchungStatus, string> = {
  angefragt: 'Angefragt',
  warteliste: 'Warteliste',
  bestaetigt: 'Bestätigt',
  abgelehnt: 'Abgelehnt',
  storniert: 'Storniert',
  verfallen: 'Verfallen',
  durchgefuehrt: 'Durchgeführt',
}

// ---- Collection-Records ---------------------------------------------------

export interface Mitarbeiter extends BaseRecord {
  email: string
  name: string
  rolle: Rolle
  aktiv: boolean
  verified: boolean
}

export interface Thema extends BaseRecord {
  name: string
  name_en?: string
  beschreibung?: string
  beschreibung_en?: string
  sort_order?: number
  aktiv: boolean
}

export interface Einrichtungstyp extends BaseRecord {
  name: string
  name_en?: string
  sort_order?: number
  aktiv: boolean
}

export interface Referent extends BaseRecord {
  name: string
  email?: string
  telefon?: string
  themen: string[] // relation-IDs → themen
  aktiv: boolean
  notizen?: string
}

export interface Raum extends BaseRecord {
  name: string
  kapazitaet: number
  aktiv: boolean
  notizen?: string
}

export interface Angebotsart extends BaseRecord {
  name: string
  name_en?: string
  slug: string
  beschreibung?: string
  beschreibung_en?: string
  dauer_minuten: number
  benoetigt_raum: boolean
  min_teilnehmer?: number
  max_teilnehmer: number
  min_referenten: number
  betreuungsschluessel?: number
  zeitslots: string[] // ["10:00","12:00"]
  max_gruppen_parallel_pro_tag?: number
  sort_order?: number
  aktiv: boolean
}

export interface Verfuegbarkeit extends BaseRecord {
  referent: string
  art: VerfuegbarkeitArt
  wiederholung: Wiederholung
  start?: string
  ende?: string
  wochentag?: Wochentag
  zeit_von?: string
  zeit_bis?: string
  gueltig_ab?: string
  gueltig_bis?: string
  notiz?: string
}

export interface Buchung extends BaseRecord {
  status: BuchungStatus
  angebotsart: string
  thema: string
  start: string
  ende: string
  raum?: string
  teilnehmer_geplant: number
  teilnehmer_ist?: number
  herkunft_land: string
  herkunft_bundesland?: Bundesland
  herkunft_einrichtungstyp?: string
  herkunft_einrichtungsname?: string
  herkunft_ort?: string
  kontakt_name: string
  kontakt_email: string
  kontakt_telefon?: string
  nachricht?: string
  interne_notiz?: string
  planungs_notiz?: string
  planung_snapshot?: unknown
  storno_grund?: string
  ablehnungs_grund?: string
  spam_verdacht: boolean
  unterbesetzt?: boolean
  raum_offen?: boolean
  bestaetigt_trotz_grund?: string
  expand?: {
    angebotsart?: Angebotsart
    thema?: Thema
    raum?: Raum
    herkunft_einrichtungstyp?: Einrichtungstyp
  }
}

export interface BuchungReferent extends BaseRecord {
  buchung: string
  referent: string
  geplant: boolean
  eingesetzt: boolean
  quelle: QuelleZuordnung
  notiz?: string
  expand?: {
    referent?: Referent
    buchung?: Buchung
  }
}

export interface Einstellungen extends BaseRecord {
  puffer_minuten: number
  vorlaufzeit_tage_min: number
  vorlaufzeit_tage_max: number
  anfrage_verfall_stunden: number
  oeffnungstage: Wochentag[]
  betriebsende: string
  max_gruppen_parallel_pro_tag_default: number
  max_gruppengroesse_absolut: number
  team_benachrichtigung_email: string
}

export interface Schliesstag extends BaseRecord {
  datum: string
  grund?: string
}

// ---- Öffentliche API-Contracts -------------------------------------------

export interface TagStatus {
  datum: string // YYYY-MM-DD
  status: TagStatusWert
}

export interface SlotInfo {
  start: string // "HH:MM"
  ende: string // "HH:MM"
  buchbar: boolean
}

export interface SlotsResponse {
  slots: SlotInfo[]
}

/** Request-Body für POST /api/public/buchungsanfrage */
export interface BuchungsanfrageInput {
  angebotsart_id: string
  thema_id: string
  start: string // ISO-Datetime des gewählten Slots
  teilnehmer_geplant: number
  herkunft_land: string
  herkunft_bundesland?: Bundesland | ''
  herkunft_einrichtungstyp_id?: string
  herkunft_einrichtungsname?: string
  herkunft_ort?: string
  kontakt_name: string
  kontakt_email: string
  kontakt_telefon?: string
  nachricht?: string
  datenschutz_einwilligung: boolean
  // Spam-Schutz
  firma_website?: string // Honeypot (muss leer sein)
  formular_geladen_ts?: number
}

export interface BuchungsanfrageResponse {
  id: string
  status: BuchungStatus
  nachricht: string
}

/** Request-Body für POST /api/admin/buchungen (manuelle/telefonische Erfassung) */
export interface AdminBuchungInput {
  angebotsart_id: string
  thema_id: string
  start: string // ISO-Datetime
  teilnehmer_geplant: number
  herkunft_land: string
  herkunft_bundesland?: Bundesland | ''
  herkunft_einrichtungstyp_id?: string
  herkunft_einrichtungsname?: string
  herkunft_ort?: string
  kontakt_name: string
  kontakt_email: string
  kontakt_telefon?: string
  nachricht?: string
  interne_notiz?: string
}

// ---- Admin API-Contracts --------------------------------------------------

export interface ReferentVorschlag {
  id: string
  name: string
  auslastung?: number
}

export interface VorschlagResult {
  benoetigt: number
  vorschlag: ReferentVorschlag[]
  alternativen: ReferentVorschlag[]
  raumVorschlag: { id: string; name: string; kapazitaet: number } | null
  warnungen: string[]
}

export type Warnstufe = 'ok' | 'weich' | 'hart'

export interface ReferentKandidat {
  id: string
  name: string
  zugewiesen: boolean
  themaMatch: boolean
  verfuegbar: boolean
  konflikt: boolean
  warnstufe: Warnstufe
  einsaetze_tag: number
  einsaetze_woche: number
  einsaetze_gesamt: number
  auslastung_relativ: 'ueber' | 'schnitt' | 'unter'
}

export interface KandidatenResult {
  kandidaten: ReferentKandidat[]
  benoetigt: number
  geplant: number
  schnitt_gesamt: number
}

export interface PruefeResult {
  verfuegbar: boolean
  konflikt: boolean
  themaMatch: boolean
  warnstufe: Warnstufe
  hinweis?: string
}

// ---- Report-Contracts (Aggregationen) ------------------------------------

// GET /api/admin/reports/herkunft -> { gruppen: HerkunftReportZeile[] }
export interface HerkunftReportZeile {
  gruppe: string // Bundesland-/Einrichtungstyp-Label oder Land
  anzahl: number // Anzahl Buchungen in der Gruppe
  teilnehmer: number // Summe teilnehmer_ist (bzw. geplant, siehe Backend)
}

// GET /api/admin/reports/soll-ist
export interface SollIstMonat {
  monat: string // YYYY-MM
  teilnehmer_geplant: number
  teilnehmer_ist: number
  buchungen: number
}
export interface SollIstReport {
  teilnehmer_pro_monat: SollIstMonat[]
  referenten: {
    referenten_geplant: number
    referenten_eingesetzt: number
  }
}

// GET /api/admin/reports/referenten-auslastung -> { referenten: ReferentenAuslastungZeile[] }
export interface ReferentenAuslastungZeile {
  referent_id: string
  name: string
  einsaetze: number
  stunden: number
}

// ---- QA-/Testmodus (nur aktiv bei TEST_MODE, hinter mitarbeiter-Auth) ------

// GET /api/test/status, POST /api/test/jetzt
export interface TestStatus {
  test_mode: boolean
  jetzt: string // ISO UTC
  jetzt_berlin: string // "YYYY-MM-DD HH:mm"
  echt_jetzt: string // ISO UTC
  offset_sekunden: number
  aktiv: boolean // offset_sekunden != 0 → simuliertes Datum aktiv
  // QA-Rollen-Override (nur gesetzt, wenn ein mitarbeiter-Record vorliegt):
  rolle?: Rolle // wirksame (ggf. simulierte) Rolle
  qa_rolle_original?: string // echte Rolle während eines Override, sonst ""
  rolle_override_aktiv?: boolean // true, solange ein Override aktiv ist
}

// ---- Auskunfts-Ansicht (projizierte Read-Routen) --------------------------

// GET /api/auskunft/buchungen -> AuskunftBuchung[]
export interface AuskunftBuchung {
  id: string
  status: BuchungStatus
  start: string // ISO UTC
  ende: string // ISO UTC
  angebotsart: string // Name
  thema: string // Name
  raum: string | null // Name oder null
  teilnehmer_geplant: number
  teilnehmer_ist: number
  kontakt_name: string
  kontakt_telefon: string
}

export interface AuskunftReferent {
  zuordnung_id: string
  geplant: boolean
  eingesetzt: boolean
  referent: { name: string; telefon: string }
}

// GET /api/auskunft/buchungen/{id}
export interface AuskunftBuchungDetail extends AuskunftBuchung {
  referenten: AuskunftReferent[]
}

// POST /api/admin/buchungen/{id}/ist
export interface IstErfassungInput {
  teilnehmer_ist?: number
  durchgefuehrt?: boolean
  eingesetzt?: { zuordnung_id: string; eingesetzt: boolean }[]
  spontane_vertretung?: { referent_id: string }[]
}

// POST /api/test/seed, POST /api/test/reset
export interface TestDatenZaehler {
  bereits_vorhanden?: boolean
  referenten: number
  verfuegbarkeiten: number
  raeume: number
  themen_zugeordnet?: number
  themen?: number
  buchungen: number
  buchung_referenten: number
}
