// Package migrations contains the PocketBase schema + seed migrations for the
// Gedenkstätte-Buchungssystem. Each file registers itself via init()->m.Register
// (up, down). Collections are built programmatically with core.NewBaseCollection
// / core.NewAuthCollection and typed field structs (v0.36 style).
package migrations

import "github.com/pocketbase/pocketbase/core"

// staffRule is the reusable "only authenticated staff" access rule.
// Per SPEC §2.1 we never use null for staff-only (that would lock out
// mitarbeiter too); "@request.auth.id != \"\"" is the durchgängige Konvention.
const staffRule = `@request.auth.id != ""`

// publicActiveRule allows public read of only active rows, staff read of all.
const publicActiveRule = `aktiv = true || @request.auth.id != ""`

// ptr returns a pointer to any value — used for *string access rules and
// *float64 field min/max limits.
func ptr[T any](v T) *T { return &v }

// addTimestamps appends the conventional created/updated autodate fields.
// core.NewBaseCollection only seeds the id field, so created/updated must be
// added explicitly (matching the reference JSON collections).
func addTimestamps(c *core.Collection) {
	c.Fields.Add(
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
}

// setRules setzt List/View/Create/Update/Delete-Rule einer Collection in einem
// Aufruf (nil = superuser-only) und speichert. Wird von der RBAC-Migration 0007
// genutzt, um die Rechte-Matrix atomar zu setzen.
func setRules(app core.App, name string, list, view, create, update, del *string) error {
	col, err := app.FindCollectionByNameOrId(name)
	if err != nil {
		return err
	}
	col.ListRule = list
	col.ViewRule = view
	col.CreateRule = create
	col.UpdateRule = update
	col.DeleteRule = del
	return app.Save(col)
}

// setCUD setzt nur Create/Update/Delete-Rule (List/View unangetastet).
func setCUD(app core.App, name string, rule *string) error {
	col, err := app.FindCollectionByNameOrId(name)
	if err != nil {
		return err
	}
	col.CreateRule = rule
	col.UpdateRule = rule
	col.DeleteRule = rule
	return app.Save(col)
}

// setUpdateOnly setzt nur die Update-Rule (für Singletons wie einstellungen,
// die kein Create/Delete kennen).
func setUpdateOnly(app core.App, name string, rule *string) error {
	col, err := app.FindCollectionByNameOrId(name)
	if err != nil {
		return err
	}
	col.UpdateRule = rule
	return app.Save(col)
}

// setListView setzt nur List/View-Rule (C/U/D unangetastet). Wird von 0007
// genutzt, um rein interne Collections vom Direkt-REST-Lesen der Auskunftsrolle
// auszuschließen, ohne öffentlich lesbare Stammdaten anzufassen.
func setListView(app core.App, name string, list, view *string) error {
	col, err := app.FindCollectionByNameOrId(name)
	if err != nil {
		return err
	}
	col.ListRule = list
	col.ViewRule = view
	return app.Save(col)
}
