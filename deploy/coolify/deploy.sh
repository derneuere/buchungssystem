#!/usr/bin/env bash
# Idempotenter Coolify-Deploy für das Buchungssystem.
# Legt Projekt + Dockerfile-Application an (falls nicht vorhanden), setzt
# Domain, Env, Persistent-Storage und Health-Check und stößt den Deploy an.
#
# Voraussetzungen: curl, jq. Konfiguration über Env-Variablen:
#   COOLIFY_URL    (z.B. https://coolify.niaz.omg.lol)
#   COOLIFY_TOKEN  (API-Token, NICHT committen)
#   GIT_REPO       (z.B. https://github.com/derneuere/buchungssystem)
#   GIT_BRANCH     (default: main)
#   APP_DOMAIN     (default: https://buchung.niaz.omg.lol)
#   PROJECT_NAME   (default: "Buchung Gedenkstaette")
#   FRAME_ANCESTORS (optional, für CSP frame-ancestors)
set -euo pipefail

: "${COOLIFY_URL:?COOLIFY_URL fehlt}"
: "${COOLIFY_TOKEN:?COOLIFY_TOKEN fehlt}"
: "${GIT_REPO:?GIT_REPO fehlt}"
GIT_BRANCH="${GIT_BRANCH:-main}"
APP_DOMAIN="${APP_DOMAIN:-https://buchung.niaz.omg.lol}"
PROJECT_NAME="${PROJECT_NAME:-Buchung Gedenkstaette}"

API="$COOLIFY_URL/api/v1"
auth=(-H "Authorization: Bearer $COOLIFY_TOKEN" -H "Content-Type: application/json")

echo "» Server (Coolify-Host) ermitteln"
SERVER_UUID=$(curl -fsS "${auth[@]}" "$API/servers" | jq -r '.[] | select(.is_coolify_host==true) | .uuid' | head -1)
echo "  server_uuid=$SERVER_UUID"

echo "» Projekt sicherstellen: $PROJECT_NAME"
PROJECT_UUID=$(curl -fsS "${auth[@]}" "$API/projects" | jq -r --arg n "$PROJECT_NAME" '.[] | select(.name==$n) | .uuid' | head -1)
if [ -z "$PROJECT_UUID" ] || [ "$PROJECT_UUID" = "null" ]; then
  PROJECT_UUID=$(curl -fsS "${auth[@]}" -X POST "$API/projects" \
    -d "$(jq -n --arg n "$PROJECT_NAME" '{name:$n, description:"Buchungssystem Gedenkstaette Deutscher Widerstand"}')" | jq -r '.uuid')
  echo "  Projekt angelegt: $PROJECT_UUID"
else
  echo "  Projekt existiert: $PROJECT_UUID"
fi

echo "» Application sicherstellen"
APP_UUID=$(curl -fsS "${auth[@]}" "$API/applications" | jq -r --arg r "$GIT_REPO" '.[] | select(.git_repository==$r) | .uuid' | head -1)
if [ -z "$APP_UUID" ] || [ "$APP_UUID" = "null" ]; then
  APP_UUID=$(curl -fsS "${auth[@]}" -X POST "$API/applications/public" -d "$(jq -n \
    --arg p "$PROJECT_UUID" --arg s "$SERVER_UUID" --arg r "$GIT_REPO" --arg b "$GIT_BRANCH" --arg d "$APP_DOMAIN" \
    '{project_uuid:$p, server_uuid:$s, environment_name:"production",
      git_repository:$r, git_branch:$b, build_pack:"dockerfile",
      dockerfile_location:"/Dockerfile", base_directory:"/",
      ports_exposes:"8090", domains:$d,
      health_check_enabled:true, health_check_path:"/api/health", health_check_port:"8090",
      is_auto_deploy_enabled:true, instant_deploy:false}')" | jq -r '.uuid')
  echo "  Application angelegt: $APP_UUID"
else
  echo "  Application existiert: $APP_UUID"
fi

if [ -n "${FRAME_ANCESTORS:-}" ]; then
  echo "» Env EMBED_FRAME_ANCESTORS setzen"
  curl -fsS "${auth[@]}" -X POST "$API/applications/$APP_UUID/envs" \
    -d "$(jq -n --arg v "$FRAME_ANCESTORS" '{key:"EMBED_FRAME_ANCESTORS", value:$v, is_preview:false}')" >/dev/null || true
fi

echo "» Persistent Storage /app/pb_data sicherstellen"
curl -fsS "${auth[@]}" -X POST "$API/applications/$APP_UUID/storages" \
  -d "$(jq -n '{name:"buchung_data", mount_path:"/app/pb_data"}')" >/dev/null 2>&1 || echo "  (existiert bereits oder abweichendes Schema — im UI prüfen)"

echo "» Deploy anstoßen"
curl -fsS "${auth[@]}" "$API/deploy?uuid=$APP_UUID" | jq . || true

echo "✓ Fertig. App-UUID: $APP_UUID  Domain: $APP_DOMAIN"
