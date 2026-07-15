# Kapazitätshandling — Umgang mit Unterbesetzung & fehlendem Raum

Umgesetzte Entscheidungen (auf Basis eines Best-Practice-Research-Workflows).
**Leitprinzip:** Integritätsverletzung ≠ Kapazitätsengpass. Nur *physisch
unmögliche* Zustände hart blockieren; *Personal-/Raum-Prognosen* mit Warnung +
bewusstem Override zulassen und sichtbar kennzeichnen.

## Status- & Feldmodell (Migration `0004_kapazitaet.go`)

- Neuer Status **`warteliste`** — Halte-Zustand, den der Verfall-Cron NICHT
  anfasst (offen halten, ohne dass die Anfrage automatisch verfällt). Das gilt
  auch für den manuell auslösbaren Verfall-Lauf im Testmodus
  (`POST /api/test/cron/verfall`, siehe `docs/SPEC.md` §4.9): er verwendet
  denselben Job und lässt `warteliste` ebenfalls unangetastet.
- **`unterbesetzt`** (bool): weniger geplante Referent:innen als benötigt.
- **`raum_offen`** (bool): Angebot benötigt Raum, aber noch keiner vergeben
  (provisorisch bestätigt).
- **`bestaetigt_trotz_grund`** (text): Pflicht-Begründung beim Override; wird
  zusätzlich an die interne Notiz angehängt.

## Bestätigen-Flow (`POST /api/admin/buchungen/:id/bestaetigen`)

**Genau ein harter Block:** ein *gewählter* Raum ist zur Terminzeit belegt →
`409`, auch mit `trotzdem` nicht überschreibbar (Alternativraum wählen).

Alles andere ist eine **Warnung** (`422`) und per `{trotzdem:true, grund}`
überschreibbar:

| Fall | Verhalten |
|---|---|
| `geplant >= benoetigt`, Raum ok | direkt bestätigt |
| `geplant < benoetigt` (inkl. 0) | 422 → Override(Grund) → `unterbesetzt=true` |
| Raum benötigt, keiner gewählt | 422 → Override → `raum_offen=true` (provisorisch) |
| zugeordnete Person hat Kollision | 422 → Override(Grund) |
| **gewählter Raum belegt** | **409, kein Override** |

Ablauf im Frontend (`BestaetigenDialog`): erster Versuch ohne `trotzdem`; bei
`422` erscheint ein Warnhinweis mit den Details (x von y, Raum offen, Kollision)
und ein Pflicht-Grund-Feld; „Trotzdem bestätigen" sendet `{trotzdem, grund}`.
Bestätigte Buchungen mit Lücke zeigen im Detail/der Liste Badges **„Unterbesetzt"**
bzw. **„Raum offen"**.

> **Rollen-Hinweis (RBAC, Migration `0007`):** Bestätigen und „Trotzdem
> bestätigen" sind **Personal-Aktionen** (Rollen `leitung`/`mitarbeiter`). Die
> Rolle `auskunft` kann Buchungen weder bestätigen noch bearbeiten; sie sieht nur
> bereits bestätigte/durchgeführte Termine und trägt den Ist-Zustand ein. Die
> vollständige Rechte-Übersicht steht in `docs/BENUTZERHANDBUCH.md` Kap. 7.2 bzw.
> der In-App-Hilfe.

## Auto-Zuordnung

`SchlageReferentenVor` liefert Best-Effort inkl. Teil-Zuordnung, Alternativen,
Raumvorschlag und Warnungen — blockiert nie leer.

## Manuelle/telefonische Buchung (`POST /api/admin/buchungen`)

Personal kann Buchungen selbst erfassen (weichere Prüfung als der öffentliche
Weg: keine Verfügbarkeits-Sperre, aber valide Stammdaten). Kapazitätslücken
werden erst beim Bestätigen als Warnung sichtbar. Route implementiert in
`pb_hooks/routes_admin_buchung_manuell.go`, Guard `requireRolle("mitarbeiter",
"leitung")` — nur Personal, nicht `auskunft` (siehe `docs/SPEC.md` §4.7).

## Benötigte Referent:innen

`benoetigt = max(min_referenten, ceil(gruppengroesse / betreuungsschluessel))`
je Angebotsart konfigurierbar.
