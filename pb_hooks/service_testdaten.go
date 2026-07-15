// Package main — service_testdaten.go
//
// QA-/Testmodus (nur bei aktivem TEST_MODE, hinter RequireAuth("mitarbeiter")):
// generateTestdaten legt realistische, klar markierte Testdaten relativ zum
// simulierten jetzt() an; resetTestdaten entfernt ausschließlich diese Marker-
// Datensätze wieder — echte Daten bleiben unangetastet. Markierung nur über
// vorhandene Felder (keine Migration): Namens-Präfix "[Test]" bei
// referenten/raeume/(Fallback-)themen, interne_notiz-Präfix "[TESTDATA]" bei
// buchungen. Abhängige verfuegbarkeiten/buchung_referenten hängen über
// CascadeDelete an ihren Eltern; wir löschen sie zusätzlich explizit, um saubere
// Zähler zu liefern.
package main

import (
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

const (
	testNamePrefix = "[Test]"   // referenten / raeume / Fallback-themen
	testNotizMark  = "[TESTDATA]" // buchungen.interne_notiz
)

// findTestRecords lädt alle Records einer Collection und filtert per Go-Prefix
// (unabhängig von PB-LIKE-Semantik → exakt und vorhersehbar).
func findTestRecords(app core.App, col, field, prefix string) ([]*core.Record, error) {
	all, err := app.FindAllRecords(col)
	if err != nil {
		return nil, err
	}
	out := make([]*core.Record, 0, len(all))
	for _, r := range all {
		if strings.HasPrefix(r.GetString(field), prefix) {
			out = append(out, r)
		}
	}
	return out, nil
}

// slotZeit baut aus einem Basis-Zeitpunkt einen Berlin-lokalen Termin: A +
// offsetTage, auf den nächsten Öffnungstag (Mo–Fr) geschoben, mit der Uhrzeit
// des Slots ("HH:MM"). Liefert start/ende als types.DateTime (UTC gespeichert).
func slotZeit(a time.Time, offsetTage int, slot string, dauerMin int) (types.DateTime, types.DateTime, error) {
	loc := berlinLoc()
	d := a.In(loc).AddDate(0, 0, offsetTage)
	for d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
		d = d.AddDate(0, 0, 1)
	}
	mins, ok := parseHHMM(slot)
	if !ok {
		mins = 10 * 60
	}
	start := time.Date(d.Year(), d.Month(), d.Day(), mins/60, mins%60, 0, 0, loc)
	ende := start.Add(time.Duration(dauerMin) * time.Minute)
	sd, err := types.ParseDateTime(start)
	if err != nil {
		return types.DateTime{}, types.DateTime{}, err
	}
	ed, err := types.ParseDateTime(ende)
	if err != nil {
		return types.DateTime{}, types.DateTime{}, err
	}
	return sd, ed, nil
}

// buchungSpec beschreibt eine zu erzeugende Testbuchung relativ zu A = jetzt().
type buchungSpec struct {
	status     string
	offsetTage int
	slot       string
	seminar    bool // true → Seminar (mit Raum), false → Führung
	gruppe     int
	ist        int    // teilnehmer_ist; <0 = nicht setzen
	zuordnung  string // "" | "geplant" (geplant, nicht eingesetzt) | "eingesetzt" (beides)
	bundesland string
}

