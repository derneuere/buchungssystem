// Package main — helpers.go
//
// Small cross-cluster helpers.
package main

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
)

// jsonUnmarshal is a thin wrapper so route files don't each import encoding/json.
func jsonUnmarshal(b []byte, v any) error { return json.Unmarshal(b, v) }

// saveWithSystemContext persists a record via the model layer (app.Save), which
// bypasses collection API rules by design (SPEC §4.3.7). This is the ONLY
// sanctioned buchungen write path; createRule=null blocks the REST endpoint and
// the OnRecordCreateRequest guard (hooks_mail.go) blocks it a second time.
func saveWithSystemContext(app core.App, rec *core.Record) error {
	return app.Save(rec)
}
