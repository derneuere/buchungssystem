package migrations

import (
	"log"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 0005 normalisiert bestehende mitarbeiter-E-Mails auf Kleinschreibung ohne
// umschließende Leerzeichen. PocketBase speichert E-Mails unverändert und der
// Login-Abgleich ist case- und whitespace-sensitiv; eingeladene Konten werden
// bereits kleingeschrieben gespeichert, ältere Konten (z. B. der Seed-Admin oder
// per Superuser-UI angelegte) evtl. nicht. Zusammen mit der Normalisierung im
// Login-Formular verhindert das „Failed to authenticate" durch Groß-/
// Kleinschreibung oder Autofill-Leerzeichen. Idempotent; Konflikte (zwei Konten,
// die sich nur in der Schreibweise unterscheiden) werden übersprungen.
func init() {
	m.Register(func(app core.App) error {
		recs, err := app.FindAllRecords("mitarbeiter")
		if err != nil {
			return err
		}
		for _, r := range recs {
			orig := r.GetString("email")
			norm := strings.ToLower(strings.TrimSpace(orig))
			if norm == "" || norm == orig {
				continue
			}
			r.Set("email", norm)
			if err := app.Save(r); err != nil {
				// Kein harter Abbruch: z. B. Unique-Konflikt bei Duplikaten, die
				// sich nur in der Schreibweise unterscheiden. Loggen und weiter.
				log.Printf("[0005] E-Mail %q -> %q konnte nicht normalisiert werden: %v", orig, norm, err)
			}
		}
		return nil
	}, func(app core.App) error {
		// Nicht umkehrbar (verlustbehaftet) — bewusst ein No-op.
		return nil
	})
}
