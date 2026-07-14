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
