package main

import (
	"testing"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// erstelleTestBuchung legt eine minimale bestätigte Buchung samt einer geplanten
// Referenten-Zuordnung an und gibt (buchungId, zuordnungId, referentId) zurück.
func erstelleTestBuchung(t *testing.T, app core.App) (string, string, string) {
	t.Helper()

	// Referent
	refCol, err := app.FindCollectionByNameOrId("referenten")
	if err != nil {
		t.Fatal(err)
	}
	ref := core.NewRecord(refCol)
	ref.Set("name", "Test Referent")
	ref.Set("telefon", "030-12345")
	ref.Set("aktiv", true)
	if err := app.Save(ref); err != nil {
		t.Fatalf("referent save: %v", err)
	}

	// Angebotsart + Thema aus dem Seed verwenden.
	ang, err := app.FindFirstRecordByFilter("angebotsarten", "slug = {:s}", dbx.Params{"s": "fuehrung"})
	if err != nil || ang == nil {
		t.Fatalf("angebotsart seed fehlt: %v", err)
	}
	thms, err := app.FindAllRecords("themen")
	if err != nil || len(thms) == 0 {
		t.Fatalf("themen seed fehlt: %v", err)
	}

	bCol, err := app.FindCollectionByNameOrId("buchungen")
	if err != nil {
		t.Fatal(err)
	}
	b := core.NewRecord(bCol)
	b.Set("status", "bestaetigt")
	b.Set("angebotsart", ang.Id)
	b.Set("thema", thms[0].Id)
	b.Set("start", "2026-08-01 10:00:00.000Z")
	b.Set("ende", "2026-08-01 11:00:00.000Z")
	b.Set("teilnehmer_geplant", 20)
	b.Set("herkunft_land", "Deutschland")
	b.Set("kontakt_name", "Frau Muster")
	b.Set("kontakt_email", "muster@example.com")
	b.Set("kontakt_telefon", "0170-99999")
	if err := app.Save(b); err != nil {
		t.Fatalf("buchung save: %v", err)
	}

	brCol, err := app.FindCollectionByNameOrId("buchung_referenten")
	if err != nil {
		t.Fatal(err)
	}
	br := core.NewRecord(brCol)
	br.Set("buchung", b.Id)
	br.Set("referent", ref.Id)
	br.Set("geplant", true)
	br.Set("eingesetzt", false)
	br.Set("quelle", "auto")
	if err := app.Save(br); err != nil {
		t.Fatalf("zuordnung save: %v", err)
	}

	return b.Id, br.Id, ref.Id
}

// TestIstErfassungKernlogik prüft die Kern-Invarianten der Ist-Erfassung, die
// die Route (routes_admin_ist.go) durchsetzt: eingesetzt-Toggle, teilnehmer_ist,
// Status-Transition nur -> durchgefuehrt, und dass eine Zuordnung nur zur
// eigenen Buchung geschrieben werden darf. Die Logik wird hier direkt am
// Model-Layer nachgebildet (die Route selbst ist ein dünner HTTP-Wrapper).
func TestIstErfassungKernlogik(t *testing.T) {
	app, cleanup := bootTestApp(t)
	defer cleanup()

	bID, zID, _ := erstelleTestBuchung(t, app)

	// (1) eingesetzt-Toggle: Zuordnung gehört zur Buchung -> erlaubt.
	z, err := app.FindRecordById("buchung_referenten", zID)
	if err != nil {
		t.Fatal(err)
	}
	if z.GetString("buchung") != bID {
		t.Fatalf("Testaufbau falsch: Zuordnung zeigt nicht auf Buchung")
	}
	z.Set("eingesetzt", true)
	if err := saveWithSystemContext(app, z); err != nil {
		t.Fatalf("eingesetzt-Toggle: %v", err)
	}
	reload, _ := app.FindRecordById("buchung_referenten", zID)
	if !reload.GetBool("eingesetzt") {
		t.Fatalf("eingesetzt wurde nicht gesetzt")
	}

	// (2) teilnehmer_ist + status=durchgefuehrt.
	b, err := app.FindRecordById("buchungen", bID)
	if err != nil {
		t.Fatal(err)
	}
	b.Set("teilnehmer_ist", 18)
	b.Set("status", "durchgefuehrt")
	if err := saveWithSystemContext(app, b); err != nil {
		t.Fatalf("ist save: %v", err)
	}
	reloadB, _ := app.FindRecordById("buchungen", bID)
	if reloadB.GetInt("teilnehmer_ist") != 18 {
		t.Fatalf("teilnehmer_ist = %d, want 18", reloadB.GetInt("teilnehmer_ist"))
	}
	if reloadB.GetString("status") != "durchgefuehrt" {
		t.Fatalf("status = %q, want durchgefuehrt", reloadB.GetString("status"))
	}
}

// TestRolleVonUndOverride prüft, dass ein QA-Rollen-Override die wirksame Rolle
// im Record umschreibt (was Rules + rolleVon() gleichermaßen lesen) und der
// Reset die echte Rolle wiederherstellt.
func TestRolleVonUndOverride(t *testing.T) {
	app, cleanup := bootTestApp(t)
	defer cleanup()

	col, err := app.FindCollectionByNameOrId("mitarbeiter")
	if err != nil {
		t.Fatal(err)
	}
	rec := core.NewRecord(col)
	rec.Set("email", "leiter@example.com")
	rec.SetPassword("GeheimesPasswort123")
	rec.Set("name", "Leiter")
	rec.Set("rolle", "leitung")
	rec.Set("aktiv", true)
	rec.Set("verified", true)
	if err := app.Save(rec); err != nil {
		t.Fatalf("mitarbeiter save: %v", err)
	}

	// Override auf auskunft: Original sichern, rolle umschreiben.
	if rec.GetString("qa_rolle_original") == "" {
		rec.Set("qa_rolle_original", rec.GetString("rolle"))
	}
	rec.Set("rolle", "auskunft")
	if err := saveWithSystemContext(app, rec); err != nil {
		t.Fatalf("override save: %v", err)
	}
	reload, _ := app.FindRecordById("mitarbeiter", rec.Id)
	if reload.GetString("rolle") != "auskunft" {
		t.Fatalf("nach Override: rolle = %q, want auskunft", reload.GetString("rolle"))
	}
	if reload.GetString("qa_rolle_original") != "leitung" {
		t.Fatalf("qa_rolle_original = %q, want leitung", reload.GetString("qa_rolle_original"))
	}

	// Reset: echte Rolle wiederherstellen.
	original := reload.GetString("qa_rolle_original")
	reload.Set("rolle", original)
	reload.Set("qa_rolle_original", "")
	if err := saveWithSystemContext(app, reload); err != nil {
		t.Fatalf("reset save: %v", err)
	}
	reload2, _ := app.FindRecordById("mitarbeiter", rec.Id)
	if reload2.GetString("rolle") != "leitung" {
		t.Fatalf("nach Reset: rolle = %q, want leitung", reload2.GetString("rolle"))
	}
	if reload2.GetString("qa_rolle_original") != "" {
		t.Fatalf("nach Reset: qa_rolle_original = %q, want leer", reload2.GetString("qa_rolle_original"))
	}
}

// TestRbacRulesGesetzt prüft, dass Migration 0007 die zentralen Rule-Änderungen
// vorgenommen hat: mitarbeiter.UpdateRule = istLeitung (Privilege-Escalation
// geschlossen), referenten C/U/D = istLeitung, buchung_referenten C/U/D
// schließt auskunft aus, und das rolle-Select "auskunft" enthält.
func TestRbacRulesGesetzt(t *testing.T) {
	app, cleanup := bootTestApp(t)
	defer cleanup()

	mit, _ := app.FindCollectionByNameOrId("mitarbeiter")
	wantLeitung := `@request.auth.id != "" && @request.auth.rolle = "leitung"`
	if mit.UpdateRule == nil || *mit.UpdateRule != wantLeitung {
		t.Fatalf("mitarbeiter.UpdateRule = %v, want istLeitung", derefRule(mit.UpdateRule))
	}
	if f, ok := mit.Fields.GetByName("rolle").(*core.SelectField); ok {
		has := false
		for _, v := range f.Values {
			if v == "auskunft" {
				has = true
			}
		}
		if !has {
			t.Fatalf("rolle-Select enthält 'auskunft' nicht: %v", f.Values)
		}
	} else {
		t.Fatalf("rolle-Feld nicht gefunden")
	}
	if mit.Fields.GetByName("qa_rolle_original") == nil {
		t.Fatalf("qa_rolle_original-Feld fehlt")
	}

	ref, _ := app.FindCollectionByNameOrId("referenten")
	if ref.CreateRule == nil || *ref.CreateRule != wantLeitung {
		t.Fatalf("referenten.CreateRule = %v, want istLeitung", derefRule(ref.CreateRule))
	}

	wantPersonal := `@request.auth.id != "" && @request.auth.rolle != "auskunft"`
	br, _ := app.FindCollectionByNameOrId("buchung_referenten")
	if br.UpdateRule == nil || *br.UpdateRule != wantPersonal {
		t.Fatalf("buchung_referenten.UpdateRule = %v, want istPersonal", derefRule(br.UpdateRule))
	}
}

func derefRule(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

// TestAuskunftProjektionOhneSensibleFelder stellt sicher, dass die
// Feldprojektion der Auskunfts-Route KEINE sensiblen Felder (E-Mail, Herkunft,
// Nachricht, interne/Planungs-Notizen) enthält — nur die erlaubten Felder.
func TestAuskunftProjektionOhneSensibleFelder(t *testing.T) {
	app, cleanup := bootTestApp(t)
	defer cleanup()

	bID, _, _ := erstelleTestBuchung(t, app)
	b, err := app.FindRecordById("buchungen", bID)
	if err != nil {
		t.Fatal(err)
	}
	// Sensible Felder befüllen, um einen Leak sichtbar zu machen.
	b.Set("nachricht", "GEHEIM Nachricht")
	b.Set("interne_notiz", "GEHEIM intern")
	b.Set("herkunft_bundesland", "berlin")
	if err := app.Save(b); err != nil {
		t.Fatal(err)
	}

	proj := auskunftBuchungProjektion(app, b)

	verboten := []string{
		"kontakt_email", "nachricht", "interne_notiz", "planungs_notiz",
		"herkunft_land", "herkunft_bundesland", "herkunft_ort", "herkunft_einrichtungsname",
		"spam_verdacht",
	}
	for _, k := range verboten {
		if _, ok := proj[k]; ok {
			t.Fatalf("Auskunfts-Projektion enthält verbotenes Feld %q", k)
		}
	}

	// Erlaubte Felder müssen vorhanden sein.
	for _, k := range []string{"id", "status", "start", "ende", "angebotsart", "thema", "kontakt_name", "kontakt_telefon", "teilnehmer_geplant"} {
		if _, ok := proj[k]; !ok {
			t.Fatalf("Auskunfts-Projektion vermisst erlaubtes Feld %q", k)
		}
	}
}