// generateTestdaten erzeugt den kompletten Testdatensatz. Idempotent-Guard:
// existiert bereits ein "[Test]"-Referent, wird nichts angelegt.
func generateTestdaten(app core.App) (map[string]any, error) {
	// --- Guard --------------------------------------------------------------
	vorhandeneRef, err := findTestRecords(app, "referenten", "name", testNamePrefix)
	if err != nil {
		return nil, err
	}
	if len(vorhandeneRef) > 0 {
		res, zerr := zaehleTestdaten(app)
		if zerr != nil {
			return nil, zerr
		}
		res["bereits_vorhanden"] = true
		return res, nil
	}

	a := jetzt()

	counts := map[string]any{
		"bereits_vorhanden":  false,
		"referenten":         0,
		"verfuegbarkeiten":   0,
		"raeume":             0,
		"themen_zugeordnet":  0,
		"buchungen":          0,
		"buchung_referenten": 0,
	}

	txErr := app.RunInTransaction(func(txApp core.App) error {
		// --- Themen: alle aktiven einsammeln, sonst 2 [Test]-Themen anlegen ---
		themen, err := txApp.FindRecordsByFilter("themen", "aktiv = true", "name", 0, 0)
		if err != nil {
			return err
		}
		if len(themen) == 0 {
			themenCol, err := txApp.FindCollectionByNameOrId("themen")
			if err != nil {
				return err
			}
			for i, name := range []string{"[Test] Widerstand & Zivilcourage", "[Test] Quellenarbeit"} {
				t := core.NewRecord(themenCol)
				t.Set("name", name)
				t.Set("sort_order", 900+i)
				t.Set("aktiv", true)
				if err := txApp.Save(t); err != nil {
					return err
				}
				themen = append(themen, t)
			}
		}
		themaIDs := make([]string, 0, len(themen))
		for _, t := range themen {
			themaIDs = append(themaIDs, t.Id)
		}
		counts["themen_zugeordnet"] = len(themaIDs)

		// --- Räume -----------------------------------------------------------
		raumCol, err := txApp.FindCollectionByNameOrId("raeume")
		if err != nil {
			return err
		}
		raumSpecs := []struct {
			name string
			kap  int
		}{
			{"[Test] Seminarraum A", 30},
			{"[Test] Seminarraum B", 15},
		}
		raeume := make([]*core.Record, 0, len(raumSpecs))
		for _, rs := range raumSpecs {
			r := core.NewRecord(raumCol)
			r.Set("name", rs.name)
			r.Set("kapazitaet", rs.kap)
			r.Set("aktiv", true)
			r.Set("notizen", testNotizMark+" generierter Testraum")
			if err := txApp.Save(r); err != nil {
				return err
			}
			raeume = append(raeume, r)
			counts["raeume"] = counts["raeume"].(int) + 1
		}
		seminarRaumID := raeume[0].Id

		// --- Referenten ------------------------------------------------------
		refCol, err := txApp.FindCollectionByNameOrId("referenten")
		if err != nil {
			return err
		}
		refNamen := []string{"[Test] Anna Bauer", "[Test] Ben Conrad", "[Test] Carla Dorn", "[Test] David Ernst"}
		referenten := make([]*core.Record, 0, len(refNamen))
		for i, name := range refNamen {
			r := core.NewRecord(refCol)
			r.Set("name", name)
			r.Set("email", "referent"+itoa(i+1)+"@test.example")
			r.Set("telefon", "030 00000"+itoa(i+1))
			r.Set("themen", themaIDs)
			r.Set("aktiv", true)
			r.Set("notizen", testNotizMark+" generierte:r Test-Referent:in")
			if err := txApp.Save(r); err != nil {
				return err
			}
			referenten = append(referenten, r)
			counts["referenten"] = counts["referenten"].(int) + 1
		}

		// --- Verfügbarkeiten (Mo–Fr, 08:00–18:00) ----------------------------
		vfCol, err := txApp.FindCollectionByNameOrId("verfuegbarkeiten")
		if err != nil {
			return err
		}
		for _, r := range referenten {
			for _, wt := range []string{"mo", "di", "mi", "do", "fr"} {
				v := core.NewRecord(vfCol)
				v.Set("referent", r.Id)
				v.Set("art", "verfuegbar")
				v.Set("wiederholung", "woechentlich")
				v.Set("wochentag", wt)
				v.Set("zeit_von", "08:00")
				v.Set("zeit_bis", "18:00")
				v.Set("notiz", testNotizMark)
				if err := txApp.Save(v); err != nil {
					return err
				}
				counts["verfuegbarkeiten"] = counts["verfuegbarkeiten"].(int) + 1
			}
		}

		// --- Angebotsarten (Seed) --------------------------------------------
		fuehrung, err := txApp.FindFirstRecordByFilter("angebotsarten", "slug = {:s}", dbx.Params{"s": "fuehrung"})
		if err != nil {
			return err
		}
		seminar, err := txApp.FindFirstRecordByFilter("angebotsarten", "slug = {:s}", dbx.Params{"s": "seminar"})
		if err != nil {
			return err
		}

		// Einrichtungstypen zum Streuen (optional).
		einrichtungstypen, _ := txApp.FindAllRecords("einrichtungstypen")

		buchungCol, err := txApp.FindCollectionByNameOrId("buchungen")
		if err != nil {
			return err
		}
		brCol, err := txApp.FindCollectionByNameOrId("buchung_referenten")
		if err != nil {
			return err
		}

		specs := []buchungSpec{
			{status: "angefragt", offsetTage: 7, slot: "10:00", seminar: false, gruppe: 25, ist: -1, zuordnung: "", bundesland: "bayern"},
			{status: "angefragt", offsetTage: 9, slot: "12:00", seminar: false, gruppe: 15, ist: -1, zuordnung: "", bundesland: "berlin"},
			{status: "angefragt", offsetTage: 12, slot: "09:00", seminar: true, gruppe: 18, ist: -1, zuordnung: "", bundesland: "nordrhein_westfalen"},
			{status: "warteliste", offsetTage: 8, slot: "14:00", seminar: false, gruppe: 20, ist: -1, zuordnung: "", bundesland: "sachsen"},
			{status: "bestaetigt", offsetTage: 2, slot: "10:00", seminar: false, gruppe: 22, ist: -1, zuordnung: "geplant", bundesland: "hamburg"},
			{status: "bestaetigt", offsetTage: 4, slot: "13:00", seminar: true, gruppe: 20, ist: -1, zuordnung: "geplant", bundesland: "niedersachsen"},
			{status: "bestaetigt", offsetTage: 6, slot: "12:00", seminar: false, gruppe: 28, ist: -1, zuordnung: "geplant", bundesland: "hessen"},
			{status: "bestaetigt", offsetTage: 20, slot: "09:00", seminar: true, gruppe: 16, ist: -1, zuordnung: "geplant", bundesland: "berlin"},
			{status: "bestaetigt", offsetTage: 35, slot: "14:00", seminar: false, gruppe: 12, ist: -1, zuordnung: "geplant", bundesland: "bayern"},
			{status: "durchgefuehrt", offsetTage: -7, slot: "10:00", seminar: false, gruppe: 24, ist: 22, zuordnung: "eingesetzt", bundesland: "baden_wuerttemberg"},
			{status: "durchgefuehrt", offsetTage: -20, slot: "13:00", seminar: true, gruppe: 18, ist: 15, zuordnung: "eingesetzt", bundesland: "nordrhein_westfalen"},
			{status: "durchgefuehrt", offsetTage: -45, slot: "12:00", seminar: false, gruppe: 30, ist: 0, zuordnung: "eingesetzt", bundesland: "sachsen"},
			{status: "durchgefuehrt", offsetTage: -90, slot: "14:00", seminar: false, gruppe: 20, ist: 19, zuordnung: "eingesetzt", bundesland: "thueringen"},
			{status: "abgelehnt", offsetTage: -10, slot: "10:00", seminar: false, gruppe: 15, ist: -1, zuordnung: "", bundesland: "ausland_oder_keine_angabe"},
		}

		// --- Historische Buchungen (durchgeführt) über die letzten ~12 Monate,
		// damit die Auswertungen (Herkunft, Soll/Ist, Auslastung, Zeitreihe)
		// aussagekräftig sind. Deterministisch über Indizes gestreut.
		bundeslaender := []string{
			"baden_wuerttemberg", "bayern", "berlin", "brandenburg", "bremen",
			"hamburg", "hessen", "mecklenburg_vorpommern", "niedersachsen",
			"nordrhein_westfalen", "rheinland_pfalz", "saarland", "sachsen",
			"sachsen_anhalt", "schleswig_holstein", "thueringen",
		}
		histSlots := []string{"09:00", "10:00", "12:00", "13:00", "14:00"}
		k := 0
		for monat := 1; monat <= 12; monat++ {
			for _, tag := range []int{4, 13, 23} {
				gruppe := 12 + (k*3)%22
				ist := gruppe
				switch k % 4 {
				case 1:
					ist = gruppe - 2
				case 2:
					ist = gruppe - 5
				case 3:
					if k%8 == 3 {
						ist = 0
					}
				}
				if ist < 0 {
					ist = 0
				}
				specs = append(specs, buchungSpec{
					status:     "durchgefuehrt",
					offsetTage: -(monat*30 + tag),
					slot:       histSlots[k%len(histSlots)],
					seminar:    k%3 == 0,
					gruppe:     gruppe,
					ist:        ist,
					zuordnung:  "eingesetzt",
					bundesland: bundeslaender[k%len(bundeslaender)],
				})
				k++
			}
		}
		for i, sp := range specs {
			ang := fuehrung
			if sp.seminar {
				ang = seminar
			}
			start, ende, err := slotZeit(a, sp.offsetTage, sp.slot, ang.GetInt("dauer_minuten"))
			if err != nil {
				return err
			}
			rec := core.NewRecord(buchungCol)
			rec.Set("status", sp.status)
			rec.Set("angebotsart", ang.Id)
			rec.Set("thema", themaIDs[i%len(themaIDs)])
			rec.Set("start", start)
			rec.Set("ende", ende)
			if sp.seminar {
				rec.Set("raum", seminarRaumID)
			}
			rec.Set("teilnehmer_geplant", sp.gruppe)
			if sp.ist >= 0 {
				rec.Set("teilnehmer_ist", sp.ist)
			}
			rec.Set("herkunft_land", "Deutschland")
			rec.Set("herkunft_bundesland", sp.bundesland)
			if len(einrichtungstypen) > 0 {
				rec.Set("herkunft_einrichtungstyp", einrichtungstypen[i%len(einrichtungstypen)].Id)
			}
			rec.Set("herkunft_einrichtungsname", "[Test] Einrichtung "+itoa(i+1))
			rec.Set("herkunft_ort", "Teststadt")
			rec.Set("kontakt_name", "[Test] Kontaktperson "+itoa(i+1))
			rec.Set("kontakt_email", "kontakt"+itoa(i+1)+"@test.example")
			rec.Set("kontakt_telefon", "030 12345"+itoa(i+1))
			rec.Set("nachricht", "Automatisch generierte Testbuchung.")
			rec.Set("interne_notiz", testNotizMark+" automatisch generierte Testbuchung ("+sp.status+")")
			rec.Set("spam_verdacht", false)
			if err := saveWithSystemContext(txApp, rec); err != nil {
				return err
			}
			counts["buchungen"] = counts["buchungen"].(int) + 1

			// --- Referenten-Zuordnungen (nur bestaetigt / durchgefuehrt) ------
			if sp.zuordnung == "" {
				continue
			}
			benoetigt := BenoetigteReferenten(ang.GetInt("min_referenten"), ang.GetInt("betreuungsschluessel"), sp.gruppe)
			eingesetzt := sp.zuordnung == "eingesetzt"
			for n := 0; n < benoetigt && n < len(referenten); n++ {
				ref := referenten[(i+n)%len(referenten)]
				br := core.NewRecord(brCol)
				br.Set("buchung", rec.Id)
				br.Set("referent", ref.Id)
				br.Set("geplant", true)
				br.Set("eingesetzt", eingesetzt)
				br.Set("quelle", "auto")
				br.Set("notiz", testNotizMark)
				if err := txApp.Save(br); err != nil {
					return err
				}
				counts["buchung_referenten"] = counts["buchung_referenten"].(int) + 1
			}
		}
		return nil
	})
	if txErr != nil {
		return nil, txErr
	}
	return counts, nil
}

