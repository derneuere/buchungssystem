package main

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// TestMitarbeiterEmailNormalisierung sichert die Regression zu „Failed to
// authenticate" durch Groß-/Kleinschreibung/Leerzeichen: der in
// registerMitarbeiterRoutes gebundene Hook muss die E-Mail bei create UND update
// auf trim + lowercase normalisieren, damit der case-sensitive PocketBase-
// Login-Abgleich zuverlässig greift.
func TestMitarbeiterEmailNormalisierung(t *testing.T) {
	app, cleanup := bootTestApp(t)
	defer cleanup()
	registerMitarbeiterRoutes(app) // bindet die Normalisierungs-Hooks

	col, err := app.FindCollectionByNameOrId("mitarbeiter")
	if err != nil {
		t.Fatal(err)
	}
	rec := core.NewRecord(col)
	rec.Set("email", "  Gemischt.Case@Example.COM ")
	rec.SetPassword("GeheimesPasswort123")
	rec.Set("name", "Test")
	rec.Set("rolle", "mitarbeiter")
	rec.Set("aktiv", true)
	rec.Set("verified", true)
	if err := app.Save(rec); err != nil {
		t.Fatalf("create: %v", err)
	}
	reload, err := app.FindRecordById("mitarbeiter", rec.Id)
	if err != nil {
		t.Fatal(err)
	}
	if got := reload.GetString("email"); got != "gemischt.case@example.com" {
		t.Fatalf("nach create: email = %q, want kleingeschrieben/getrimmt", got)
	}

	// Update mit gemischter Schreibweise muss ebenfalls normalisiert werden.
	rec.Set("email", "ANDERS@Example.com")
	if err := app.Save(rec); err != nil {
		t.Fatalf("update: %v", err)
	}
	reload, err = app.FindRecordById("mitarbeiter", rec.Id)
	if err != nil {
		t.Fatal(err)
	}
	if got := reload.GetString("email"); got != "anders@example.com" {
		t.Fatalf("nach update: email = %q, want anders@example.com", got)
	}
}
