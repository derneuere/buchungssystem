package main

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	_ "buchung/migrations"
)

// bootTestApp startet eine echte (temporäre) PocketBase, wendet alle
// Migrationen an und liefert die App + Cleanup. Spiegelt migrations_apply_test.go.
func bootTestApp(t *testing.T) (*pocketbase.PocketBase, func()) {
	t.Helper()
	tempDir, err := os.MkdirTemp("", "pb-buchung-testdaten-*")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir:  tempDir,
		HideStartBanner: true,
	})
	if err := app.Bootstrap(); err != nil {
		os.RemoveAll(tempDir)
		t.Fatalf("bootstrap: %v", err)
	}
	runner := core.NewMigrationsRunner(app, core.AppMigrations)
	if _, err := runner.Up(); err != nil {
		app.ResetBootstrapState()
		os.RemoveAll(tempDir)
		t.Fatalf("migrations up: %v", err)
	}
	return app, func() {
		app.ResetBootstrapState()
		os.RemoveAll(tempDir)
	}
}

func intOf(t *testing.T, m map[string]any, key string) int {
	t.Helper()
	v, ok := m[key].(int)
	if !ok {
		t.Fatalf("Zähler %q fehlt oder ist kein int: %#v", key, m[key])
	}
	return v
}

// TestGenerateUndReset prüft: generateTestdaten legt die erwarteten Mengen an,
// Seed-Stammdaten bleiben unangetastet, resetTestdaten entfernt exakt die
// Marker-Datensätze wieder (und lässt echte Daten stehen).
func TestGenerateUndReset(t *testing.T) {
	app, cleanup := bootTestApp(t)
	defer cleanup()

	themenVor, _ := app.FindAllRecords("themen")
	angeboteVor, _ := app.FindAllRecords("angebotsarten")

	res, err := generateTestdaten(app)
	if err != nil {
		t.Fatalf("generateTestdaten: %v", err)
	}
	if got := intOf(t, res, "referenten"); got != 4 {
		t.Fatalf("referenten = %d, want 4", got)
	}
	if got := intOf(t, res, "raeume"); got != 2 {
		t.Fatalf("raeume = %d, want 2", got)
	}
	if got := intOf(t, res, "verfuegbarkeiten"); got != 20 {
		t.Fatalf("verfuegbarkeiten = %d, want 20", got)
	}
	// Buchungen/Zuordnungen skalieren mit den historischen Testdaten — hier nur
	// „es wurde etwas angelegt"; die exakte Menge prüft der Reset-Vergleich unten.
	genBuchungen := intOf(t, res, "buchungen")
	if genBuchungen == 0 {
		t.Fatalf("buchungen = 0, want > 0")
	}
	genBR := intOf(t, res, "buchung_referenten")
	if genBR == 0 {
		t.Fatalf("buchung_referenten = 0, want > 0")
	}
	if got := intOf(t, res, "themen_zugeordnet"); got != len(themenVor) {
		t.Fatalf("themen_zugeordnet = %d, want %d", got, len(themenVor))
	}

	// Idempotenz: zweiter Aufruf legt nichts an.
	res2, err := generateTestdaten(app)
	if err != nil {
		t.Fatalf("generateTestdaten (2): %v", err)
	}
	if res2["bereits_vorhanden"] != true {
		t.Fatalf("zweiter Seed sollte bereits_vorhanden=true liefern: %#v", res2)
	}

	// Reset entfernt exakt die Testdaten.
	del, err := resetTestdaten(app)
	if err != nil {
		t.Fatalf("resetTestdaten: %v", err)
	}
	if got := intOf(t, del, "buchungen"); got != genBuchungen {
		t.Fatalf("gelöschte buchungen = %d, want %d (wie generiert)", got, genBuchungen)
	}
	if got := intOf(t, del, "buchung_referenten"); got != genBR {
		t.Fatalf("gelöschte buchung_referenten = %d, want %d (wie generiert)", got, genBR)
	}
	if got := intOf(t, del, "referenten"); got != 4 {
		t.Fatalf("gelöschte referenten = %d, want 4", got)
	}
	if got := intOf(t, del, "verfuegbarkeiten"); got != 20 {
		t.Fatalf("gelöschte verfuegbarkeiten = %d, want 20", got)
	}

	// Nach Reset: keine Marker-Datensätze mehr.
	restRef, _ := findTestRecords(app, "referenten", "name", testNamePrefix)
	if len(restRef) != 0 {
		t.Fatalf("nach Reset noch %d Test-Referenten übrig", len(restRef))
	}
	restBuchungen, _ := findTestRecords(app, "buchungen", "interne_notiz", testNotizMark)
	if len(restBuchungen) != 0 {
		t.Fatalf("nach Reset noch %d Test-Buchungen übrig", len(restBuchungen))
	}

	// Echte Seed-Stammdaten unangetastet.
	themenNach, _ := app.FindAllRecords("themen")
	if len(themenNach) != len(themenVor) {
		t.Fatalf("themen verändert: vor %d, nach %d", len(themenVor), len(themenNach))
	}
	angeboteNach, _ := app.FindAllRecords("angebotsarten")
	if len(angeboteNach) != len(angeboteVor) {
		t.Fatalf("angebotsarten verändert: vor %d, nach %d", len(angeboteVor), len(angeboteNach))
	}
}

