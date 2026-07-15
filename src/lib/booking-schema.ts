// zod-Schema für den öffentlichen Buchungswizard (docs/SPEC.md §5.1).
// Ein zusammenhängendes Schema für das gesamte Formular; pro Schritt wird nur
// eine Teilmenge der Felder validiert (siehe STEP_FIELDS + `trigger()` im
// Wizard). Das `max` für die Gruppengröße ist dynamisch aus der gewählten
// Angebotsart abgeleitet (E11 in SPEC.md), daher ist das Schema als Factory
// (`buildBuchungsSchema`) statt als statische Konstante modelliert.

import { z } from 'zod'
import type { Angebotsart } from './types'

/** Sanity-Obergrenze, falls (noch) keine Angebotsart gewählt/geladen ist. */
const FALLBACK_MAX_GRUPPENGROESSE = 200

/** Übersetzungsfunktion (siehe src/lib/sprache.tsx). Default = Identität (Key). */
type TFunc = (key: string, params?: Record<string, string | number>) => string
const identity: TFunc = (k) => k

/** Land-Freitext, der die Bundesland-Pflicht auslöst (DE + EN Schreibweise). */
const DEUTSCHLAND_ALIASES = ['deutschland', 'germany']

export function istDeutschlandLand(land: string | undefined): boolean {
  return DEUTSCHLAND_ALIASES.includes((land ?? '').trim().toLowerCase())
}

export function buildBuchungsSchema(angebotsart?: Angebotsart | null, t: TFunc = identity) {
  const min =
    angebotsart?.min_teilnehmer && angebotsart.min_teilnehmer > 0
      ? angebotsart.min_teilnehmer
      : 1
  const max = angebotsart?.max_teilnehmer ?? FALLBACK_MAX_GRUPPENGROESSE

  return z
    .object({
      // Schritt 1
      angebotsart_id: z.string().min(1, t('validation.angebotsart')),

      // Schritt 2
      thema_id: z.string().min(1, t('validation.thema')),

      // Schritt 3 (Gruppengröße vor Termin, da Verfügbarkeit davon abhängt)
      gruppengroesse: z.coerce
        .number({ error: t('validation.gruppeReq') })
        .int(t('validation.gruppeInt'))
        .min(min, t('validation.gruppeMin', { min }))
        .max(max, t('validation.gruppeMax', { max })),

      // Schritt 4
      datum: z.string().min(1, t('validation.datum')),
      slot_start: z.string().min(1, t('validation.slot')),
      slot_ende: z.string().min(1, t('validation.slot')),

      // Schritt 5 (Herkunft)
      herkunft_land: z.string().min(1, t('validation.land')).max(100),
      herkunft_bundesland: z.string().optional().or(z.literal('')),
      herkunft_einrichtungstyp_id: z.string().optional().or(z.literal('')),
      herkunft_einrichtungsname: z.string().max(200).optional().or(z.literal('')),
      herkunft_ort: z.string().max(200).optional().or(z.literal('')),

      // Schritt 6 (Kontakt)
      kontakt_name: z.string().min(1, t('validation.kontaktName')).max(200),
      kontakt_email: z
        .string()
        .min(1, t('validation.emailReq'))
        .email(t('validation.emailInvalid')),
      kontakt_telefon: z.string().max(50).optional().or(z.literal('')),
      nachricht: z.string().max(1000, t('validation.nachrichtMax')).optional().or(z.literal('')),
      datenschutz_zugestimmt: z.boolean().refine((v) => v === true, {
        message: t('validation.datenschutz'),
      }),

      // Spam-Schutz (E10/§4.3) — transient, nicht persistiert
      firma_website: z.string().max(0).optional().or(z.literal('')),
      formular_geladen_ts: z.number().optional(),
    })
    .superRefine((val, ctx) => {
      if (istDeutschlandLand(val.herkunft_land) && !val.herkunft_bundesland) {
        ctx.addIssue({
          code: 'custom',
          path: ['herkunft_bundesland'],
          message: t('validation.bundesland'),
        })
      }
    })
}

export type BuchungsFormValues = z.infer<ReturnType<typeof buildBuchungsSchema>>

export function defaultBuchungsFormValues(sprache: 'de' | 'en' = 'de'): BuchungsFormValues {
  return {
    angebotsart_id: '',
    thema_id: '',
    // Leerer String statt 0, damit das Zahlenfeld nicht vorbelegt erscheint;
    // z.coerce.number() validiert das beim Absenden des Schritts.
    gruppengroesse: '' as unknown as number,
    datum: '',
    slot_start: '',
    slot_ende: '',
    herkunft_land: sprache === 'en' ? 'Germany' : 'Deutschland',
    herkunft_bundesland: '',
    herkunft_einrichtungstyp_id: '',
    herkunft_einrichtungsname: '',
    herkunft_ort: '',
    kontakt_name: '',
    kontakt_email: '',
    kontakt_telefon: '',
    nachricht: '',
    datenschutz_zugestimmt: false,
    firma_website: '',
    formular_geladen_ts: Date.now(),
  }
}

/** Felder je Wizard-Schritt — Basis für `trigger(fieldsOfStep)`. */
export const STEP_FIELDS: Record<number, (keyof BuchungsFormValues)[]> = {
  1: ['angebotsart_id'],
  2: ['thema_id'],
  3: ['gruppengroesse'],
  4: ['datum', 'slot_start', 'slot_ende'],
  5: ['herkunft_land', 'herkunft_bundesland', 'herkunft_einrichtungstyp_id'],
  6: ['kontakt_name', 'kontakt_email', 'kontakt_telefon', 'nachricht', 'datenschutz_zugestimmt'],
  7: [],
}

export const STEP_TITLES = [
  'Angebotsart',
  'Thema',
  'Gruppengröße',
  'Wunschtermin',
  'Herkunft',
  'Kontaktdaten',
  'Zusammenfassung',
]

export const STEP_COUNT = STEP_TITLES.length

/** Ermittelt den Schritt, in dem ein gegebenes Feld liegt (für Fehler-Sprung). */
export function stepForField(field: string): number {
  for (const [step, fields] of Object.entries(STEP_FIELDS)) {
    if ((fields as string[]).includes(field)) return Number(step)
  }
  return 1
}
