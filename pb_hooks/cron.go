// Package main — cron.go
//
// Scheduled background jobs (SPEC §4.4). The Verfall-Job expires open requests
// (status=verfallen) once they exceed einstellungen.anfrage_verfall_stunden,
// which frees the blocked capacity (SPEC §3.8).
package main

import (
	"log"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
)

// registerCron wires all cron jobs. Single wire-up point; called once from main().
func registerCron(app *pocketbase.PocketBase) {
	// Hourly: expire stale 'angefragt' bookings past the configured TTL.
	app.Cron().Add("anfrage-verfall", "0 * * * *", func() {
		cfg, _, err := ladeEinstellungen(app)
		if err != nil {
			log.Printf("[cron] anfrage-verfall: Einstellungen fehlen: %v", err)
			return
		}
		ttl := cfg.AnfrageVerfallStunden
		if ttl <= 0 {
			return
		}
		cutoff := time.Now().Add(-time.Duration(ttl) * time.Hour).UTC().Format(pbTimeLayout)
		recs, err := app.FindRecordsByFilter(
			"buchungen",
			"status = 'angefragt' && created < {:cutoff}",
			"", 0, 0,
			dbx.Params{"cutoff": cutoff},
		)
		if err != nil {
			log.Printf("[cron] anfrage-verfall: Abfrage fehlgeschlagen: %v", err)
			return
		}
		verfallen := 0
		for _, r := range recs {
			r.Set("status", "verfallen")
			if err := app.Save(r); err != nil {
				log.Printf("[cron] anfrage-verfall: %s konnte nicht gespeichert werden: %v", r.Id, err)
				continue
			}
			verfallen++
		}
		if verfallen > 0 {
			log.Printf("[cron] anfrage-verfall: %d Anfrage(n) auf 'verfallen' gesetzt", verfallen)
		}
	})
}
