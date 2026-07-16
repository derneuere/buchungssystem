package main

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"
)

// TestPruefeStatusUebergang sichert die Status-Guards der Workflow-Endpunkte
// (bestaetigen/ablehnen/stornieren): erlaubte Ausgangsstatus passieren, jeder
// andere ergibt einen 409 mit einer Meldung, die den aktuellen Status nennt.
func TestPruefeStatusUebergang(t *testing.T) {
	// Erlaubt-Matrix je Aktion (SPEC §4.1 + Review-Fix).
	faelle := []struct {
		aktion  string
		erlaubt []string
		blockt  []string
	}{
		{"bestätigt", []string{"angefragt", "warteliste"},
			[]string{"bestaetigt", "abgelehnt", "storniert", "verfallen", "durchgefuehrt"}},
		{"abgelehnt", []string{"angefragt", "warteliste"},
			[]string{"bestaetigt", "abgelehnt", "storniert", "verfallen", "durchgefuehrt"}},
		{"storniert", []string{"angefragt", "warteliste", "bestaetigt"},
			[]string{"abgelehnt", "storniert", "verfallen", "durchgefuehrt"}},
	}

	for _, f := range faelle {
		for _, s := range f.erlaubt {
			if err := pruefeStatusUebergang(s, f.aktion, f.erlaubt...); err != nil {
				t.Fatalf("Aktion %q aus Status %q: unerwarteter Fehler %v", f.aktion, s, err)
			}
		}
		for _, s := range f.blockt {
			err := pruefeStatusUebergang(s, f.aktion, f.erlaubt...)
			if err == nil {
				t.Fatalf("Aktion %q aus Status %q: erwartete 409, bekam nil", f.aktion, s)
			}
			ae := router.ToApiError(err)
			if ae.Status != http.StatusConflict {
				t.Fatalf("Aktion %q aus Status %q: Status = %d, want 409", f.aktion, s, ae.Status)
			}
			if !strings.Contains(ae.Message, s) {
				t.Fatalf("Aktion %q aus Status %q: Meldung %q nennt den Status nicht", f.aktion, s, ae.Message)
			}
		}
	}
}

// TestBestaetigenRaumRecheck belegt die Kern-Invariante hinter dem Race-Fix
// (Doppelbelegung beim gleichzeitigen Bestätigen): solange beide angefragten
// Buchungen raum="" haben, meldet raumBelegt für den Ziel-Raum "frei" — beide
// Bestätigungen würden den Vor-Check passieren. Sobald die erste Buchung den
// Raum im gleichen Slot belegt, muss der in der Transaktion laufende Recheck
// (routes_admin_buchungen.go: RunInTransaction) den Raum als belegt erkennen
// und die zweite Bestätigung mit 409 abweisen.
func TestBestaetigenRaumRecheck(t *testing.T) {
	app, cleanup := bootTestApp(t)
	defer cleanup()

	raumCol, err := app.FindCollectionByNameOrId("raeume")
	if err != nil {
		t.Fatal(err)
	}
	raum := core.NewRecord(raumCol)
	raum.Set("name", "Test Raum Recheck")
	raum.Set("kapazitaet", 30)
	raum.Set("aktiv", true)
	if err := app.Save(raum); err != nil {
		t.Fatalf("raum save: %v", err)
	}

	// Zwei angefragte Buchungen im selben Slot, beide ohne zugewiesenen Raum.
	aID := erstelleAngefragteBuchung(t, app, "2026-09-01 08:00:00.000Z", "2026-09-01 09:00:00.000Z")
	bID := erstelleAngefragteBuchung(t, app, "2026-09-01 08:00:00.000Z", "2026-09-01 09:00:00.000Z")

	start := mustParse(t, "2026-09-01 08:00:00.000Z")
	ende := mustParse(t, "2026-09-01 09:00:00.000Z")
	von := localMinutes(start)
	bis := localMinutes(ende)

	// Vor der Bestätigung: Raum ist frei (beide würden den Vor-Check passieren).
	belegt, err := raumBelegt(app, raum.Id, start, von, bis, 0, bID)
	if err != nil {
		t.Fatalf("raumBelegt (vorher): %v", err)
	}
	if belegt {
		t.Fatalf("Raum sollte vor der ersten Bestätigung frei sein")
	}

	// Erste Buchung bestätigen: belegt den Raum im Slot.
	a, err := app.FindRecordById("buchungen", aID)
	if err != nil {
		t.Fatal(err)
	}
	a.Set("raum", raum.Id)
	a.Set("status", "bestaetigt")
	if err := app.Save(a); err != nil {
		t.Fatalf("erste Bestätigung save: %v", err)
	}

	// Recheck für die zweite Buchung muss jetzt "belegt" liefern -> 409.
	belegt, err = raumBelegt(app, raum.Id, start, von, bis, 0, bID)
	if err != nil {
		t.Fatalf("raumBelegt (nachher): %v", err)
	}
	if !belegt {
		t.Fatalf("Recheck sollte den Raum nach der ersten Bestätigung als belegt melden")
	}
}

// erstelleAngefragteBuchung legt eine minimale angefragte Buchung (raum="") an.
func erstelleAngefragteBuchung(t *testing.T, app core.App, start, ende string) string {
	t.Helper()
	ang, err := app.FindFirstRecordByFilter("angebotsarten", "aktiv = true", nil)
	if err != nil || ang == nil {
		t.Fatalf("angebotsart seed fehlt: %v", err)
	}
	thms, err := app.FindAllRecords("themen")
	if err != nil || len(thms) == 0 {
		t.Fatalf("themen seed fehlt: %v", err)
	}
	col, err := app.FindCollectionByNameOrId("buchungen")
	if err != nil {
		t.Fatal(err)
	}
	b := core.NewRecord(col)
	b.Set("status", "angefragt")
	b.Set("angebotsart", ang.Id)
	b.Set("thema", thms[0].Id)
	b.Set("start", start)
	b.Set("ende", ende)
	b.Set("teilnehmer_geplant", 20)
	b.Set("herkunft_land", "Deutschland")
	b.Set("kontakt_name", "Frau Muster")
	b.Set("kontakt_email", "muster@example.com")
	b.Set("kontakt_telefon", "0170-99999")
	if err := app.Save(b); err != nil {
		t.Fatalf("buchung save: %v", err)
	}
	return b.Id
}

// mustParse liest einen gespeicherten Datetime-String als time.Time (wie ihn die
// Routen via GetDateTime().Time() erhalten).
func mustParse(t *testing.T, s string) time.Time {
	t.Helper()
	dt, err := types.ParseDateTime(s)
	if err != nil {
		t.Fatalf("ParseDateTime(%q): %v", s, err)
	}
	return dt.Time()
}