// zaehleTestdaten zählt vorhandene Marker-Datensätze (für den Guard-Report).
func zaehleTestdaten(app core.App) (map[string]any, error) {
	referenten, err := findTestRecords(app, "referenten", "name", testNamePrefix)
	if err != nil {
		return nil, err
	}
	raeume, err := findTestRecords(app, "raeume", "name", testNamePrefix)
	if err != nil {
		return nil, err
	}
	buchungen, err := findTestRecords(app, "buchungen", "interne_notiz", testNotizMark)
	if err != nil {
		return nil, err
	}
	vf := 0
	for _, r := range referenten {
		kinder, err := app.FindRecordsByFilter("verfuegbarkeiten", "referent = {:r}", "", 0, 0, dbx.Params{"r": r.Id})
		if err != nil {
			return nil, err
		}
		vf += len(kinder)
	}
	br := 0
	for _, b := range buchungen {
		kinder, err := app.FindRecordsByFilter("buchung_referenten", "buchung = {:b}", "", 0, 0, dbx.Params{"b": b.Id})
		if err != nil {
			return nil, err
		}
		br += len(kinder)
	}
	return map[string]any{
		"referenten":         len(referenten),
		"verfuegbarkeiten":   vf,
		"raeume":             len(raeume),
		"buchungen":          len(buchungen),
		"buchung_referenten": br,
	}, nil
}

