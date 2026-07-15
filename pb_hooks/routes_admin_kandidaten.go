// Package main — routes_admin_kandidaten.go
//
// Liefert für eine Buchung die Referent:innen-Kandidaten samt Eignung
// (Thema/Verfügbarkeit/Kollision) UND Auslastungs-Kennzahlen, damit beim
// Bestätigen fundiert eine Person ausgewählt werden kann: Einsätze am Termintag,
// in der Termin-Woche, gesamt (durchgeführt) sowie relativ zum Schnitt.
package main

import (
	"net/http"
	"sort"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

type referentKandidat struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Zugewiesen      bool   `json:"zugewiesen"`
	ThemaMatch      bool   `json:"themaMatch"`
	Verfuegbar      bool   `json:"verfuegbar"`
	Konflikt        bool   `json:"konflikt"`
	Warnstufe       string `json:"warnstufe"`
	EinsaetzeTag    int    `json:"einsaetze_tag"`
	EinsaetzeWoche  int    `json:"einsaetze_woche"`
	EinsaetzeGesamt int    `json:"einsaetze_gesamt"`
	AuslastungRel   string `json:"auslastung_relativ"` // "ueber" | "schnitt" | "unter"
}

func registerAdminKandidatenRoutes(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		auth := apis.RequireAuth("mitarbeiter")
		personal := requireRolle("mitarbeiter", "leitung")

		se.Router.GET("/api/admin/buchungen/{id}/referenten-kandidaten", func(e *core.RequestEvent) error {
			b, err := app.FindRecordById("buchungen", e.Request.PathValue("id"))
			if err != nil || b == nil {
				return apis.NewNotFoundError("Buchung nicht gefunden.", nil)
			}
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
			benoetigt := BenoetigteReferenten(ang.GetInt("min_referenten"), ang.GetInt("betreuungsschluessel"), b.GetInt("teilnehmer_geplant"))
			thema := b.GetString("thema")

			loc := berlinLoc()
			bl := start.In(loc)
			zielJahr, zielWoche := bl.ISOWeek()
			zielDatum := bl.Format("2006-01-02")

			refs, err := app.FindRecordsByFilter("referenten", "aktiv = true", "name", 0, 0)
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Referenten konnten nicht geladen werden.", nil)
			}

			allB, err := app.FindAllRecords("buchungen")
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Buchungen konnten nicht geladen werden.", nil)
			}
			type binfo struct {
				datum  string
				jahr   int
				woche  int
				status string
			}
			bmap := make(map[string]binfo, len(allB))
			for _, x := range allB {
				st := x.GetDateTime("start").Time().In(loc)
				yy, ww := st.ISOWeek()
				bmap[x.Id] = binfo{st.Format("2006-01-02"), yy, ww, x.GetString("status")}
			}

			allBR, err := app.FindAllRecords("buchung_referenten")
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Zuordnungen konnten nicht geladen werden.", nil)
			}
			tag := map[string]int{}
			woche := map[string]int{}
			gesamt := map[string]int{}
			assignedThis := map[string]bool{}
			geplant := 0
			for _, br := range allBR {
				rid := br.GetString("referent")
				bid := br.GetString("buchung")
				istGeplant := br.GetBool("geplant")
				if bid == b.Id && istGeplant {
					geplant++
					assignedThis[rid] = true
				}
				bi, ok := bmap[bid]
				if !ok {
					continue
				}
				if bi.status == "durchgefuehrt" && br.GetBool("eingesetzt") {
					gesamt[rid]++
				}
				if bid != b.Id && istGeplant && (bi.status == "bestaetigt" || bi.status == "durchgefuehrt") {
					if bi.datum == zielDatum {
						tag[rid]++
					}
					if bi.jahr == zielJahr && bi.woche == zielWoche {
						woche[rid]++
					}
				}
			}

			sum := 0
			for _, r := range refs {
				sum += gesamt[r.Id]
			}
			avg := 0.0
			if len(refs) > 0 {
				avg = float64(sum) / float64(len(refs))
			}

			kand := make([]referentKandidat, 0, len(refs))
			for _, r := range refs {
				verf, err := IstVerfuegbar(app, r.Id, start, von, bis)
				if err != nil {
					return apis.NewApiError(http.StatusInternalServerError, "Prüfung fehlgeschlagen.", nil)
				}
				konf, err := HatKollision(app, r.Id, start, von, bis, cfg.PufferMinuten, b.Id)
				if err != nil {
					return apis.NewApiError(http.StatusInternalServerError, "Prüfung fehlgeschlagen.", nil)
				}
				tmatch := enthaelt(r.GetStringSlice("themen"), thema)
				warn := "ok"
				if konf {
					warn = "hart"
				} else if !verf || !tmatch {
					warn = "weich"
				}
				g := gesamt[r.Id]
				rel := "schnitt"
				if avg > 0 {
					if float64(g) >= avg*1.2 {
						rel = "ueber"
					} else if float64(g) <= avg*0.8 {
						rel = "unter"
					}
				}
				kand = append(kand, referentKandidat{
					ID:              r.Id,
					Name:            r.GetString("name"),
					Zugewiesen:      assignedThis[r.Id],
					ThemaMatch:      tmatch,
					Verfuegbar:      verf,
					Konflikt:        konf,
					Warnstufe:       warn,
					EinsaetzeTag:    tag[r.Id],
					EinsaetzeWoche:  woche[r.Id],
					EinsaetzeGesamt: g,
					AuslastungRel:   rel,
				})
			}

			// Sortierung: nicht zugewiesen + geeignetste zuerst (ok < weich < hart),
			// dann geringste Wochen-Auslastung, dann geringste Gesamtzahl (Fairness),
			// dann Name.
			rang := map[string]int{"ok": 0, "weich": 1, "hart": 2}
			sort.SliceStable(kand, func(i, j int) bool {
				if kand[i].Zugewiesen != kand[j].Zugewiesen {
					return !kand[i].Zugewiesen
				}
				if rang[kand[i].Warnstufe] != rang[kand[j].Warnstufe] {
					return rang[kand[i].Warnstufe] < rang[kand[j].Warnstufe]
				}
				if kand[i].EinsaetzeWoche != kand[j].EinsaetzeWoche {
					return kand[i].EinsaetzeWoche < kand[j].EinsaetzeWoche
				}
				if kand[i].EinsaetzeGesamt != kand[j].EinsaetzeGesamt {
					return kand[i].EinsaetzeGesamt < kand[j].EinsaetzeGesamt
				}
				return kand[i].Name < kand[j].Name
			})

			return e.JSON(http.StatusOK, map[string]any{
				"kandidaten":     kand,
				"benoetigt":      benoetigt,
				"geplant":        geplant,
				"schnitt_gesamt": avg,
			})
		}).Bind(auth).BindFunc(personal)

		return se.Next()
	})
}
