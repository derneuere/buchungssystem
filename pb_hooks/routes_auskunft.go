// Package main — routes_auskunft.go
//
// Auskunfts-Minimierung durch serverseitige FELDPROJEKTION. Eine
// buchungen-ViewRule kann einzelne Felder (E-Mail, Herkunft, Nachricht,
// Notizen) nicht verbergen — Rules filtern Zeilen, nicht Felder. Reines
// Frontend-Hiding wäre über den Netzwerk-Tab / direkte REST-Calls umgehbar.
// Daher liefern diese Routen ausschließlich die für Schalter/Auskunft nötigen
// Felder und filtern serverseitig hart auf status IN (bestaetigt, durchgefuehrt).
//
// Auth: RequireAuth("mitarbeiter") — leitung/mitarbeiter dürfen dieselbe
// schlanke Ansicht ebenfalls nutzen (unschädlich). KEIN requireRolle-Ausschluss.
package main

import (
	"net/http"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// auskunftNameVon lädt einen Datensatz einer Collection und gibt dessen `name`
// zurück (leer, wenn Relation leer/nicht gefunden).
func auskunftNameVon(app core.App, collection, id string) string {
	if id == "" {
		return ""
	}
	rec, err := app.FindRecordById(collection, id)
	if err != nil || rec == nil {
		return ""
	}
	return rec.GetString("name")
}

// auskunftBuchungProjektion baut die erlaubte Feldprojektion einer Buchung.
// Bewusst KEINE E-Mail, keine Herkunft, keine Nachricht, keine Notizen.
func auskunftBuchungProjektion(app core.App, b *core.Record) map[string]any {
	var raum any
	if rid := b.GetString("raum"); rid != "" {
		if n := auskunftNameVon(app, "raeume", rid); n != "" {
			raum = n
		}
	}
	return map[string]any{
		"id":                 b.Id,
		"status":             b.GetString("status"),
		"start":              b.GetDateTime("start").Time().UTC().Format(time.RFC3339),
		"ende":               b.GetDateTime("ende").Time().UTC().Format(time.RFC3339),
		"angebotsart":        auskunftNameVon(app, "angebotsarten", b.GetString("angebotsart")),
		"thema":              auskunftNameVon(app, "themen", b.GetString("thema")),
		"raum":               raum,
		"teilnehmer_geplant": b.GetInt("teilnehmer_geplant"),
		"teilnehmer_ist":     b.GetInt("teilnehmer_ist"),
		"kontakt_name":       b.GetString("kontakt_name"),
		"kontakt_telefon":    b.GetString("kontakt_telefon"),
	}
}

func registerAuskunftRoutes(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		auth := apis.RequireAuth("mitarbeiter")

		// ---- 5a. Liste -------------------------------------------------
		se.Router.GET("/api/auskunft/buchungen", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query()
			// Serverseitiger Statusfilter — NICHT überschreibbar. Klammern, damit
			// die spätere UND-Verknüpfung mit dem Zeitraum korrekt bindet.
			filter := `(status = "bestaetigt" || status = "durchgefuehrt")`
			params := dbx.Params{}
			if von := q.Get("von"); von != "" {
				if t, err := time.ParseInLocation("2006-01-02", von, berlinLoc()); err == nil {
					filter += " && start >= {:von}"
					params["von"] = t.UTC().Format("2006-01-02 15:04:05.000Z")
				}
			}
			if bis := q.Get("bis"); bis != "" {
				if t, err := time.ParseInLocation("2006-01-02", bis, berlinLoc()); err == nil {
					filter += " && start < {:bis}"
					params["bis"] = t.AddDate(0, 0, 1).UTC().Format("2006-01-02 15:04:05.000Z")
				}
			}
			recs, err := app.FindRecordsByFilter("buchungen", filter, "-start", 0, 0, params)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Buchungen konnten nicht geladen werden.", nil)
			}
			out := make([]map[string]any, 0, len(recs))
			for _, b := range recs {
				out = append(out, auskunftBuchungProjektion(app, b))
			}
			return e.JSON(http.StatusOK, out)
		}).Bind(auth)

		// ---- 5b. Detail ------------------------------------------------
		se.Router.GET("/api/auskunft/buchungen/{id}", func(e *core.RequestEvent) error {
			b, err := app.FindRecordById("buchungen", e.Request.PathValue("id"))
			if err != nil || b == nil {
				return apis.NewNotFoundError("Buchung nicht gefunden.", nil)
			}
			// Nur bestätigte/durchgeführte Buchungen sind für die Auskunft sichtbar.
			st := b.GetString("status")
			if st != "bestaetigt" && st != "durchgefuehrt" {
				return apis.NewNotFoundError("Buchung nicht gefunden.", nil)
			}
			res := auskunftBuchungProjektion(app, b)

			// Referent:innen: NUR name + telefon (für Kontaktaufnahme am Schalter),
			// plus Ist-Erfassungs-Felder (zuordnung_id, geplant, eingesetzt).
			zuordnungen, err := app.FindRecordsByFilter("buchung_referenten",
				"buchung = {:b}", "created", 0, 0, dbx.Params{"b": b.Id})
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Zuordnungen konnten nicht geladen werden.", nil)
			}
			refs := make([]map[string]any, 0, len(zuordnungen))
			for _, z := range zuordnungen {
				name, telefon := "", ""
				if r, err := app.FindRecordById("referenten", z.GetString("referent")); err == nil && r != nil {
					name = r.GetString("name")
					telefon = r.GetString("telefon")
				}
				refs = append(refs, map[string]any{
					"zuordnung_id": z.Id,
					"geplant":      z.GetBool("geplant"),
					"eingesetzt":   z.GetBool("eingesetzt"),
					"referent": map[string]any{
						"name":    name,
						"telefon": telefon,
					},
				})
			}
			res["referenten"] = refs
			return e.JSON(http.StatusOK, res)
		}).Bind(auth)

		return se.Next()
	})
}
