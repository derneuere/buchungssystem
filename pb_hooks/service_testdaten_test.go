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
	if got := intOf(t, res, "buchungen"); got != 14 {
		t.Fatalf("buchungen = %d, want 14", got)
	}
	if got := intOf(t, res, "buchung_referenten"); got != 12 {
		t.Fatalf("buchung_referenten = %d, want 12", got)
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
	if got := intOf(t, del, "buchungen"); got != 14 {
		t.Fatalf("gelöschte buchungen = %d, want 14", got)
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