// TestResetLoestFremdeZuordnung ist die Regression für den gemeldeten Fehler
// „the record cannot be deleted because it is part of a required reference …
// (buchung_referenten collection)": Ein Test-Referent, der noch von einer NICHT
// als Testdaten markierten Buchung (z. B. manuell/telefonisch erfasst) über
// buchung_referenten referenziert wird, blockierte das Löschen, weil diese
// Pflicht-Relation kein CascadeDelete hat. resetTestdaten muss die Zuordnung
// vorher lösen und trotzdem sauber durchlaufen.
func TestResetLoestFremdeZuordnung(t *testing.T) {
	app, cleanup := bootTestApp(t)
	defer cleanup()

	if _, err := generateTestdaten(app); err != nil {
		t.Fatalf("generateTestdaten: %v", err)
	}

	refs, err := findTestRecords(app, "referenten", "name", testNamePrefix)
	if err != nil || len(refs) == 0 {
		t.Fatalf("keine Test-Referenten: %v", err)
	}
	ref := refs[0]

	// Eine ECHTE Buchung ohne [TESTDATA]-Marker anlegen und den Test-Referenten
	// zuordnen — genau die Konstellation, die den Reset blockierte.
	angebote, _ := app.FindAllRecords("angebotsarten")
	themen, _ := app.FindAllRecords("themen")
	if len(angebote) == 0 || len(themen) == 0 {
		t.Fatalf("Seed-Stammdaten fehlen (angebote=%d themen=%d)", len(angebote), len(themen))
	}
	buchungCol, err := app.FindCollectionByNameOrId("buchungen")
	if err != nil {
		t.Fatalf("collection buchungen: %v", err)
	}
	echt := core.NewRecord(buchungCol)
	echt.Set("status", "bestaetigt")
	echt.Set("angebotsart", angebote[0].Id)
	echt.Set("thema", themen[0].Id)
	echt.Set("start", "2026-08-01 10:00:00.000Z")
	echt.Set("ende", "2026-08-01 11:30:00.000Z")
	echt.Set("teilnehmer_geplant", 20)
	echt.Set("herkunft_land", "Deutschland")
	echt.Set("kontakt_name", "Echte Person")
	echt.Set("kontakt_email", "echt@example.com")
	echt.Set("spam_verdacht", false)
	if err := app.Save(echt); err != nil {
		t.Fatalf("echte Buchung speichern: %v", err)
	}

	brCol, err := app.FindCollectionByNameOrId("buchung_referenten")
	if err != nil {
		t.Fatalf("collection buchung_referenten: %v", err)
	}
	br := core.NewRecord(brCol)
	br.Set("buchung", echt.Id)
	br.Set("referent", ref.Id)
	br.Set("geplant", true)
	br.Set("eingesetzt", false)
	br.Set("quelle", "manuell")
	if err := app.Save(br); err != nil {
		t.Fatalf("Fremd-Zuordnung speichern: %v", err)
	}

	// Reset muss trotz der Fremd-Zuordnung fehlerfrei durchlaufen.
	if _, err := resetTestdaten(app); err != nil {
		t.Fatalf("resetTestdaten mit Fremd-Zuordnung: %v", err)
	}

	// Test-Referenten sind gelöscht …
	restRef, _ := findTestRecords(app, "referenten", "name", testNamePrefix)
	if len(restRef) != 0 {
		t.Fatalf("nach Reset noch %d Test-Referenten übrig", len(restRef))
	}
	// … die blockierende Zuordnung ebenfalls …
	if _, err := app.FindRecordById("buchung_referenten", br.Id); err == nil {
		t.Fatalf("Fremd-Zuordnung sollte gelöscht sein")
	}
	// … die echte Buchung bleibt jedoch bestehen (kein Testdaten-Marker).
	if _, err := app.FindRecordById("buchungen", echt.Id); err != nil {
		t.Fatalf("echte Buchung sollte erhalten bleiben: %v", err)
	}
}
