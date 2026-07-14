# Buchungssystem – Gedenkstätte Deutscher Widerstand

Online-Buchungssystem für kostenfreie **Führungen** und **Seminare** der
Gedenkstätte Deutscher Widerstand. Ersetzt das bisher manuell bearbeitete
TYPO3-Kontaktformular durch ein sicheres, einbettbares Anfrage-Tool plus ein
Admin-Panel für Referentenplanung, Buchungsverwaltung und Auswertungen.

## Architektur

Ein Binary, ein Container, ein Port (`8090`), **eine Domain**
(`buchung.niaz.omg.lol`). PocketBase serviert alles same-origin:

```
Traefik (TLS) ─► PocketBase (Go, :8090)
                   ├─ /            SPA aus pb_public (TanStack Start, statisch)
                   ├─ /embed       chromeloses Formular fürs iFrame
                   ├─ /admin/*      Admin-SPA (mitarbeiter-Login)
                   ├─ /api/*        REST + Custom-Routen (Verfügbarkeit, Buchung, Reports)
                   └─ /_/*          PocketBase-Superuser (Notfall/Migrationen)
```

- **Frontend:** TanStack Start (SPA-Modus, rein statisch), React 19, Vite 8,
  Tailwind v4, **default shadcn/ui**, TanStack Query, react-hook-form + zod,
  recharts, sonner. Quelle unter `src/`.
- **Backend:** Custom PocketBase (Go, v0.36) unter `pb_hooks/`. Migrations,
  Custom-Routen, Planungs-/Verfügbarkeitslogik, Rate-Limit, Mails, Cron.
- **Deployment:** Multi-Stage-`Dockerfile` (Root), RAM-schonend. Coolify baut
  aus dem Git-Repo und deployt einen Container.

Vollständige Spezifikation: [`docs/SPEC.md`](docs/SPEC.md).
TYPO3-Einbettung: [`docs/EINBETTUNG.md`](docs/EINBETTUNG.md).

## Entwicklung

Voraussetzungen: **Node ≥ 22**, **Go ≥ 1.24** (für das Backend).

```bash
# Frontend
npm install
npm run dev            # Vite auf http://127.0.0.1:3000

# Backend (separates Terminal)
cd pb_hooks
go run . serve --http=127.0.0.1:8090   # wendet Migrationen an, serviert /api

# In der Entwicklung zeigt der Client per .env auf den PB-Port:
#   VITE_PB_URL=http://127.0.0.1:8090
```

Erststart: unter `http://127.0.0.1:8090/_/` einen Superuser anlegen, dann in der
Collection `mitarbeiter` einen Account (rolle=`mitarbeiter`) erstellen, um sich
im Admin-Panel (`/admin`) einzuloggen. Alternativ `SEED_ADMIN_EMAIL` +
`SEED_ADMIN_PASSWORD` beim ersten Start setzen.

## Build & Produktion

```bash
npm run build          # -> .output/public/  (statische SPA)
# Der Dockerfile-Build kopiert .output/public nach pb_public und baut das
# Go-Binary; PocketBase serviert dann beides.

docker build -t buchung:local .
docker run --rm -p 8090:8090 -v buchung_data:/app/pb_data buchung:local
# http://127.0.0.1:8090/
```

Deployment auf Coolify: siehe [`deploy/coolify/README.md`](deploy/coolify/README.md).

## Projektstruktur

```
src/                TanStack-Start-App (Routen, Komponenten, lib)
  routes/           index (öffentlich), embed, buchung/, admin/*
  components/ui/    shadcn/ui
  components/booking/, components/admin/
  lib/              pocketbase.ts, api.ts, types.ts, query.ts, utils.ts
public/             statische Assets + embed.js (Loader für TYPO3)
pb_hooks/           Custom PocketBase (Go): main.go, routes_*, service_*, migrations/
docs/               SPEC.md, EINBETTUNG.md
Dockerfile          Multi-Stage (Frontend + Go + Runtime)
```
