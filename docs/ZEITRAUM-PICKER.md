# Spec: Einheitlicher Zeitraum-Picker („ZeitraumPicker")

Stand: 2026-07-16. Ziel: Alle Von/Bis-Datumsbereiche im Admin-Panel auf eine
gemeinsame, gut bedienbare Komponente standardisieren.

## 1. Ist-Zustand (Probleme)

| Ort | Heute | Probleme |
| --- | --- | --- |
| `src/routes/admin/_authenticated/buchungen/index.tsx` (Mitarbeiter-Liste, ~Z. 210–227) | 2× `<Input type="date">`, Labels „Zeitraum von" / „Zeitraum bis" | 2 Felder fressen Platz im Filter-Grid, keine Schnellauswahl, `von > bis` möglich |
| ebd. (Auskunfts-Liste, ~Z. 352–371) | 2× `<Input type="date">`, Labels „Zeitraum von" / „Zeitraum bis" | zusätzlich **doppelte DOM-IDs** `filter-von`/`filter-bis` (gleiche IDs wie in der Mitarbeiter-Liste) |
| `src/routes/admin/_authenticated/auswertungen.tsx` (~Z. 137–144) | 2× `<Input type="date">`, Labels nur „Von" / „Bis" | inkonsistente Beschriftung, keine Presets (typische Auswertungszeiträume), `von > bis` liefert leere Charts ohne Hinweis |
| `src/components/admin/VerfuegbarkeitenManager.tsx` (~Z. 318–334) | 2× `<Input type="date">`, „Gültig ab *" / „Gültig bis" | dritte Label-Variante, `bis < ab` möglich |

## 2. Ziel-UX (Entscheidung)

**Ein** Bedienelement pro Zeitraum statt zwei loser Felder: ein Trigger-Button
(shadcn-`Button variant="outline"`, `CalendarIcon` aus lucide) öffnet ein
`Popover` mit **Presets + Bereichskalender**. Begründung:

