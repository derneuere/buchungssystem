package migrations

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 0002_seed populates baseline configuration data:
//   - the einstellungen singleton (globale Defaults, SPEC §2.3),
//   - the two Standard-angebotsarten (Führung, Seminar),
//   - the einrichtungstypen catalogue,
//   - a few Beispiel-themen.
//
// An initial mitarbeiter is created ONLY when both SEED_ADMIN_EMAIL and
// SEED_ADMIN_PASSWORD are set — never with hardcoded credentials (SPEC).
func init() {
	m.Register(func(app core.App) error {
		// ---- einstellungen singleton ------------------------------------
		einstellungenCol, err := app.FindCollectionByNameOrId("einstellungen")
		if err != nil {
			return err
		}
		if existing, _ := app.FindFirstRecordByFilter("einstellungen", "1=1"); existing == nil {
			rec := core.NewRecord(einstellungenCol)
			rec.Set("puffer_minuten", 30)
			rec.Set("vorlaufzeit_tage_min", 5)
			rec.Set("vorlaufzeit_tage_max", 180)
			rec.Set("anfrage_verfall_stunden", 168)
			rec.Set("oeffnungstage", []string{"mo", "di", "mi", "do", "fr"})
			rec.Set("betriebsende", "18:00")
			rec.Set("max_gruppen_parallel_pro_tag_default", 3)
			rec.Set("max_gruppengroesse_absolut", 200)
			rec.Set("team_benachrichtigung_email", "")
			if err := app.Save(rec); err != nil {
				return err
			}
		}

		// ---- angebotsarten ----------------------------------------------
		angebotsartenCol, err := app.FindCollectionByNameOrId("angebotsarten")
		if err != nil {
			return err
		}
		type angebotsart struct {
			name        string
			slug        string
			beschreibung string
			dauer       int
			raum        bool
			minTn       int
			maxTn       int
			minRef      int
			betreuung   int // 0 => leer
			zeitslots   []string
			sort        int
		}
		angebote := []angebotsart{
			{
				name: "Führung", slug: "fuehrung",
				beschreibung: "Geführter Rundgang durch die Dauerausstellung.",
				dauer:        90, raum: false, minTn: 1, maxTn: 30, minRef: 1, betreuung: 0,
				zeitslots: []string{"10:00", "12:00", "14:00"}, sort: 1,
			},
			{
				name: "Seminar", slug: "seminar",
				beschreibung: "Vertiefendes Seminar mit Quellenarbeit im Seminarraum.",
				dauer:        240, raum: true, minTn: 1, maxTn: 30, minRef: 1, betreuung: 15,
				zeitslots: []string{"09:00", "13:00"}, sort: 2,
			},
		}
		for _, a := range angebote {
			if existing, _ := app.FindFirstRecordByFilter("angebotsarten", "slug = {:slug}", map[string]any{"slug": a.slug}); existing != nil {
				continue
			}
			rec := core.NewRecord(angebotsartenCol)
			rec.Set("name", a.name)
			rec.Set("slug", a.slug)
			rec.Set("beschreibung", a.beschreibung)
			rec.Set("dauer_minuten", a.dauer)
			rec.Set("benoetigt_raum", a.raum)
			rec.Set("min_teilnehmer", a.minTn)
			rec.Set("max_teilnehmer", a.maxTn)
			rec.Set("min_referenten", a.minRef)
			if a.betreuung > 0 {
				rec.Set("betreuungsschluessel", a.betreuung)
			}
			rec.Set("zeitslots", a.zeitslots)
			rec.Set("sort_order", a.sort)
			rec.Set("aktiv", true)
			if err := app.Save(rec); err != nil {
				return err
			}
		}

		// ---- einrichtungstypen ------------------------------------------
		einrichtungstypenCol, err := app.FindCollectionByNameOrId("einrichtungstypen")
		if err != nil {
			return err
		}
		einrichtungstypen := []string{
			"Schule", "Hochschule/Universität", "Erwachsenenbildung",
			"Verein/Privatgruppe", "Behörde", "Sonstige",
		}
		for i, name := range einrichtungstypen {
			if existing, _ := app.FindFirstRecordByFilter("einrichtungstypen", "name = {:name}", map[string]any{"name": name}); existing != nil {
				continue
			}
			rec := core.NewRecord(einrichtungstypenCol)
			rec.Set("name", name)
			rec.Set("sort_order", i+1)
			rec.Set("aktiv", true)
			if err := app.Save(rec); err != nil {
				return err
			}
		}

		// ---- Beispiel-themen --------------------------------------------
		themenCol, err := app.FindCollectionByNameOrId("themen")
		if err != nil {
			return err
		}
		themen := []string{
			"Widerstand im Nationalsozialismus",
			"Frauen im Widerstand",
			"20. Juli 1944",
		}
		for i, name := range themen {
			if existing, _ := app.FindFirstRecordByFilter("themen", "name = {:name}", map[string]any{"name": name}); existing != nil {
				continue
			}
			rec := core.NewRecord(themenCol)
			rec.Set("name", name)
			rec.Set("sort_order", i+1)
			rec.Set("aktiv", true)
			if err := app.Save(rec); err != nil {
				return err
			}
		}

		// ---- optionaler initialer mitarbeiter (nur via ENV) -------------
		adminEmail := os.Getenv("SEED_ADMIN_EMAIL")
		adminPass := os.Getenv("SEED_ADMIN_PASSWORD")
		if adminEmail != "" && adminPass != "" {
			mitarbeiterCol, err := app.FindCollectionByNameOrId("mitarbeiter")
			if err != nil {
				return err
			}
			if existing, _ := app.FindFirstRecordByFilter("mitarbeiter", "email = {:email}", map[string]any{"email": adminEmail}); existing == nil {
				rec := core.NewRecord(mitarbeiterCol)
				rec.Set("email", adminEmail)
				rec.SetPassword(adminPass)
				rec.Set("verified", true)
				rec.Set("name", "Administrator")
				rec.Set("rolle", "leitung")
				rec.Set("aktiv", true)
				if err := app.Save(rec); err != nil {
					return err
				}
				log.Printf("[seed] initialer mitarbeiter %q angelegt", adminEmail)
			}
		} else {
			log.Println("[seed] SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD nicht gesetzt — kein initialer mitarbeiter angelegt")
		}

		return nil
	}, func(app core.App) error {
		// down: remove seeded rows (best effort). Collections themselves are
		// dropped by 0001's down migration.
		for _, col := range []string{"themen", "einrichtungstypen", "angebotsarten", "einstellungen"} {
			recs, err := app.FindAllRecords(col)
			if err != nil {
				continue
			}
			for _, r := range recs {
				_ = app.Delete(r)
			}
		}
		return nil
	})
}
