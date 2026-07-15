package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 0007 setzt die verbindliche RBAC-Rechte-Matrix mit drei Rollen
// (leitung | mitarbeiter | auskunft) durch. Additiv:
//   - erweitert das rolle-Select um "auskunft" (idempotent, wie 0004 bei
//     "warteliste"),
//   - fügt der Auth-Collection mitarbeiter ein Hidden-Feld qa_rolle_original
//     hinzu (sichert die echte Rolle während eines TEST_MODE-Rollen-Override),
//   - stellt die Collection-Rules so um, dass Schema und Durchsetzung atomar
//     deploybar sind.
//
// Kern-Sicherheit: mitarbeiter.UpdateRule wird von staffRule (0001 erlaubte
// jedem Mitarbeiter, die eigene rolle zu ändern → Privilege-Escalation) auf
// istLeitung verschärft. Der QA-Override umgeht das bewusst über die
// Model-Layer-Save-Route (nur unter TEST_MODE).

// Rule-Bausteine für die RBAC-Matrix.
const (
	// istPersonal: eingeloggtes Personal, aber NICHT auskunft (leitung + mitarbeiter).
	istPersonal = `@request.auth.id != "" && @request.auth.rolle != "auskunft"`
	// istLeitung: nur die Leitung.
	istLeitung = `@request.auth.id != "" && @request.auth.rolle = "leitung"`
)

