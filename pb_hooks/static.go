// Package main — static.go
//
// Static SPA serving + security headers (SPEC §4.4, §6.3, §6.4). The catch-all
// is registered LAST so that /api/* and /_/* keep their more specific matches;
// unknown paths fall back to index.html (client-side routing).
package main

import (
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// securityHeadersMiddleware sets the iFrame-embedding-friendly security headers
// (SPEC §6.4): a frame-ancestors CSP (self + optional TYPO3 domain from the
// EMBED_FRAME_ANCESTORS env), plus nosniff and a privacy-preserving referrer
// policy. Deliberately NO X-Frame-Options (would block the TYPO3 embed).
func securityHeadersMiddleware(e *core.RequestEvent) error {
	frameAncestors := "'self'"
	if extra := strings.TrimSpace(os.Getenv("EMBED_FRAME_ANCESTORS")); extra != "" {
		frameAncestors += " " + extra
	}
	h := e.Response.Header()
	h.Set("Content-Security-Policy", "frame-ancestors "+frameAncestors+";")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	return e.Next()
}

// registerStaticServing wires the security headers + SPA catch-all. Single
// wire-up point; called LAST from main().
func registerStaticServing(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.BindFunc(securityHeadersMiddleware)
		se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), true))
		return se.Next()
	})
}
