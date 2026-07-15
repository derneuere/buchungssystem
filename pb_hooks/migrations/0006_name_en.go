package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 0006 ergänzt optionale englische Bezeichner für die zweisprachige ÖFFENTLICHE
// Buchungsstrecke (?lang=en). Additiv: neue optionale TextFields, kein
// Unique-Index, NICHT hidden (müssen öffentlich lesbar sein). Fallback auf die
// deutschen Felder erfolgt im Frontend, wenn `name_en`/`beschreibung_en` leer.
//   themen:            name_en, beschreibung_en
//   angebotsarten:     name_en, beschreibung_en
//   einrichtungstypen: name_en
func init() {
	m.Register(func(app core.App) error {
		if col, err := app.FindCollectionByNameOrId("themen"); err == nil {
			col.Fields.Add(&core.TextField{Name: "name_en", Max: 255})
			col.Fields.Add(&core.TextField{Name: "beschreibung_en", Max: 2000})
			if err := app.Save(col); err != nil {
				return err
			}
		} else {
			return err
		}

		if col, err := app.FindCollectionByNameOrId("angebotsarten"); err == nil {
			col.Fields.Add(&core.TextField{Name: "name_en", Max: 255})
			col.Fields.Add(&core.TextField{Name: "beschreibung_en", Max: 2000})
			if err := app.Save(col); err != nil {
				return err
			}
		} else {
			return err
		}

		if col, err := app.FindCollectionByNameOrId("einrichtungstypen"); err == nil {
			col.Fields.Add(&core.TextField{Name: "name_en", Max: 255})
			if err := app.Save(col); err != nil {
				return err
			}
		} else {
			return err
		}

		return nil
	}, func(app core.App) error {
		specs := []struct {
			col    string
			fields []string
		}{
			{"themen", []string{"name_en", "beschreibung_en"}},
			{"angebotsarten", []string{"name_en", "beschreibung_en"}},
			{"einrichtungstypen", []string{"name_en"}},
		}
		for _, spec := range specs {
			col, err := app.FindCollectionByNameOrId(spec.col)
			if err != nil {
				return err
			}
			for _, f := range spec.fields {
				col.Fields.RemoveByName(f)
			}
			if err := app.Save(col); err != nil {
				return err
			}
		}
		return nil
	})
}
