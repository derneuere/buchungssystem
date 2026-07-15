// Package main — auth.go
//
// RBAC-Helfer: liest die wirksame Rolle des eingeloggten mitarbeiter-Records
// und stellt eine Guard-Middleware bereit, die nach apis.RequireAuth gekettet
// wird. Der TEST_MODE-Rollen-Override schreibt die rolle direkt im DB-Record um
// (routes_qa.go); GetString("rolle") ist damit stets die effektive Rolle — kein
// Sonderfall nötig, und die Collection-Rules (@request.auth.rolle) greifen auf
// demselben Wert.
package main

import (
	"net/http"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// rolleVon liefert die wirksame Rolle des eingeloggten mitarbeiter-Records
// (leer, wenn nicht authentifiziert oder keine mitarbeiter-Auth).
func rolleVon(e *core.RequestEvent) string {
	if e.Auth == nil {
		return ""
	}
	return e.Auth.GetString("rolle")
}

// requireRolle ist eine nach RequireAuth gekettete Guard-Middleware: sie lässt
// nur die genannten Rollen durch, sonst 403.
func requireRolle(erlaubt ...string) func(*core.RequestEvent) error {
	set := make(map[string]bool, len(erlaubt))
	for _, r := range erlaubt {
		set[r] = true
	}
	return func(e *core.RequestEvent) error {
		if !set[rolleVon(e)] {
			return apis.NewApiError(http.StatusForbidden, "Für diese Aktion fehlt die Berechtigung.", nil)
		}
		return e.Next()
	}
}