func init() {
	m.Register(func(app core.App) error {
		// --- (1) rolle-Select um "auskunft" erweitern (idempotent) ---
		mit, err := app.FindCollectionByNameOrId("mitarbeiter")
		if err != nil {
			return err
		}
		if f, ok := mit.Fields.GetByName("rolle").(*core.SelectField); ok {
			has := false
			for _, v := range f.Values {
				if v == "auskunft" {
					has = true
				}
			}
			if !has {
				f.Values = append(f.Values, "auskunft")
			}
		}
		// --- (2) Hidden-Feld qa_rolle_original ---
		if mit.Fields.GetByName("qa_rolle_original") == nil {
			mit.Fields.Add(&core.TextField{Name: "qa_rolle_original", Max: 20, Hidden: true})
		}
		// --- (3) mitarbeiter-Verwaltung nur Leitung (schließt Self-Eskalation) ---
		// List/View auf istPersonal: die Auskunft darf das Personalverzeichnis
		// (Namen/Rollen) auch per direkter REST-API NICHT enumerieren.
		mit.ListRule = ptr(istPersonal)
		mit.ViewRule = ptr(istPersonal)
		mit.UpdateRule = ptr(istLeitung)
		// Leitung darf löschen, aber niemals sich selbst.
		mit.DeleteRule = ptr(`@request.auth.id != "" && @request.auth.rolle = "leitung" && @request.auth.id != id`)
		if err := app.Save(mit); err != nil {
			return err
		}

		// referenten: List/View auf istPersonal (auskunft raus — referent.email
		// ist nicht Teil der Auskunfts-Sicht; die Auskunft erhält Name + Telefon
		// nur über die projizierende Route). C/U/D nur Leitung.
		if err := setRules(app, "referenten", ptr(istPersonal), ptr(istPersonal), ptr(istLeitung), ptr(istLeitung), ptr(istLeitung)); err != nil {
			return err
		}
		// verfuegbarkeiten: List/View auf istPersonal (auskunft hat keinen Zugriff).
		// C/U/D nur Leitung.
		if err := setRules(app, "verfuegbarkeiten", ptr(istPersonal), ptr(istPersonal), ptr(istLeitung), ptr(istLeitung), ptr(istLeitung)); err != nil {
			return err
		}
		// buchungen: List/View auf istPersonal (auskunft raus). Die sensiblen
		// Felder (E-Mail, Herkunft, Nachricht, interne/Planungs-Notizen) liegen
		// auf dieser Collection und dürfen NICHT per direkter REST-API an die
		// Auskunft gelangen — diese liest ausschließlich über die projizierende
		// Route /api/auskunft/* (Model-Layer, umgeht Rules). Create bleibt nil
		// (Custom-Route). Update/Delete: kein auskunft.
		if err := setRules(app, "buchungen", ptr(istPersonal), ptr(istPersonal), nil, ptr(istPersonal), ptr(istPersonal)); err != nil {
			return err
		}
		// buchung_referenten: List/View auf istPersonal (auskunft liest die
		// Zuordnungen nur projiziert über /api/auskunft/*). C/U/D kein auskunft
		// (auskunft schreibt Ist ausschließlich über die feld-whitelistende
		// Ist-Route mit System-Kontext).
		if err := setRules(app, "buchung_referenten", ptr(istPersonal), ptr(istPersonal), ptr(istPersonal), ptr(istPersonal), ptr(istPersonal)); err != nil {
			return err
		}
		// Übrige Stammdaten: C/U/D auf istPersonal (auskunft raus, mitarbeiter
		// darf). List/View unverändert lassen (öffentlich-aktiv bzw. staff).
		for _, name := range []string{"themen", "einrichtungstypen", "raeume", "angebotsarten", "schliesstage"} {
			if err := setCUD(app, name, ptr(istPersonal)); err != nil {
				return err
			}
		}
		// einstellungen (Singleton): nur Update, auskunft raus.
		if err := setUpdateOnly(app, "einstellungen", ptr(istPersonal)); err != nil {
			return err
		}
		// List/View rein interner Collections auf istPersonal (auskunft raus).
		// themen/angebotsarten/einrichtungstypen bleiben bewusst publicActiveRule,
		// da das öffentliche Buchungsformular sie liest.
		for _, name := range []string{"raeume", "schliesstage", "einstellungen"} {
			if err := setListView(app, name, ptr(istPersonal), ptr(istPersonal)); err != nil {
				return err
			}
		}
		return nil
	}, func(app core.App) error {
		// down: Rules auf den 0001/0004-Endzustand (staffRule) zurück, Feld +
		// auskunft-Value entfernen.
		mit, err := app.FindCollectionByNameOrId("mitarbeiter")
		if err != nil {
			return err
		}
		mit.ListRule = ptr(staffRule)
		mit.ViewRule = ptr(staffRule)
		mit.UpdateRule = ptr(staffRule)
		mit.DeleteRule = ptr(`@request.auth.id != "" && @request.auth.id != id`)
		mit.Fields.RemoveByName("qa_rolle_original")
		if f, ok := mit.Fields.GetByName("rolle").(*core.SelectField); ok {
			kept := f.Values[:0]
			for _, v := range f.Values {
				if v != "auskunft" {
					kept = append(kept, v)
				}
			}
			f.Values = kept
		}
		if err := app.Save(mit); err != nil {
			return err
		}

		if err := setRules(app, "referenten", ptr(staffRule), ptr(staffRule), ptr(staffRule), ptr(staffRule), ptr(staffRule)); err != nil {
			return err
		}
		if err := setRules(app, "verfuegbarkeiten", ptr(staffRule), ptr(staffRule), ptr(staffRule), ptr(staffRule), ptr(staffRule)); err != nil {
			return err
		}
		if err := setRules(app, "buchungen", ptr(staffRule), ptr(staffRule), nil, ptr(staffRule), ptr(staffRule)); err != nil {
			return err
		}
		if err := setRules(app, "buchung_referenten", ptr(staffRule), ptr(staffRule), ptr(staffRule), ptr(staffRule), ptr(staffRule)); err != nil {
			return err
		}
		for _, name := range []string{"themen", "einrichtungstypen", "raeume", "angebotsarten", "schliesstage"} {
			if err := setCUD(app, name, ptr(staffRule)); err != nil {
				return err
			}
		}
		if err := setUpdateOnly(app, "einstellungen", ptr(staffRule)); err != nil {
			return err
		}
		for _, name := range []string{"raeume", "schliesstage", "einstellungen"} {
			if err := setListView(app, name, ptr(staffRule), ptr(staffRule)); err != nil {
				return err
			}
		}
		return nil
	})
}
