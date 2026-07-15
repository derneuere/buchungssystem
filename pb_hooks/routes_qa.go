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
	statusPayload := func() map[string]any {
		j := jetzt()
		off := aktuellerOffsetSekunden()
		return map[string]any{
			"test_mode":       true,
			"jetzt":           j.UTC().Format(time.RFC3339),
			"jetzt_berlin":    j.In(berlinLoc()).Format("2006-01-02 15:04"),
			"echt_jetzt":      time.Now().UTC().Format(time.RFC3339),
			"offset_sekunden": off,
			"aktiv":           off != 0,
		}
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
			return e.JSON(http.StatusOK, statusPayload())
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
				return e.JSON(http.StatusOK, statusPayload())
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
