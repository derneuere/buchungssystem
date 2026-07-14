# Buchungssystem Gedenkstätte Deutscher Widerstand
# Single-Container-Build für Coolify: TanStack-Start-SPA (statisch) + Custom
# PocketBase (Go). PocketBase serviert /api/*, /_/ (Admin) und / (SPA aus
# pb_public) auf EINEM Port (8090). Eine Domain, Coolify/Traefik macht TLS.
#
# RAM-schonend gebaut (kleiner VPS):
#   - Frontend: NODE_OPTIONS begrenzt den V8-Heap.
#   - Go: -p=1 serialisiert die Paket-Kompilierung (größter Hebel),
#     GOMEMLIMIT gibt ein weiches Speicherlimit, GOGC=50 sammelt aggressiver.
# Build-Kontext = Repo-Root.

# ============================================================
# 1. Frontend-Build (Vite 8 / TanStack Start SPA, React 19)
# ============================================================
FROM node:22-alpine AS frontend
WORKDIR /app

# Deps zuerst -> npm-Layer bleibt über Source-Edits gecacht.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Minimaler Satz Dateien, den der Build braucht.
COPY tsconfig.json tsr.config.json vite.config.ts components.json ./
COPY src/ src/
COPY public/ public/

# SPA-Bau -> .output/public/ (statischer Ordner, kein Node-Runtime nötig).
# Der PocketBase-Client fällt zur Laufzeit auf window.location.origin zurück
# (same-origin), daher hier KEINE VITE_PB_URL setzen.
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# ============================================================
# 2. Backend-Build (Go + PocketBase)  -> statisches Binary
# ============================================================
FROM golang:1.24-alpine AS backend
WORKDIR /src

COPY pb_hooks/go.mod pb_hooks/go.sum ./
RUN go mod download

COPY pb_hooks/ ./

ENV CGO_ENABLED=0 \
    GOFLAGS="-p=1" \
    GOGC=50 \
    GOMEMLIMIT=512MiB
RUN go build -ldflags="-s -w" -trimpath -o /out/buchung .

# ============================================================
# 3. Runtime (schlankes Alpine)
# ============================================================
FROM alpine:3.20
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata curl
ENV TZ=Europe/Berlin

# Binary + statische SPA. PocketBase serviert pb_public/ automatisch als Root
# (SPA-Deep-Links via indexFallback -> index.html, siehe static.go).
COPY --from=backend  /out/buchung       /app/buchung
COPY --from=frontend /app/.output/public /app/pb_public

# Persistenter State (Coolify-Volume mountet hier: SQLite + Uploads).
RUN mkdir -p /app/pb_data
VOLUME ["/app/pb_data"]

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8090/api/health || exit 1

# `serve` wendet offene Migrationen beim Start an und startet den HTTP-Server.
CMD ["/app/buchung", "serve", "--http=0.0.0.0:8090", "--dir=/app/pb_data"]