// resetTestdaten löscht ausschließlich die markierten Testdaten. Reihenfolge:
// Buchungen (samt buchung_referenten) → Referenten (samt verfuegbarkeiten) →
// Räume → Fallback-Themen. Echte Daten (ohne Marker) bleiben unangetastet.
func resetTestdaten(app core.App) (map[string]any, error) {
	counts := map[string]any{
		"buchungen":          0,
		"buchung_referenten": 0,
		"verfuegbarkeiten":   0,
		"referenten":         0,
		"raeume":             0,
		"themen":             0,
	}

	txErr := app.RunInTransaction(func(txApp core.App) error {
		// 1. Buchungen + zugehörige buchung_referenten.
		buchungen, err := findTestRecords(txApp, "buchungen", "interne_notiz", testNotizMark)
		if err != nil {
			return err
		}
		for _, b := range buchungen {
			kinder, err := txApp.FindRecordsByFilter("buchung_referenten", "buchung = {:b}", "", 0, 0, dbx.Params{"b": b.Id})
			if err != nil {
				return err
			}
			for _, k := range kinder {
				if err := txApp.Delete(k); err != nil {
					return err
				}
				counts["buchung_referenten"] = counts["buchung_referenten"].(int) + 1
			}
			if err := txApp.Delete(b); err != nil {
				return err
			}
			counts["buchungen"] = counts["buchungen"].(int) + 1
		}

		// 2. Referenten + zugehörige verfuegbarkeiten.
		referenten, err := findTestRecords(txApp, "referenten", "name", testNamePrefix)
		if err != nil {
			return err
		}
		for _, r := range referenten {
			kinder, err := txApp.FindRecordsByFilter("verfuegbarkeiten", "referent = {:r}", "", 0, 0, dbx.Params{"r": r.Id})
			if err != nil {
				return err
			}
			for _, k := range kinder {
				if err := txApp.Delete(k); err != nil {
					return err
				}
				counts["verfuegbarkeiten"] = counts["verfuegbarkeiten"].(int) + 1
			}
			if err := txApp.Delete(r); err != nil {
				return err
			}
			counts["referenten"] = counts["referenten"].(int) + 1
		}

		// 3. Räume.
		raeume, err := findTestRecords(txApp, "raeume", "name", testNamePrefix)
		if err != nil {
			return err
		}
		for _, r := range raeume {
			if err := txApp.Delete(r); err != nil {
				return err
			}
			counts["raeume"] = counts["raeume"].(int) + 1
		}

		// 4. Fallback-Themen (nur die "[Test] …"-Themen).
		themen, err := findTestRecords(txApp, "themen", "name", testNamePrefix)
		if err != nil {
			return err
		}
		for _, t := range themen {
			if err := txApp.Delete(t); err != nil {
				return err
			}
			counts["themen"] = counts["themen"].(int) + 1
		}
		return nil
	})
	if txErr != nil {
		return nil, txErr
	}
	return counts, nil
}
