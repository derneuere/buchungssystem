// Package main — routes_public.go
//
// Public, unauthenticated endpoints (SPEC §4.1): health, availability (days +
// slots, anti-scraping — no exact counts) and the single Buchungsanfrage write
// path (E3) with body-limit, honeypot, timing heuristic, rate-limit, server
// validation, transactional capacity re-check and system-rights save.
package main

import (
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

const appVersion = "1.0.0"

// registerPublicRoutes wires all public routes. Single wire-up point; called
// once from main().
func registerPublicRoutes(app *pocketbase.PocketBase) {
	// Rate limiter for the write path: 5 / 10 min AND 20 / day per IP-hash.
	limiter := NewIPRateLimiter(5, 10*time.Minute, 20, 24*time.Hour)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// ---- Health ----------------------------------------------------
		// PocketBase registriert bereits ein eingebautes GET /api/health.
		// Keine eigene Route hier (sonst Pattern-Konflikt beim Serve-Start).

		// ---- Verfügbarkeit: Tage ---------------------------------------
		se.Router.GET("/api/public/verfuegbarkeit/tage", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query()
			angebotsartID := q.Get("angebotsart_id")
			themaID := q.Get("thema_id")
			monat := q.Get("monat")
			gruppe, _ := strconv.Atoi(q.Get("gruppengroesse"))
			if angebotsartID == "" || themaID == "" || monat == "" || gruppe < 1 {
				return e.JSON(http.StatusBadRequest, map[string]any{"error": "Fehlende oder ungültige Parameter."})
			}
			first, err := time.ParseInLocation("2006-01", monat, berlinLoc())
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]any{"error": "Ungültiges Monatsformat (YYYY-MM)."})
			}
			type tag struct {
				Datum  string `json:"datum"`
				Status string `json:"status"`
			}
			var out []tag
			for d := first; d.Month() == first.Month(); d = d.AddDate(0, 0, 1) {
				status, err := TagesStatus(app, angebotsartID, themaID, d, gruppe)
				if err != nil {
					log.Printf("[verfuegbarkeit/tage] %v", err)
					return e.JSON(http.StatusInternalServerError, map[string]any{"error": "Interner Fehler."})
				}
				out = append(out, tag{Datum: d.Format("2006-01-02"), Status: status})
			}
			return e.JSON(http.StatusOK, out)
		})

		// ---- Verfügbarkeit: Slots --------------------------------------
		se.Router.GET("/api/public/verfuegbarkeit/slots", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query()
			angebotsartID := q.Get("angebotsart_id")
			themaID := q.Get("thema_id")
			datumStr := q.Get("datum")
			gruppe, _ := strconv.Atoi(q.Get("gruppengroesse"))
			if angebotsartID == "" || themaID == "" || datumStr == "" || gruppe < 1 {
				return e.JSON(http.StatusBadRequest, map[string]any{"error": "Fehlende oder ungültige Parameter."})
			}
			datum, err := time.ParseInLocation("2006-01-02", datumStr, berlinLoc())
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]any{"error": "Ungültiges Datumsformat (YYYY-MM-DD)."})
			}
			slots, err := BerechneSlots(app, angebotsartID, themaID, datum, gruppe)
			if err != nil {
				log.Printf("[verfuegbarkeit/slots] %v", err)
				return e.JSON(http.StatusInternalServerError, map[string]any{"error": "Interner Fehler."})
			}
			return e.JSON(http.StatusOK, map[string]any{"slots": slots})
		})

		// ---- Buchungsanfrage (einziger Schreibpfad, E3) ----------------
		se.Router.POST("/api/public/buchungsanfrage", func(e *core.RequestEvent) error {
			// 1. Body-Limit ~10 KB.
			body, err := io.ReadAll(io.LimitReader(e.Request.Body, 10*1024+1))
			if err != nil {
				return e.JSON(http.StatusBadRequest, map[string]any{"error": "Ungültige Anfrage."})
			}
			if len(body) > 10*1024 {
				return e.JSON(http.StatusRequestEntityTooLarge, map[string]any{"error": "Anfrage zu groß."})
			}

			var req BuchungsanfrageRequest
			if err := jsonUnmarshal(body, &req); err != nil {
				return e.JSON(http.StatusBadRequest, map[string]any{"error": "Ungültiges JSON."})
			}

			// 2. Honeypot: gefülltes firma_website => Fake-Erfolg (kein Bot-Signal).
			if req.FirmaWebsite != "" {
				return e.JSON(http.StatusCreated, map[string]any{
					"status":   "angefragt",
					"nachricht": eingangsNachricht(),
				})
			}

			// 3. Zeit-Heuristik: Submit < 3 s nach Laden => Spam-Verdacht.
			spamVerdacht := false
			if req.FormularGeladenTS > 0 {
				deltaMs := time.Now().UnixMilli() - req.FormularGeladenTS
				if deltaMs >= 0 && deltaMs < 3000 {
					spamVerdacht = true
				}
			}

			// 5. Serverseitige Validierung.
			valid, fehler := ValidateBuchungsanfrage(app, &req)
			if fehler != nil {
				return e.JSON(http.StatusBadRequest, map[string]any{
					"error":  "Bitte prüfen Sie Ihre Eingaben.",
					"felder": fehler,
				})
			}

			// 6. Kapazitäts-Recheck + 7. Systemrechte-Save in einer Transaktion.
			var createdID string
			conflict := false
			txErr := app.RunInTransaction(func(txApp core.App) error {
				slots, err := BerechneSlots(txApp, req.AngebotsartID, req.ThemaID, valid.Start, req.TeilnehmerGeplant)
				if err != nil {
					return err
				}
				gesucht := minutesToHHMM(localMinutes(valid.Start))
				buchbar := false
				for _, s := range slots {
					if s.Start == gesucht {
						buchbar = s.Buchbar
						break
					}
				}
				if !buchbar {
					conflict = true
					return errors.New("kapazitaet nicht mehr verfuegbar")
				}

				col, err := txApp.FindCollectionByNameOrId("buchungen")
				if err != nil {
					return err
				}
				rec := core.NewRecord(col)
				rec.Set("status", "angefragt")
				rec.Set("angebotsart", req.AngebotsartID)
				rec.Set("thema", req.ThemaID)
				if sd, e1 := types.ParseDateTime(valid.Start); e1 == nil {
					rec.Set("start", sd)
				}
				if ed, e2 := types.ParseDateTime(valid.Ende); e2 == nil {
					rec.Set("ende", ed)
				}
				rec.Set("teilnehmer_geplant", req.TeilnehmerGeplant)
				rec.Set("herkunft_land", req.HerkunftLand)
				if req.HerkunftBundesland != "" {
					rec.Set("herkunft_bundesland", req.HerkunftBundesland)
				}
				if req.HerkunftEinrichtungstyp != "" {
					rec.Set("herkunft_einrichtungstyp", req.HerkunftEinrichtungstyp)
				}
				rec.Set("herkunft_einrichtungsname", req.HerkunftEinrichtungName)
				rec.Set("herkunft_ort", req.HerkunftOrt)
				rec.Set("kontakt_name", req.KontaktName)
				rec.Set("kontakt_email", req.KontaktEmail)
				rec.Set("kontakt_telefon", req.KontaktTelefon)
				rec.Set("nachricht", req.Nachricht)
				rec.Set("spam_verdacht", spamVerdacht)

				// System-rights save: setzt Superuser-Kontext (kein createRule-Bypass).
				if err := saveWithSystemContext(txApp, rec); err != nil {
					return err
				}
				createdID = rec.Id
				return nil
			})

			if conflict {
				return e.JSON(http.StatusConflict, map[string]any{
					"error": "Dieser Termin ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen.",
				})
			}
			if txErr != nil {
				log.Printf("[buchungsanfrage] %v", txErr)
				return e.JSON(http.StatusInternalServerError, map[string]any{"error": "Ihre Anfrage konnte nicht gespeichert werden."})
			}

			// 8./§4.5. Transaktionsmails — best effort, blockieren nie.
			if rec, err := app.FindRecordById("buchungen", createdID); err == nil {
				sendEingangsbestaetigung(app, rec)
				sendTeamBenachrichtigung(app, rec)
			}

			// Minimal-Response (keine internen Daten).
			return e.JSON(http.StatusCreated, map[string]any{
				"id":       createdID,
				"status":   "angefragt",
				"nachricht": eingangsNachricht(),
			})
		}).BindFunc(limiter.Middleware())

		return se.Next()
	})
}

func eingangsNachricht() string {
	return "Vielen Dank für Ihre Anfrage. Wir haben sie erhalten und melden uns nach Prüfung per E-Mail. Verbindlich wird die Buchung erst nach Bestätigung durch die Gedenkstätte."
}
