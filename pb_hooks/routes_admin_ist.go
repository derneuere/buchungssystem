// Package main — routes_admin_ist.go
//
// Feldbeschränkte Ist-Erfassungs-Route für ALLE drei Rollen
// (leitung | mitarbeiter | auskunft). Sie ersetzt die früheren Direkt-Writes
// der Ist-Erfassung (buchung_referenten.eingesetzt, buchungen.teilnehmer_ist,
// status=durchgefuehrt). Da die verschärften Rules (istPersonal) die Auskunft
// vom Direkt-Schreiben ausschließen, läuft der Ist-Write bewusst über den
// Model-Layer (saveWithSystemContext), begrenzt aber HART auf die Whitelist:
//   - buchungen: NUR teilnehmer_ist und (optional) status -> "durchgefuehrt".
//     Jeder andere Status-Zielwert wird abgelehnt. Kein anderes Feld wird berührt.
//   - buchung_referenten: NUR eingesetzt (Toggle) bzw. Create einer neuen
//     Ist-Zuordnung mit fixem {geplant:false, eingesetzt:true, quelle:"manuell"}.
//
// Fremdschreiben ist ausgeschlossen: jede zuordnung_id muss zur {id}-Buchung
// gehören; spontane Vertretungen werden immer an {id} gehängt.
package main

import (
	"log"
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func registerAdminIstRoute(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		auth := apis.RequireAuth("mitarbeiter")
		// Ist-Erfassung: alle drei Rollen dürfen (auch auskunft).
		istRollen := requireRolle("leitung", "mitarbeiter", "auskunft")

		se.Router.POST("/api/admin/buchungen/{id}/ist", func(e *core.RequestEvent) error {
			id := e.Request.PathValue("id")
			b, err := app.FindRecordById("buchungen", id)
			if err != nil || b == nil {
				return apis.NewNotFoundError("Buchung nicht gefunden.", nil)
			}
			// Status-Vorbedingung: Ist-Erfassung (und die Transition nach
			// "durchgefuehrt") ist NUR aus bestätigt/durchgeführt zulässig. Sonst
			// könnte man über eine gemerkte Record-Id jede Buchung (angefragt,
			// warteliste, abgelehnt, storniert) auf durchgeführt zwingen und den
			// Bestätigungs-/Sichtbarkeits-Workflow umgehen (gilt für alle Rollen).
			if st := b.GetString("status"); st != "bestaetigt" && st != "durchgefuehrt" {
				return apis.NewBadRequestError(
					"Ist-Erfassung ist nur für bestätigte oder durchgeführte Buchungen möglich.", nil)
			}

			var body struct {
				TeilnehmerIst *int  `json:"teilnehmer_ist"`
				Durchgefuehrt *bool `json:"durchgefuehrt"`
				Eingesetzt    []struct {
					ZuordnungID string `json:"zuordnung_id"`
					Eingesetzt  bool   `json:"eingesetzt"`
				} `json:"eingesetzt"`
				SpontaneVertretung []struct {
					ReferentID string `json:"referent_id"`
				} `json:"spontane_vertretung"`
			}
			if err := e.BindBody(&body); err != nil {
				return apis.NewBadRequestError("Ungültige Anfrage.", nil)
			}

			// --- (1) Toggle eingesetzt bestehender Zuordnungen ---
			for _, tog := range body.Eingesetzt {
				if tog.ZuordnungID == "" {
					continue
				}
				z, err := app.FindRecordById("buchung_referenten", tog.ZuordnungID)
				if err != nil || z == nil {
					return apis.NewBadRequestError("Zuordnung nicht gefunden.", nil)
				}
				// HART: Zuordnung muss zu dieser Buchung gehören (kein Fremdschreiben).
				if z.GetString("buchung") != b.Id {
					return apis.NewBadRequestError("Zuordnung gehört nicht zu dieser Buchung.", nil)
				}
				z.Set("eingesetzt", tog.Eingesetzt)
				if err := saveWithSystemContext(app, z); err != nil {
					log.Printf("[ist] eingesetzt-Toggle fehlgeschlagen: %v", err)
					return apis.NewApiError(http.StatusInternalServerError, "Speichern fehlgeschlagen.", nil)
				}
			}

			// --- (2) Spontane Vertretung(en) anlegen ---
			if len(body.SpontaneVertretung) > 0 {
				col, err := app.FindCollectionByNameOrId("buchung_referenten")
				if err != nil {
					return apis.NewApiError(http.StatusInternalServerError, "Interner Fehler.", nil)
				}
				for _, sv := range body.SpontaneVertretung {
					if sv.ReferentID == "" {
						continue
					}
					ref, err := app.FindRecordById("referenten", sv.ReferentID)
					if err != nil || ref == nil {
						return apis.NewBadRequestError("Referent:in nicht gefunden.", nil)
					}
					// Doppelte Zuordnung vermeiden (Unique-Index buchung+referent).
					existing, _ := app.FindFirstRecordByFilter("buchung_referenten",
						"buchung = {:b} && referent = {:r}", dbx.Params{"b": b.Id, "r": ref.Id})
					if existing != nil {
						existing.Set("eingesetzt", true)
						if err := saveWithSystemContext(app, existing); err != nil {
							return apis.NewApiError(http.StatusInternalServerError, "Speichern fehlgeschlagen.", nil)
						}
						continue
					}
					z := core.NewRecord(col)
					z.Set("buchung", b.Id)
					z.Set("referent", ref.Id)
					z.Set("geplant", false)
					z.Set("eingesetzt", true)
					z.Set("quelle", "manuell")
					z.Set("notiz", "Spontane Vertretung (Ist-Erfassung)")
					if err := saveWithSystemContext(app, z); err != nil {
						log.Printf("[ist] spontane Vertretung fehlgeschlagen: %v", err)
						return apis.NewApiError(http.StatusInternalServerError, "Speichern fehlgeschlagen.", nil)
					}
				}
			}

			// --- (3) teilnehmer_ist / status auf der Buchung ---
			buchungGeaendert := false
			if body.TeilnehmerIst != nil {
				if *body.TeilnehmerIst < 0 {
					return apis.NewBadRequestError("Die Ist-Teilnehmerzahl darf nicht negativ sein.", nil)
				}
				b.Set("teilnehmer_ist", *body.TeilnehmerIst)
				buchungGeaendert = true
			}
			if body.Durchgefuehrt != nil && *body.Durchgefuehrt {
				// Status-Transition HART auf "durchgefuehrt" begrenzt.
				b.Set("status", "durchgefuehrt")
				buchungGeaendert = true
			}
			if buchungGeaendert {
				if err := saveWithSystemContext(app, b); err != nil {
					log.Printf("[ist] Buchung speichern fehlgeschlagen: %v", err)
					return apis.NewApiError(http.StatusInternalServerError, "Speichern fehlgeschlagen.", nil)
				}
			}

			return e.JSON(http.StatusOK, map[string]any{"ok": true})
		}).Bind(auth).BindFunc(istRollen)

		return se.Next()
	})
}
