// Package main — routes_qa.go
//
// (Dateiname bewusst nicht routes_test.go — der _test.go-Suffix würde die Datei
// aus dem regulären Go-Build ausschließen.)
//
// QA-/Testmodus-Endpunkte (SPEC-Erweiterung, Auftrag „QA-/Testmodus"). Zwei
// Gates: (1) ist TEST_MODE aus, registriert registerTestRoutes GAR KEINE Route
// → jedes /api/test/* fällt in den SPA-Catch-all (echtes 404, keine
// Angriffsfläche); (2) jede registrierte Route zusätzlich hinter
// apis.RequireAuth("mitarbeiter"). In Produktion bleibt der Modus damit komplett
// aus (siehe auch clock.go: jetzt() ignoriert dann den Offset).
package main

import (
	"net/http"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func registerTestRoutes(app *pocketbase.PocketBase) {
	// statusPayload nimmt den eingeloggten mitarbeiter-Record entgegen, um die
	// wirksame Rolle und einen ggf. aktiven QA-Rollen-Override zu melden (damit
	// der persistente QA-Balken den Reset-Button rollenunabhängig anzeigen kann).
	statusPayload := func(auth *core.Record) map[string]any {
		j := jetzt()
		off := aktuellerOffsetSekunden()
		p := map[string]any{
			"test_mode":       true,
			"jetzt":           j.UTC().Format(time.RFC3339),
			"jetzt_berlin":    j.In(berlinLoc()).Format("2006-01-02 15:04"),
			"echt_jetzt":      time.Now().UTC().Format(time.RFC3339),
			"offset_sekunden": off,
			"aktiv":           off != 0,
		}
		if auth != nil {
			original := auth.GetString("qa_rolle_original")
			p["rolle"] = auth.GetString("rolle")
			p["qa_rolle_original"] = original
			p["rolle_override_aktiv"] = original != ""
		}
		return p
	}

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// GET /api/test/status — IMMER registriert, damit der Pfad bei TEST_MODE=aus
		// ein echtes 404 liefert (statt in den SPA-Catch-all zu fallen). Auth wird
		// hier im Handler geprueft; nur Personal sieht den Uhr-Zustand.
		se.Router.GET("/api/test/status", func(e *core.RequestEvent) error {
			if !testModeAktiv() {
				return apis.NewNotFoundError("", nil)
			}
			if e.Auth == nil || e.Auth.Collection().Name != "mitarbeiter" {
				return apis.NewUnauthorizedError("", nil)
			}
			return e.JSON(http.StatusOK, statusPayload(e.Auth))
		})

		if testModeAktiv() {
			auth := apis.RequireAuth("mitarbeiter")

			// POST /api/test/jetzt — simuliertes Jetzt setzen/zuruecksetzen.
			se.Router.POST("/api/test/jetzt", func(e *core.RequestEvent) error {
				var body struct {
					Datum string `json:"datum"`
					ISO   string `json:"iso"`
					Reset bool   `json:"reset"`
				}
				_ = e.BindBody(&body)
				switch {
				case body.Reset:
					resetJetzt()
				case body.ISO != "":
					t, err := parseStart(body.ISO)
					if err != nil {
						return apis.NewBadRequestError("Ungueltiges ISO-Datum.", nil)
					}
					setJetztOffsetSekunden(int64(t.Sub(time.Now()).Seconds()))
				case body.Datum != "":
					loc := berlinLoc()
					ziel, err := time.ParseInLocation("2006-01-02", body.Datum, loc)
					if err != nil {
						return apis.NewBadRequestError("Ungueltiges Datum (YYYY-MM-DD).", nil)
					}
					now := time.Now().In(loc)
					heute := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
					tage := int64(ziel.Sub(heute).Hours() / 24)
					setJetztOffsetSekunden(tage * 86400)
				default:
					return apis.NewBadRequestError("Bitte datum, iso oder reset angeben.", nil)
				}
				return e.JSON(http.StatusOK, statusPayload(e.Auth))
			}).Bind(auth)

			// POST /api/test/rolle — eigene wirksame Rolle temporär umschalten
			// (QA-Rollen-Override). Schreibt die rolle direkt im DB-Record um und
			// sichert die echte Rolle einmalig in qa_rolle_original. Da die Rules
			// @request.auth.rolle aus dem Record lesen, greift der Override überall
			// (Frontend + Collection-Rules + Route-Guards). saveWithSystemContext
			// umgeht die neue istLeitung-UpdateRule bewusst.
			// KEIN requireRolle-Guard — sonst könnte man sich als "auskunft" nicht
			// mehr selbst zurückschalten.
			se.Router.POST("/api/test/rolle", func(e *core.RequestEvent) error {
				var body struct {
					Rolle string `json:"rolle"`
				}
				if err := e.BindBody(&body); err != nil {
					return apis.NewBadRequestError("Ungültige Anfrage.", nil)
				}
				switch body.Rolle {
				case "leitung", "mitarbeiter", "auskunft":
					// ok
				default:
					return apis.NewBadRequestError("Unbekannte Rolle.", nil)
				}
				rec := e.Auth
				if rec == nil {
					return apis.NewUnauthorizedError("", nil)
				}
				// Original nur beim ersten Umschalten sichern.
				if rec.GetString("qa_rolle_original") == "" {
					rec.Set("qa_rolle_original", rec.GetString("rolle"))
				}
				rec.Set("rolle", body.Rolle)
				if err := saveWithSystemContext(app, rec); err != nil {
					return apis.NewApiError(http.StatusInternalServerError, "Rolle konnte nicht gesetzt werden.", nil)
				}
				return e.JSON(http.StatusOK, statusPayload(rec))
			}).Bind(auth)

			// POST /api/test/rolle/reset — wirksame Rolle auf die echte
			// zurücksetzen. MUSS immer erreichbar sein (auch als "auskunft").
			se.Router.POST("/api/test/rolle/reset", func(e *core.RequestEvent) error {
				rec := e.Auth
				if rec == nil {
					return apis.NewUnauthorizedError("", nil)
				}
				if original := rec.GetString("qa_rolle_original"); original != "" {
					rec.Set("rolle", original)
					rec.Set("qa_rolle_original", "")
					if err := saveWithSystemContext(app, rec); err != nil {
						return apis.NewApiError(http.StatusInternalServerError, "Rolle konnte nicht zurückgesetzt werden.", nil)
					}
				}
				return e.JSON(http.StatusOK, statusPayload(rec))
			}).Bind(auth)

			// POST /api/test/seed — Testdaten erzeugen.
			se.Router.POST("/api/test/seed", func(e *core.RequestEvent) error {
				res, err := generateTestdaten(app)
				if err != nil {
					return apis.NewApiError(http.StatusInternalServerError, "Seed fehlgeschlagen: "+err.Error(), nil)
				}
				return e.JSON(http.StatusOK, res)
			}).Bind(auth)

			// POST /api/test/reset — markierte Testdaten loeschen.
			se.Router.POST("/api/test/reset", func(e *core.RequestEvent) error {
				res, err := resetTestdaten(app)
				if err != nil {
					return apis.NewApiError(http.StatusInternalServerError, "Reset fehlgeschlagen: "+err.Error(), nil)
				}
				return e.JSON(http.StatusOK, res)
			}).Bind(auth)

			// POST /api/test/cron/verfall — Verfall-Job sofort mit jetzt()-Cutoff.
			se.Router.POST("/api/test/cron/verfall", func(e *core.RequestEvent) error {
				n, err := verfalleAbgelaufeneAnfragen(app)
				if err != nil {
					return apis.NewApiError(http.StatusInternalServerError, "Verfall fehlgeschlagen: "+err.Error(), nil)
				}
				return e.JSON(http.StatusOK, map[string]any{"verfallen": n})
			}).Bind(auth)
		}

		return se.Next()
	})
}
