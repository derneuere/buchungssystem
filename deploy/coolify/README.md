# Deployment auf Coolify

Ziel: eine Instanz unter **`https://buchung.niaz.omg.lol`**. Ein Container aus
dem Root-`Dockerfile`; PocketBase serviert SPA + API + Admin auf Port `8090`,
Coolify/Traefik terminiert TLS.

## Variante A — Coolify-UI

1. **Projects → + New Resource → Public Repository**
   - Repository-URL: `https://github.com/<owner>/buchungssystem`
   - Branch: `main`
   - Build Pack: **Dockerfile**
   - Dockerfile Location: `/Dockerfile` (Standard), Base Directory: `/`
2. **Ports**: `Ports Exposes = 8090`.
3. **Domain**: im Tab *Domains* `https://buchung.niaz.omg.lol` eintragen —
   Coolify fordert das TLS-Zertifikat automatisch an (DNS muss auf den Host zeigen).
4. **Persistent Storage**: Volume `buchung_data` → Mount-Pfad `/app/pb_data`
   (SQLite-DB + Uploads; überlebt Re-Deploys).
5. **Environment Variables** (optional, siehe unten).
6. **Health Check**: Pfad `/api/health`, Port `8090`.
7. **Deploy** klicken. Erststart wendet die Migrationen an.

## Variante B — Coolify-API (skriptbar)

Siehe `deploy/coolify/deploy.sh` (idempotent): legt Projekt + Application
(build_pack=dockerfile) an, setzt Domain, Volume, Health-Check und stößt den
Deploy an. Benötigt `COOLIFY_TOKEN`.

## Environment-Variablen

| Name | Pflicht | Zweck |
|------|---------|-------|
| `EMBED_FRAME_ANCESTORS` | empfohlen | Kommagetrennte TYPO3-Domains, die das Formular per iFrame einbetten dürfen (CSP `frame-ancestors`). `self` ist immer erlaubt. |
| `SEED_ADMIN_EMAIL` | optional | Legt beim ersten Start einen `mitarbeiter`-Account an. |
| `SEED_ADMIN_PASSWORD` | optional | Passwort dazu. Danach entfernen. |

SMTP für Transaktionsmails wird im PocketBase-Admin (`/_/` → *Settings → Mail*)
gesetzt, nicht per Env.

## Nach dem ersten Deploy

1. **Superuser anlegen** (einmalig), via Coolify-Terminal des Containers:
   ```bash
   /app/buchung superuser create admin@buchung.niaz.omg.lol '<starkes-passwort>'
   ```
   Danach `https://buchung.niaz.omg.lol/_/` → Collection `mitarbeiter` → Account
   mit `rolle=mitarbeiter` anlegen (oder `SEED_ADMIN_*` beim Deploy nutzen).
2. **Admin-Login**: `https://buchung.niaz.omg.lol/admin`.
3. **Stammdaten pflegen**: Themen, Referenten (+ Kompetenzen + Verfügbarkeiten),
   Räume, Angebotsarten, Einstellungen.
4. **Einbetten**: Snippet aus [`../../docs/EINBETTUNG.md`](../../docs/EINBETTUNG.md)
   in TYPO3.

## Auto-Deploy

Coolify *Automatic Deployments* für `main` aktivieren → jeder Push baut & deployt
neu. Migrationen laufen beim Start (forward-only).

## RAM beim Bauen

Der Build ist bewusst sparsam: Node-Heap gedeckelt (`NODE_OPTIONS`), Go seriell
(`-p=1`, `GOMEMLIMIT=512MiB`, `GOGC=50`). Coolify-Server hier: `concurrent_builds=1`.

## Backup

```bash
docker exec <container> tar czf - -C /app pb_data > buchung-backup-$(date +%F).tar.gz
```
