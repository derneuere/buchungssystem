// Package main — routes_admin_buchungen.go
//
// Authenticated booking-workflow endpoints (SPEC §4.1), all behind
// apis.RequireAuth("mitarbeiter"): vorschlag, referenten/pruefe, bestaetigen,
// ablehnen, stornieren.
package main

import (
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func registerAdminBuchungenRoutes(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		auth := apis.RequireAuth("mitarbeiter")
		// Buchungs-Workflow ist Personal-vorbehalten (auskunft ausgeschlossen).
		personal := requireRolle("mitarbeiter", "leitung")

		// ---- Vorschlag -------------------------------------------------
		se.Router.POST("/api/admin/buchungen/{id}/vorschlag", func(e *core.RequestEvent) error {
			b, err := app.FindRecordById("buchungen", e.Request.PathValue("id"))
			if err != nil || b == nil {
				return apis.NewNotFoundError("Buchung nicht gefunden.", nil)
			}
			res, err := SchlageReferentenVor(app, b, nil)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Vorschlag konnte nicht berechnet werden.", nil)
			}
			// planung_snapshot (Audit): vorgeschlagene IDs + Zeitstempel.
			ids := make([]string, 0, len(res.Vorschlag))
			for _, v := range res.Vorschlag {
				ids = append(ids, v.ID)
			}
			b.Set("planung_snapshot", map[string]any{
				"referenten": ids,
				"zeitpunkt":  time.Now().UTC().Format(time.RFC3339),
			})
			if err := app.Save(b); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Snapshot konnte nicht gespeichert werden.", nil)
			}
			return e.JSON(http.StatusOK, res)
		}).Bind(auth).BindFunc(personal)

		// ---- Referent live prüfen --------------------------------------
		se.Router.POST("/api/admin/buchungen/{id}/referenten/pruefe", func(e *core.RequestEvent) error {
			b, err := app.FindRecordById("buchungen", e.Request.PathValue("id"))
			if err != nil || b == nil {
				return apis.NewNotFoundError("Buchung nicht gefunden.", nil)
			}
			var body struct {
				ReferentID string `json:"referentId"`
			}
			if err := e.BindBody(&body); err != nil || body.ReferentID == "" {
				return apis.NewBadRequestError("referentId fehlt.", nil)
			}
			ref, err := app.FindRecordById("referenten", body.ReferentID)
			if err != nil || ref == nil {
				return apis.NewNotFoundError("Referent nicht gefunden.", nil)
			}
			start := b.GetDateTime("start").Time()
			von := localMinutes(start)
			bis := localMinutes(b.GetDateTime("ende").Time())

			verfuegbar, err := IstVerfuegbar(app, ref.Id, start, von, bis)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Prüfung fehlgeschlagen.", nil)
			}
			e2, _, err := ladeEinstellungen(app)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Prüfung fehlgeschlagen.", nil)
			}
			konflikt, err := HatKollision(app, ref.Id, start, von, bis, e2.PufferMinuten, b.Id)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Prüfung fehlgeschlagen.", nil)
			}
			themaMatch := enthaelt(ref.GetStringSlice("themen"), b.GetString("thema"))

			warnstufe := "ok"
			if konflikt {
				warnstufe = "hart"
			} else if !verfuegbar || !themaMatch {
				warnstufe = "weich"
			}
			return e.JSON(http.StatusOK, map[string]any{
				"verfuegbar": verfuegbar,
				"konflikt":   konflikt,
				"themaMatch": themaMatch,
				"warnstufe":  warnstufe,
			})
		}).Bind(auth).BindFunc(personal)

		// ---- Bestätigen ------------------------------------------------
		se.Router.POST("/api/admin/buchungen/{id}/bestaetigen", func(e *core.RequestEvent) error {
			b, err := app.FindRecordById("buchungen", e.Request.PathValue("id"))
			if err != nil || b == nil {
				return apis.NewNotFoundError("Buchung nicht gefunden.", nil)
			}
			var body struct {
				RaumID   string `json:"raum_id"`
				Trotzdem bool   `json:"trotzdem"`
				Grund    string `json:"grund"`
			}
			_ = e.BindBody(&body)

			cfg, _, err := ladeEinstellungen(app)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Konfiguration fehlt.", nil)
			}
			ang, err := app.FindRecordById("angebotsarten", b.GetString("angebotsart"))
			if err != nil || ang == nil {
				return apis.NewApiError(http.StatusInternalServerError, "Angebotsart fehlt.", nil)
			}
			start := b.GetDateTime("start").Time()
			von := localMinutes(start)
			bis := localMinutes(b.GetDateTime("ende").Time())

			zuordnungen, err := app.FindRecordsByFilter("buchung_referenten",
				"buchung = {:b} && geplant = true", "", 0, 0, dbx.Params{"b": b.Id})
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Zuordnungen konnten nicht geladen werden.", nil)
			}
			geplant := len(zuordnungen)
			minRef := ang.GetInt("min_referenten")
			benoetigt := BenoetigteReferenten(minRef, ang.GetInt("betreuungsschluessel"), b.GetInt("teilnehmer_geplant"))

			benoetigtRaum := ang.GetBool("benoetigt_raum")
			raumID := body.RaumID
			if raumID == "" {
				raumID = b.GetString("raum")
			}
			// HARTER Block: gewaehlter Raum ist belegt (auch mit trotzdem nicht ueberschreibbar).
			if benoetigtRaum && raumID != "" {
				belegt, err := raumBelegt(app, raumID, start, von, bis, cfg.PufferMinuten, b.Id)
				if err != nil {
					return apis.NewApiError(http.StatusInternalServerError, "Raumpruefung fehlgeschlagen.", nil)
				}
				if belegt {
					return apis.NewApiError(http.StatusConflict, "Der gewaehlte Raum ist zu diesem Zeitpunkt bereits belegt. Bitte einen anderen Raum waehlen.", nil)
				}
			}

			kollision := false
			for _, z := range zuordnungen {
				koll, err := HatKollision(app, z.GetString("referent"), start, von, bis, cfg.PufferMinuten, b.Id)
				if err != nil {
					return apis.NewApiError(http.StatusInternalServerError, "Pruefung fehlgeschlagen.", nil)
				}
				if koll {
					kollision = true
					break
				}
			}
			raumOffen := benoetigtRaum && raumID == ""
			unterbesetzt := geplant < benoetigt
			hatWarnung := unterbesetzt || raumOffen || kollision

			if hatWarnung && !body.Trotzdem {
				return e.JSON(http.StatusUnprocessableEntity, map[string]any{
					"warnung":      true,
					"geplant":      geplant,
					"benoetigt":    benoetigt,
					"min":          minRef,
					"unterbesetzt": unterbesetzt,
					"raum_offen":   raumOffen,
					"kollision":    kollision,
				})
			}
			if hatWarnung && strings.TrimSpace(body.Grund) == "" {
				return apis.NewBadRequestError("Bitte einen Grund fuer die Bestaetigung trotz Warnung angeben.", nil)
			}

			if benoetigtRaum && raumID != "" {
				b.Set("raum", raumID)
			}
			b.Set("status", "bestaetigt")
			b.Set("unterbesetzt", unterbesetzt)
			b.Set("raum_offen", raumOffen)
			if hatWarnung {
				grund := sanitize(body.Grund, 2000)
				b.Set("bestaetigt_trotz_grund", grund)
				notiz := strings.TrimSpace(b.GetString("interne_notiz"))
				zusatz := "Bestaetigt trotz Warnung: " + grund
				if notiz != "" {
					notiz += "\n" + zusatz
				} else {
					notiz = zusatz
				}
				b.Set("interne_notiz", sanitize(notiz, 2000))
			}
			if err := app.Save(b); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Bestaetigung konnte nicht gespeichert werden.", nil)
			}
			sendZusage(app, b)
			return e.JSON(http.StatusOK, map[string]any{"id": b.Id, "status": "bestaetigt", "unterbesetzt": unterbesetzt, "raum_offen": raumOffen})
		}).Bind(auth).BindFunc(personal)

		// ---- Ablehnen --------------------------------------------------
		se.Router.POST("/api/admin/buchungen/{id}/ablehnen", func(e *core.RequestEvent) error {
			b, err := app.FindRecordById("buchungen", e.Request.PathValue("id"))
			if err != nil || b == nil {
				return apis.NewNotFoundError("Buchung nicht gefunden.", nil)
			}
			var body struct {
				Grund             string `json:"grund"`
				GrundAnKundeSenden bool   `json:"grund_an_kunde_senden"`
			}
			_ = e.BindBody(&body)

			b.Set("status", "abgelehnt")
			b.Set("ablehnungs_grund", sanitize(body.Grund, 2000))
			if err := app.Save(b); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Ablehnung konnte nicht gespeichert werden.", nil)
			}
			sendAbsage(app, b, sanitize(body.Grund, 2000), body.GrundAnKundeSenden)
			return e.JSON(http.StatusOK, map[string]any{"id": b.Id, "status": "abgelehnt"})
		}).Bind(auth).BindFunc(personal)

		// ---- Stornieren ------------------------------------------------
		se.Router.POST("/api/admin/buchungen/{id}/stornieren", func(e *core.RequestEvent) error {
			b, err := app.FindRecordById("buchungen", e.Request.PathValue("id"))
			if err != nil || b == nil {
				return apis.NewNotFoundError("Buchung nicht gefunden.", nil)
			}
			var body struct {
				Grund string `json:"grund"`
			}
			_ = e.BindBody(&body)

			b.Set("status", "storniert")
			b.Set("storno_grund", sanitize(body.Grund, 2000))
			// Zuordnungen bleiben fürs Reporting erhalten (SPEC §4.1).
			if err := app.Save(b); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Stornierung konnte nicht gespeichert werden.", nil)
			}
			return e.JSON(http.StatusOK, map[string]any{"id": b.Id, "status": "storniert"})
		}).Bind(auth).BindFunc(personal)

		return se.Next()
	})
}