- Ein Klickziel, ein Wert („der Zeitraum") statt zwei koppelbarer Felder →
  `von ≤ bis` ist konstruktiv garantiert (Range-Selektion), nicht validiert.
- Presets decken die 90 %-Fälle mit einem Klick ab (Filter: kommende Termine;
  Auswertungen: vergangene Zeiträume).
- Offenes Ende („ab X" / „bis X") bleibt möglich — wichtig für die
  Buchungsfilter, deren URL-Params heute schon einseitig sein dürfen.

### 2.1 Neue Komponente `src/components/admin/ZeitraumPicker.tsx`

```ts
export type Zeitraum = { von?: string; bis?: string } // 'yyyy-MM-dd', lokal (≈ Europe/Berlin)

export type ZeitraumPreset = { label: string; bereich: () => Required<Zeitraum> }

type ZeitraumPickerProps = {
  id?: string
  value: Zeitraum
  onChange: (z: Zeitraum) => void
  /** Presets in der linken Spalte des Popovers; [] blendet die Spalte aus. */
  presets?: ZeitraumPreset[]
  /** true: „Zurücksetzen" im Popover, leerer Zustand erlaubt (Filter). Default false (Pflichtbereich). */
  clearable?: boolean
  placeholder?: string // Default: 'Zeitraum wählen'
  className?: string
}
```

**Trigger-Beschriftung** (Format `dd.MM.yyyy`, deutscher Locale):
- von+bis gesetzt: `01.05.2026 – 16.07.2026`; wenn `von === bis`: nur `01.05.2026`
- nur von: `ab 01.05.2026`
- nur bis: `bis 16.07.2026`
- leer: Placeholder in `text-muted-foreground`

**Popover-Inhalt:**
- Links (bei `presets.length > 0`): vertikale Preset-Liste, `Button
  variant="ghost" size="sm"`, linksbündig. Klick setzt den kompletten Bereich,
  feuert `onChange` und **schließt** das Popover. Auf schmalen Screens
  (`sm:`-Breakpoint) wandert die Spalte über den Kalender (flex-col → sm:flex-row).
- Rechts: `Calendar` (bestehende shadcn-Komponente, react-day-picker v8) mit
  `mode="range"`, `numberOfMonths={2}`, `locale={de}` (date-fns),
  `defaultMonth` = `von` (falls gesetzt, sonst heute). Die vorhandenen
  Calendar-classNames stapeln die zwei Monate auf Mobile bereits vertikal.
- Fußzeile: bei `clearable` und nicht-leerem Wert ein Button „Zurücksetzen"
  (`variant="ghost" size="sm"`), der `onChange({})` feuert und schließt.

**Selektions-/Commit-Logik** (wichtig, exakt so umsetzen):
- Während das Popover offen ist, wird die Auswahl als Draft gehalten
  (`DateRange` von react-day-picker), initialisiert aus `value`.
- 1. Kalender-Klick → Draft `{from}`; Popover bleibt offen.
- 2. Kalender-Klick → vollständiger Bereich (react-day-picker ordnet
  from/to selbst chronologisch), `onChange` + Popover schließen.
- Popover schließen mit unvollständigem Draft (`{from}` ohne `to`):
  - `clearable`: commit `{ von: from }` (offenes Ende — bewusst unterstützt)
  - nicht `clearable`: commit `{ von: from, bis: from }` (Ein-Tages-Bereich),
    damit Pflicht-Konsumenten (Auswertungen) nie einen halben Bereich sehen.
- Popover schließen ohne Änderung → kein `onChange`.
- `onChange` liefert immer `yyyy-MM-dd`-Strings (`format(d, 'yyyy-MM-dd')`,
  Browser-Lokalzeit; Konvention wie `tagKey` in `admin-format.ts`).

**Barrierefreiheit:** Trigger ist ein `<button>` mit `id` (für `<Label
htmlFor>`), `aria-haspopup="dialog"`; sichtbarer Text = aktuelle Auswahl.

### 2.2 Preset-Sets (in `ZeitraumPicker.tsx` exportieren)

Datumsmathematik mit date-fns, Wochenstart Montag (`{ locale: de }` bzw.
`weekStartsOn: 1`), alles Browser-Lokalzeit:

```ts
// Für Buchungslisten (Blick nach vorn):
export const BUCHUNGS_PRESETS: ZeitraumPreset[] = [
  'Heute',            // heute – heute
  'Diese Woche',      // startOfWeek(heute) – endOfWeek(heute)
  'Dieser Monat',     // startOfMonth – endOfMonth
  'Nächste 30 Tage',  // heute – addDays(heute, 30)
  'Dieses Jahr',      // startOfYear – endOfYear
]

// Für Auswertungen (Blick zurück):
export const REPORT_PRESETS: ZeitraumPreset[] = [
  'Letzte 30 Tage',   // subDays(heute, 30) – heute
  'Letzte 6 Monate',  // subMonths(heute, 6) – heute
  'Dieses Jahr',      // startOfYear – heute
  'Letztes Jahr',     // startOfYear(subYears(heute,1)) – endOfYear(subYears(heute,1))
]
```

### 2.3 Anzeige-Helfer

In `src/lib/admin-format.ts` neu (Achtung: `formatZeitraum` existiert bereits
für Datum+Uhrzeit-Spannen und bleibt unverändert):

```ts
/** 'yyyy-MM-dd'-Paar → 'dd.MM.yyyy – dd.MM.yyyy' | 'ab …' | 'bis …' | '–'. */
export function formatDatumsbereich(von?: string | null, bis?: string | null): string
```

Der ZeitraumPicker nutzt diesen Helfer für seine Trigger-Beschriftung.

## 3. Umbau der vier Einsatzorte

1. **Buchungen, Mitarbeiter-Filter** (`buchungen/index.tsx`): Die beiden
   Felder „Zeitraum von/bis" durch **einen** ZeitraumPicker ersetzen. Label:
   „Zeitraum". `clearable`, `presets={BUCHUNGS_PRESETS}`,
   `id="filter-zeitraum"`. Im Filter-Grid `lg:col-span-2` geben (der Button
   braucht Breite für „dd.MM.yyyy – dd.MM.yyyy"); Grid bleibt sonst wie es ist
   (Status/Angebotsart je 1 Zelle). Wert aus `search.von`/`search.bis`,
   `onChange` → `updateSearch({ von: z.von, bis: z.bis })` (undefined räumt
   die URL-Params auf, wie bisher).
2. **Buchungen, Auskunfts-Liste** (gleiche Datei): Card „Zeitraum" behält den
   Titel, Inhalt wird **ein** ZeitraumPicker (`id="auskunft-zeitraum"`, Label
   entfällt — der Card-Titel beschriftet), `clearable`,
   `presets={BUCHUNGS_PRESETS}`. Behebt nebenbei die doppelten IDs.
3. **Auswertungen** (`auswertungen.tsx`): Felder „Von"/„Bis" ersetzen durch
   einen ZeitraumPicker, Label „Zeitraum", **nicht** clearable,
   `presets={REPORT_PRESETS}`, `id="aw-zeitraum"`. State bleibt `von`/`bis`
   (Strings, Default weiterhin letzte 6 Monate); die Report-Queries bleiben
   unverändert (`yyyy-MM-dd` durchreichen, s. Kommentar im Code).
4. **Verfügbarkeiten** (`VerfuegbarkeitenManager.tsx`): Die Felder „Gültig ab
   *" / „Gültig bis" ersetzen durch einen ZeitraumPicker mit Label
   „Gültigkeit *" und `id="verf-gueltigkeit"`, `clearable` (offenes Ende =
   unbefristet gültig), `presets={[]}` (Presets ergeben hier keinen Sinn),
   `placeholder="Gültigkeit wählen"`. Mapping: `von ↔ form.gueltig_ab`,
   `bis ↔ form.gueltig_bis` (leer = unbefristet). Bestehende Pflicht-
   Validierung von `gueltig_ab` beim Speichern beibehalten. Achtung:
   Komponente liegt in einem `Dialog` — Popover-in-Dialog funktioniert mit
   den vorhandenen shadcn-Komponenten (Portal), keine Sonderbehandlung nötig,
   aber im Browser-Smoke-Test prüfen, falls möglich.

**Hinweis „Zurücksetzen" vs. Filter-Reset:** Falls die Buchungsliste bereits
einen globalen „Filter zurücksetzen"-Mechanismus hat, bleibt der unberührt;
das „Zurücksetzen" im Popover leert nur den Zeitraum.

## 4. Nicht-Ziele

- **Keine** Backend-/API-Änderungen; Query-/URL-Parameter (`von`, `bis`,
  `yyyy-MM-dd`) bleiben exakt wie heute.
- **Keine** neuen Dependencies (react-day-picker v8, date-fns, shadcn Popover/
  Calendar/Button sind vorhanden). Kein shadcn-CLI.
- Einzelne Datums-Felder (`Datum *` in Schließtage/Neue Buchung) bleiben
  native `<input type="date">` — sie sind keine Zeiträume.
- `src/components/ui/` nicht anfassen (bleibt default shadcn).

## 5. Verifikation (Definition of Done)

1. `NODE_OPTIONS=--max-old-space-size=2048 fnm exec --using=22 -- npm.cmd run build`
   läuft grün (Git-Bash; System-Node ist zu alt).
2. Kein `type="date"`-Paar für Zeiträume mehr im Admin-Code; alle vier
   Einsatzorte nutzen ZeitraumPicker; keine doppelten DOM-IDs mehr.
3. Spec-Konformität der Commit-Logik (Abschnitt 2.1) im Code nachvollziehbar:
   Draft-State, Verhalten bei unvollständigem Bereich je nach `clearable`,
   kein `onChange` beim Schließen ohne Änderung.
4. react-day-picker-**v8**-API korrekt verwendet (`mode="range"`,
   `selected: DateRange`, `onSelect`, `locale`, `numberOfMonths`,
   `defaultMonth`) — nicht die v9-API.
5. UI-Sprache Deutsch, deutsche Bezeichner, Datumsanzeige `dd.MM.yyyy`.
6. `docs/SPEC.md` §-Routen-Tabelle braucht keine Änderung (Filter bleiben
   funktional gleich); dieses Dokument ist die maßgebliche Spec für die
   Komponente.
