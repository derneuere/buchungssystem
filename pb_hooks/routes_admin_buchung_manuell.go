// Package main — routes_admin_buchung_manuell.go
//
// Admin-Route zum manuellen/telefonischen Erfassen einer Buchung durch das
// Personal (SPEC-Erweiterung). Weichere Prüfung als der öffentliche Weg:
// keine Verfügbarkeits-Sperre und kein Rate-Limit (Personal entscheidet
// bewusst), aber valide Stammdaten. System-Kontext-Save umgeht createRule=null
// wie beim öffentlichen Pfad.
package main

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func registerAdminBuchungManuell(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		auth := apis.RequireAuth("mitarbeiter")
		personal := requireRolle("mitarbeiter", "leitung")

		se.Router.POST("/api/admin/buchungen", func(e *core.RequestEvent) error {
			var body struct {
				AngebotsartID           string `json:"angebotsart_id"`
				ThemaID                 string `json:"thema_id"`
				Start                   string `json:"start"`
				TeilnehmerGeplant       int    `json:"teilnehmer_geplant"`
				HerkunftLand            string `json:"herkunft_land"`
				HerkunftBundesland      string `json:"herkunft_bundesland"`
				HerkunftEinrichtungstyp string `json:"herkunft_einrichtungstyp_id"`
				HerkunftEinrichtungName string `json:"herkunft_einrichtungsname"`
				HerkunftOrt             string `json:"herkunft_ort"`
				KontaktName             string `json:"kontakt_name"`
				KontaktEmail            string `json:"kontakt_email"`
				KontaktTelefon          string `json:"kontakt_telefon"`
				Nachricht               string `json:"nachricht"`
				InterneNotiz            string `json:"interne_notiz"`
			}
			if err := e.BindBody(&body); err != nil {
				return apis.NewBadRequestError("Ungültige Anfrage.", nil)
			}

			ang, err := app.FindRecordById("angebotsarten", body.AngebotsartID)
			if err != nil || ang == nil {
				return apis.NewBadRequestError("Angebotsart nicht gefunden.", nil)
			}
			if _, err := app.FindRecordById("themen", body.ThemaID); err != nil {
				return apis.NewBadRequestError("Thema nicht gefunden.", nil)
			}
			startDT, err := types.ParseDateTime(body.Start)
			if err != nil || startDT.IsZero() {
				return apis.NewBadRequestError("Bitte einen gültigen Termin angeben.", nil)
			}
			if strings.TrimSpace(body.KontaktName) == "" || strings.TrimSpace(body.KontaktEmail) == "" {
				return apis.NewBadRequestError("Name und E-Mail der Kontaktperson sind erforderlich.", nil)
			}
			if body.TeilnehmerGeplant < 1 {
				return apis.NewBadRequestError("Die Gruppengröße muss mindestens 1 sein.", nil)
			}

			endeDT, _ := types.ParseDateTime(startDT.Time().Add(time.Duration(ang.GetInt("dauer_minuten")) * time.Minute))

			col, err := app.FindCollectionByNameOrId("buchungen")
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Interner Fehler.", nil)
			}
			rec := core.NewRecord(col)
			rec.Set("status", "angefragt")
			rec.Set("angebotsart", body.AngebotsartID)
			rec.Set("thema", body.ThemaID)
			rec.Set("start", startDT)
			rec.Set("ende", endeDT)
			rec.Set("teilnehmer_geplant", body.TeilnehmerGeplant)
			land := strings.TrimSpace(body.HerkunftLand)
			if land == "" {
				land = "Deutschland"
			}
			rec.Set("herkunft_land", land)
			if body.HerkunftBundesland != "" {
				rec.Set("herkunft_bundesland", body.HerkunftBundesland)
			}
			if body.HerkunftEinrichtungstyp != "" {
				rec.Set("herkunft_einrichtungstyp", body.HerkunftEinrichtungstyp)
			}
			rec.Set("herkunft_einrichtungsname", sanitize(body.HerkunftEinrichtungName, 255))
			rec.Set("herkunft_ort", sanitize(body.HerkunftOrt, 255))
			rec.Set("kontakt_name", sanitize(body.KontaktName, 255))
			rec.Set("kontakt_email", strings.TrimSpace(body.KontaktEmail))
			rec.Set("kontakt_telefon", sanitize(body.KontaktTelefon, 100))
			rec.Set("nachricht", sanitize(body.Nachricht, 2000))
			notiz := "Manuell/telefonisch durch Personal erfasst."
			if z := strings.TrimSpace(body.InterneNotiz); z != "" {
				notiz += " " + z
			}
			rec.Set("interne_notiz", sanitize(notiz, 2000))
			rec.Set("spam_verdacht", false)

			if err := saveWithSystemContext(app, rec); err != nil {
				log.Printf("[admin-buchung] Speichern fehlgeschlagen: %v", err)
				return apis.NewApiError(http.StatusInternalServerError, "Buchung konnte nicht angelegt werden.", nil)
			}
			return e.JSON(http.StatusOK, map[string]any{"id": rec.Id, "status": "angefragt"})
		}).Bind(auth).BindFunc(personal)

		return se.Next()
	})
}
