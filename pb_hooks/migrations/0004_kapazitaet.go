package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 0004 ergänzt das Kapazitätshandling (Umgang mit Unterbesetzung / fehlendem
// Raum, siehe docs/KAPAZITAET.md): neuer Status `warteliste` (Halte-Zustand,
// den der Verfall-Cron NICHT anfasst) sowie statusentkoppelte Flags. Additiv —
// keine Datenmigration bestehender Zeilen nötig.
func init() {
	m.Register(func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("buchungen")
		if err != nil {
			return err
		}
		// 'warteliste' zum Status-Select ergänzen.
		if f, ok := col.Fields.GetByName("status").(*core.SelectField); ok {
			has := false
			for _, v := range f.Values {
				if v == "warteliste" {
					has = true
				}
			}
			if !has {
				f.Values = append(f.Values, "warteliste")
			}
		}
		col.Fields.Add(
			&core.BoolField{Name: "unterbesetzt"},
			&core.BoolField{Name: "raum_offen"},
			&core.TextField{Name: "bestaetigt_trotz_grund", Max: 2000},
		)
		return app.Save(col)
	}, func(app core.App) error {
		col, err := app.FindCollectionByNameOrId("buchungen")
		if err != nil {
			return err
		}
		col.Fields.RemoveByName("unterbesetzt")
		col.Fields.RemoveByName("raum_offen")
		col.Fields.RemoveByName("bestaetigt_trotz_grund")
		if f, ok := col.Fields.GetByName("status").(*core.SelectField); ok {
			kept := f.Values[:0]
			for _, v := range f.Values {
				if v != "warteliste" {
					kept = append(kept, v)
				}
			}
			f.Values = kept
		}
		return app.Save(col)
	})
}
