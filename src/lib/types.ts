// Typen für PocketBase-Records und Custom-API-Contracts.
// Bezeichner deutsch, spiegeln docs/SPEC.md §2.3.

export interface BaseRecord {
  id: string
  created: string
  updated: string
  collectionId?: string
  collectionName?: string
}

// ---- Enums / feste Wertelisten -------------------------------------------

export type Rolle = 'mitarbeiter' | 'leitung'

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

export const BUNDESLAENDER: { value: Bundesland; label: string }[] = [
  { value: 'baden_wuerttemberg', label: 'Baden-Württemberg' },
  { value: 'bayern', label: 'Bayern' },
  { value: 'berlin', label: 'Berlin' },
  { value: 'brandenburg', label: 'Brandenburg' },
  { value: 'bremen', label: 'Bremen' },
  { value: 'hamburg', label: 'Hamburg' },
  { value: 'hessen', label: 'Hessen' },
  { value: 'mecklenburg_vorpommern', label: 'Mecklenburg-Vorpommern' },
  { value: 'niedersachsen', label: 'Niedersachsen' },
  { value: 'nordrhein_westfalen', label: 'Nordrhein-Westfalen' },
  { value: 'rheinland_pfalz', label: 'Rheinland-Pfalz' },
  { value: 'saarland', label: 'Saarland' },
  { value: 'sachsen', label: 'Sachsen' },
  { value: 'sachsen_anhalt', label: 'Sachsen-Anhalt' },
  { value: 'schleswig_holstein', label: 'Schleswig-Holstein' },
  { value: 'thueringen', label: 'Thüringen' },
  { value: 'ausland_oder_keine_angabe', label: 'Ausland / keine Angabe' },
]

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
  beschreibung?: string
  sort_order?: number
  aktiv: boolean
}

export interface Einrichtungstyp extends BaseRecord {
  name: string
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
  slug: string
  beschreibung?: string
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
