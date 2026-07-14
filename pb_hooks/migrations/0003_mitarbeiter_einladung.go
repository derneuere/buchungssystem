package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 0003 fügt der Auth-Collection `mitarbeiter` zwei Felder für den
// E-Mail-Einladungs-Flow hinzu: einen gehashten Einladungs-Token und dessen
// Ablaufzeitpunkt. Eingeladene Mitarbeiter setzen Name + Passwort selbst über
// /admin/einladung (öffentliche Route validiert den Token). Das Token-Hash-Feld
// ist Hidden, damit es nicht über die API zurückgegeben wird.
func init() {
	m.Register(func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("mitarbeiter")
		if err != nil {
			return err
		}
		col.Fields.Add(
			&core.TextField{Name: "einladung_token_hash", Max: 128, Hidden: true},
			&core.DateField{Name: "einladung_expires", Hidden: true},
		)
		return app.Save(col)
	}, func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("mitarbeiter")
		if err != nil {
			return err
		}
		col.Fields.RemoveByName("einladung_token_hash")
		col.Fields.RemoveByName("einladung_expires")
		return app.Save(col)
	})
}
