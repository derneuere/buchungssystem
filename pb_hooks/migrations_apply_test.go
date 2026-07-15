package main

import (
	"os"
	"testing"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	// Ensure our migrations are registered into core.AppMigrations.
	_ "buchung/migrations"
)

// TestMigrationsApply boots a real (temp) PocketBase instance, runs ALL
// registered migrations (system + ours) and asserts the schema + seed came out
// as specified. This validates the programmatically-built collections at
// runtime — a plain `go build` cannot catch schema/rule mistakes.
func TestMigrationsApply(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "pb-buchung-mig-*")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDataDir:  tempDir,
		HideStartBanner: true,
	})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("bootstrap: %v", err)
	}
	defer app.ResetBootstrapState()

	runner := core.NewMigrationsRunner(app, core.AppMigrations)
	if _, err := runner.Up(); err != nil {
		t.Fatalf("migrations up: %v", err)
	}

	// All 11 collections must exist.
	want := []string{
		"mitarbeiter", "themen", "einrichtungstypen", "referenten", "raeume",
		"angebotsarten", "verfuegbarkeiten", "buchungen", "buchung_referenten",
		"einstellungen", "schliesstage",
	}
	for _, name := range want {
		col, err := app.FindCollectionByNameOrId(name)
		if err != nil || col == nil {
			t.Fatalf("collection %q missing: %v", name, err)
		}
	}

	// mitarbeiter must be an auth collection.
	if col, _ := app.FindCollectionByNameOrId("mitarbeiter"); col == nil || !col.IsAuth() {
		t.Fatalf("mitarbeiter must be an auth collection")
	}

	// buchungen.createRule must be null (E3 — create only via custom route).
	buchungen, _ := app.FindCollectionByNameOrId("buchungen")
	if buchungen.CreateRule != nil {
		t.Fatalf("buchungen.createRule must be null, got %q", *buchungen.CreateRule)
	}
	// buchungen list rule must exclude 'auskunft' after RBAC-Migration 0007
	// (auskunft liest nur projiziert über /api/auskunft/*).
	wantPersonal := `@request.auth.id != "" && @request.auth.rolle != "auskunft"`
	if buchungen.ListRule == nil || *buchungen.ListRule != wantPersonal {
		t.Fatalf("buchungen.listRule must be istPersonal, got %v", buchungen.ListRule)
	}

	// Rein interne Collections + Personalverzeichnis müssen 'auskunft' auch per
	// direkter REST-API vom Lesen ausschließen (List/View = istPersonal).
	for _, name := range []string{"mitarbeiter", "einstellungen", "raeume", "schliesstage", "referenten", "verfuegbarkeiten", "buchung_referenten"} {
		col, _ := app.FindCollectionByNameOrId(name)
		if col.ListRule == nil || *col.ListRule != wantPersonal {
			t.Fatalf("%s.listRule must be istPersonal, got %v", name, col.ListRule)
		}
		if col.ViewRule == nil || *col.ViewRule != wantPersonal {
			t.Fatalf("%s.viewRule must be istPersonal, got %v", name, col.ViewRule)
		}
	}

	// Öffentlich lesbare Stammdaten dürfen NICHT verschärft worden sein (das
	// öffentliche Formular liest sie): themen/angebotsarten/einrichtungstypen.
	const wantPublic = `aktiv = true || @request.auth.id != ""`
	themen, _ := app.FindCollectionByNameOrId("themen")
	if themen.ListRule == nil || *themen.ListRule != wantPublic {
		t.Fatalf("themen.listRule must allow public active read")
	}
	for _, name := range []string{"angebotsarten", "einrichtungstypen"} {
		col, _ := app.FindCollectionByNameOrId(name)
		if col.ListRule == nil || *col.ListRule != wantPublic {
			t.Fatalf("%s.listRule must stay public-active, got %v", name, col.ListRule)
		}
	}

	// Seed: einstellungen singleton with the documented defaults.
	e, err := app.FindFirstRecordByFilter("einstellungen", "1=1")
	if err != nil || e == nil {
		t.Fatalf("einstellungen singleton not seeded: %v", err)
	}
	if e.GetInt("puffer_minuten") != 30 || e.GetInt("vorlaufzeit_tage_min") != 5 {
		t.Fatalf("einstellungen defaults wrong: puffer=%d vorlauf_min=%d",
			e.GetInt("puffer_minuten"), e.GetInt("vorlaufzeit_tage_min"))
	}

	// Seed: both standard angebotsarten.
	for _, slug := range []string{"fuehrung", "seminar"} {
		r, err := app.FindFirstRecordByFilter("angebotsarten", "slug = {:s}", map[string]any{"s": slug})
		if err != nil || r == nil {
			t.Fatalf("angebotsart %q not seeded: %v", slug, err)
		}
	}

	// Seed: einrichtungstypen + themen present.
	et, _ := app.FindAllRecords("einrichtungstypen")
	if len(et) < 6 {
		t.Fatalf("expected >=6 einrichtungstypen, got %d", len(et))
	}
	th, _ := app.FindAllRecords("themen")
	if len(th) < 3 {
		t.Fatalf("expected >=3 themen, got %d", len(th))
	}
}
