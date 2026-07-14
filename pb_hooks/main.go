// Package main — main.go
//
// Thin wiring layer for the Buchungssystem der Gedenkstätte Deutscher
// Widerstand (SPEC §4.4). main() builds the PocketBase app, registers the
// dev-only automigrate command, and calls each cluster's single register
// function. The actual routes/hooks/cron/services live in their own
// same-package files (routes_public.go, routes_admin_buchungen.go,
// routes_admin_reports.go, service_*.go, hooks_mail.go, cron.go, static.go).
package main

import (
	"log"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	// Embed the IANA tz database so Europe/Berlin resolves regardless of host
	// OS (the container also ships tzdata; this makes dev + tests portable).
	_ "time/tzdata"

	// Register schema + seed migrations on init.
	_ "buchung/migrations"
)

func main() {
	app := pocketbase.New()

	// Automigrate only in dev (go run) so schema-file generation is a comfort
	// feature; production `serve` still applies pending migrations on start.
	isGoRun := strings.HasPrefix(os.Args[0], os.TempDir())
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: isGoRun,
	})

	// Each cluster owns its own register function (split, don't centralize).
	registerPublicRoutes(app)         // routes_public.go
	registerAdminBuchungenRoutes(app) // routes_admin_buchungen.go
	registerAdminReportRoutes(app)    // routes_admin_reports.go
	registerMailHooks(app)            // hooks_mail.go — buchungen create-guard
	registerCron(app)                 // cron.go — Verfall-Job
	registerStaticServing(app)        // static.go — SPA + CSP (zuletzt)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
