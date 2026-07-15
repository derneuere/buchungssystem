// Package main — cron.go
//
// Scheduled background jobs (SPEC §4.4). The Verfall-Job expires open requests
// (status=verfallen) once they exceed einstellungen.anfrage_verfall_stunden,
// which frees the blocked capacity (SPEC §3.8). Der Cutoff nutzt jetzt() (das
// „Geschäfts-Heute"), damit der QA-/Testmodus den Verfall ohne echtes Warten
// prüfbar macht; der Job-Rumpf ist als verfalleAbgelaufeneAnfragen extrahiert,
// sodass die Test-Route ihn teilen kann (routes_qa.go).
package main

import (
	"log"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// verfalleAbgelaufeneAnfragen setzt alle 'angefragt'-Buchungen, deren created
// älter als anfrage_verfall_stunden vor jetzt() liegt, auf 'verfallen'. Liefert
// die Anzahl der geänderten Datensätze. Wiederverwendbar aus Cron und Test-Route.
func verfalleAbgelaufeneAnfragen(app core.App) (int, error) {
	cfg, _, err := ladeEinstellungen(app)
	if err != nil {
		return 0, err
	}
	ttl := cfg.AnfrageVerfallStunden
	if ttl <= 0 {
		return 0, nil
	}
	cutoff := jetzt().Add(-time.Duration(ttl) * time.Hour).UTC().Format(pbTimeLayout)
	recs, err := app.FindRecordsByFilter(
		"buchungen",
		"status = 'angefragt' && created < {:cutoff}",
		"", 0, 0,
		dbx.Params{"cutoff": cutoff},
	)
	if err != nil {
		return 0, err
	}
	verfallen := 0
	for _, r := range recs {
		r.Set("status", "verfallen")
		if err := app.Save(r); err != nil {
			log.Printf("[verfall] %s konnte nicht gespeichert werden: %v", r.Id, err)
			continue
		}
		verfallen++
	}
	return verfallen, nil
}

// registerCron wires all cron jobs. Single wire-up point; called once from main().
func registerCron(app *pocketbase.PocketBase) {
	// Hourly: expire stale 'angefragt' bookings past the configured TTL.
	app.Cron().Add("anfrage-verfall", "0 * * * *", func() {
		n, err := verfalleAbgelaufeneAnfragen(app)
		if err != nil {
			log.Printf("[cron] anfrage-verfall: %v", err)
			return
		}
		if n > 0 {
			log.Printf("[cron] anfrage-verfall: %d Anfrage(n) auf 'verfallen' gesetzt", n)
		}
	})
}
