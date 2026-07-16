# CLAUDE.md — Projekt-Konventionen

Buchungssystem der Gedenkstätte Deutscher Widerstand. Vollständige Spezifikation:
`docs/SPEC.md`. UI-Sprache durchgängig **Deutsch**, Bezeichner (Collections,
Felder, Routen, JSON-Keys) **deutsch**.

## Stack
- Frontend: TanStack Start (SPA-Modus, statisch), React 19, Vite 8, TypeScript,
  Tailwind v4, **default shadcn/ui** (kein Custom-Theme), TanStack Query,
  react-hook-form + zod, sonner, recharts, date-fns, lucide-react.
- Backend: Custom PocketBase (Go, v0.36) in `pb_hooks/` (Modul `buchung`).
- Ein Container: PocketBase serviert SPA (pb_public) + `/api/*` + `/_/`.

## Build-/Dev-Kommandos (Windows, Git-Bash)
Das System-`node` ist v16 (zu alt) und System-`go` ist 1.13 (zu alt). Nutze:
- **Node 22 via fnm**, mit `npm.cmd`/`npx.cmd` hinter `fnm exec`:
  - Build: `NODE_OPTIONS=--max-old-space-size=2048 fnm exec --using=22 -- npm.cmd run build`
  - Routen neu generieren: `fnm exec --using=22 -- npm.cmd run generate-routes`
  - Dev: `fnm exec --using=22 -- npm.cmd run dev`
- **Go 1.26 portabel** unter
  `C:/Users/Niaz/AppData/Local/Temp/claude/C--Users-Niaz-buchungssystem/69a5da5b-a10d-4898-870a-836d86761a4c/scratchpad/gotc/go/bin/go.exe`
  (mit vollem Pfad aufrufen). Build im Backend: `CGO_ENABLED=0 "$GO" build ./...`.
- Frontend-Build-Output: `.output/public/` (statisch) → wird nach `pb_public/` kopiert.

## Struktur
- `src/routes/` — file-based routing. `index.tsx` (öffentlich), `embed.tsx`
  (chromeless, iFrame), `buchung/`, `admin/*` (mitarbeiter-Login).
  **Route-Dateien sind dünn**: Route-Definition, Search-Schema, Rollen-Weiche —
  Seiten-UI lebt in `src/components/admin/<feature>/`. Alt-URLs (z.B.
  `/admin/raeume`, `/admin/kalender`) bleiben als Redirect-Stubs erhalten.
- `src/components/ui/` — shadcn (bereits vorhanden, NICHT via CLI neu adden).
- `src/components/booking/` — öffentlicher Buchungs-Wizard.
- `src/components/admin/` — Feature-Ordner: `shell/` (AdminShell, RouteTabs),
  `shared/` (nur Bausteine mit ≥2 Feature-Nutzern: StatusBadge,
  ConfirmDeleteDialog, GrundDialog, ZeitraumPicker), `buchungen/`, `dashboard/`,
  `referenten/`, `stammdaten/` (generisches `StammdatenCrud` + Config-Tabs),
  `verwaltung/`.
- Tab-Seiten sind Kind-Routen: `/admin/stammdaten/<tab>` (Themen, Angebotsarten,
  Räume, Einrichtungstypen, Schließtage) und `/admin/verwaltung/<tab>`
  (Einstellungen, Mitarbeiter [nur Leitung], Einbetten); Buchungen-Liste und
  -Kalender teilen sich `/admin/buchungen` über den Search-Param `ansicht`.
- `src/lib/` — `pocketbase.ts` (`pb`), `api.ts` (Custom-Routen), `types.ts`
  (alle Record-/Contract-Typen), `query.ts` (QueryClient + `adminKeys`),
  `utils.ts` (`cn`).
- `pb_hooks/` — Go: `main.go`, `routes_*`, `service_*`, `migrations/`.

## Konventionen
- Datenzugriff: Stammdaten über `pb.collection(...)`, Custom-Logik über
  `src/lib/api.ts`. Toasts: `import { toast } from 'sonner'`.
- Same-origin in Produktion; in Dev `VITE_PB_URL=http://127.0.0.1:8090` (.env).
- Immer `generate-routes` nach dem Anlegen/Löschen von Route-Dateien; Build muss
  grün sein.
- Keine externen Fonts/Tracker (Datenschutz + Embed).
