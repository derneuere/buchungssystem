// Package main — routes_mitarbeiter.go
//
// Mitarbeiter-Einladungs-Flow: eine Admin-Route erstellt einen inaktiven
// mitarbeiter-Datensatz mit gehashtem Einladungs-Token und verschickt (falls
// SMTP konfiguriert) eine E-Mail mit Einladungslink; der Link wird zusätzlich
// zurückgegeben (Fallback ohne SMTP). Zwei öffentliche Routen prüfen den Token
// und nehmen die Einladung an (Name + Passwort setzen, Konto aktivieren).
package main

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"log"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

func registerMitarbeiterRoutes(app *pocketbase.PocketBase) {
	// Eigener Limiter für die öffentliche Annehmen-Route.
	limiter := NewIPRateLimiter(10, 10*time.Minute, 40, 24*time.Hour)

	// E-Mail bei JEDEM Schreibvorgang normalisieren (trim + lowercase), damit der
	// case-/whitespace-sensitive Login-Abgleich zuverlässig greift — unabhängig
	// vom Schreibpfad (Einladung, Seed-Admin, Superuser-UI). Siehe Migration 0005
	// für den einmaligen Bestandsabgleich.
	normalizeEmail := func(e *core.RecordEvent) error {
		norm := strings.ToLower(strings.TrimSpace(e.Record.GetString("email")))
		if norm != e.Record.GetString("email") {
			e.Record.Set("email", norm)
		}
		return e.Next()
	}
	app.OnRecordCreate("mitarbeiter").BindFunc(normalizeEmail)
	app.OnRecordUpdate("mitarbeiter").BindFunc(normalizeEmail)

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		auth := apis.RequireAuth("mitarbeiter")

		// ---- Admin: Mitarbeiter einladen -------------------------------
		se.Router.POST("/api/admin/mitarbeiter/einladen", func(e *core.RequestEvent) error {
			var body struct {
				Email string `json:"email"`
				Rolle string `json:"rolle"`
			}
			if err := e.BindBody(&body); err != nil {
				return apis.NewBadRequestError("Ungültige Anfrage.", nil)
			}
			email := strings.ToLower(strings.TrimSpace(body.Email))
			if !inviteEmailOk(email) {
				return apis.NewBadRequestError("Bitte eine gültige E-Mail-Adresse angeben.", nil)
			}
			rolle := body.Rolle
			if rolle != "leitung" {
				rolle = "mitarbeiter"
			}

			col, err := app.FindCollectionByNameOrId("mitarbeiter")
			if err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Interner Fehler.", nil)
			}

			existing, _ := app.FindFirstRecordByData("mitarbeiter", "email", email)
			var rec *core.Record
			if existing != nil {
				if existing.GetBool("aktiv") {
					return apis.NewBadRequestError("Diese E-Mail gehört bereits zu einem aktiven Konto.", nil)
				}
				rec = existing // noch nicht angenommene Einladung -> erneut einladen
			} else {
				rec = core.NewRecord(col)
				rec.Set("email", email)
				rec.SetPassword(inviteRandomToken(30)) // unbrauchbar bis Annahme
			}
			// name ist Pflichtfeld -> Platzhalter bis zur Annahme (dort ersetzt).
			if strings.TrimSpace(rec.GetString("name")) == "" {
				rec.Set("name", einladungNamePlatzhalter(email))
			}
			rec.Set("rolle", rolle)
			rec.Set("aktiv", false)
			rec.Set("verified", false)
			rec.Set("emailVisibility", true) // Kolleg:innen sehen die E-Mail in der Mitarbeiterliste

			raw := inviteRandomToken(24)
			rec.Set("einladung_token_hash", hashKey(raw))
			exp, _ := types.ParseDateTime(time.Now().Add(7 * 24 * time.Hour))
			rec.Set("einladung_expires", exp)

			if err := app.Save(rec); err != nil {
				log.Printf("[einladen] Speichern fehlgeschlagen: %v", err)
				return apis.NewApiError(http.StatusInternalServerError, "Einladung konnte nicht angelegt werden.", nil)
			}

			link := inviteLink(e, rec.Id, raw)
			sendEinladungsMail(app, email, link)

			return e.JSON(http.StatusOK, map[string]any{
				"id":    rec.Id,
				"email": email,
				"rolle": rolle,
				"link":  link,
			})
		}).Bind(auth)

		// ---- Öffentlich: Einladung prüfen ------------------------------
		se.Router.GET("/api/public/einladung", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query()
			rec := findValidInvite(app, q.Get("id"), q.Get("token"))
			if rec == nil {
				return e.JSON(http.StatusOK, map[string]any{"valid": false})
			}
			return e.JSON(http.StatusOK, map[string]any{
				"valid": true,
				"email": rec.GetString("email"),
			})
		})

		// ---- Öffentlich: Einladung annehmen (rate-limited) -------------
		se.Router.POST("/api/public/einladung/annehmen", func(e *core.RequestEvent) error {
			var body struct {
				ID       string `json:"id"`
				Token    string `json:"token"`
				Name     string `json:"name"`
				Password string `json:"password"`
			}
			if err := e.BindBody(&body); err != nil {
				return apis.NewBadRequestError("Ungültige Anfrage.", nil)
			}
			name := strings.TrimSpace(body.Name)
			if name == "" {
				return apis.NewBadRequestError("Bitte einen Namen angeben.", nil)
			}
			if len(body.Password) < 8 {
				return apis.NewBadRequestError("Das Passwort muss mindestens 8 Zeichen lang sein.", nil)
			}
			rec := findValidInvite(app, body.ID, body.Token)
			if rec == nil {
				return apis.NewBadRequestError("Die Einladung ist ungültig oder abgelaufen.", nil)
			}
			rec.Set("name", name)
			rec.SetPassword(body.Password)
			rec.Set("aktiv", true)
			rec.Set("verified", true)
			rec.Set("einladung_token_hash", "")
			rec.Set("einladung_expires", nil)
			if err := app.Save(rec); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Konto konnte nicht aktiviert werden.", nil)
			}
			return e.JSON(http.StatusOK, map[string]any{"email": rec.GetString("email")})
		}).BindFunc(limiter.Middleware())

		return se.Next()
	})
}

// --- Helpers ---------------------------------------------------------------

func inviteEmailOk(s string) bool {
	if !strings.Contains(s, "@") || len(s) > 255 {
		return false
	}
	_, err := mail.ParseAddress(s)
	return err == nil
}

func einladungNamePlatzhalter(email string) string {
	if i := strings.IndexByte(email, '@'); i > 0 {
		return email[:i]
	}
	return "Eingeladen"
}

func inviteRandomToken(nBytes int) string {
	b := make([]byte, nBytes)
	if _, err := rand.Read(b); err != nil {
		// Fallback: extrem unwahrscheinlich; Zeit-basiert, nur damit nichts leer bleibt.
		return hex.EncodeToString([]byte(time.Now().UTC().String()))
	}
	return hex.EncodeToString(b)
}

func inviteLink(e *core.RequestEvent, id, token string) string {
	proto := e.Request.Header.Get("X-Forwarded-Proto")
	if proto == "" {
		if e.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}
	host := e.Request.Host
	return proto + "://" + host + "/admin/einladung?id=" + url.QueryEscape(id) + "&token=" + url.QueryEscape(token)
}

func findValidInvite(app core.App, id, token string) *core.Record {
	if id == "" || token == "" {
		return nil
	}
	rec, err := app.FindRecordById("mitarbeiter", id)
	if err != nil || rec == nil {
		return nil
	}
	stored := rec.GetString("einladung_token_hash")
	if stored == "" {
		return nil
	}
	if subtle.ConstantTimeCompare([]byte(stored), []byte(hashKey(token))) != 1 {
		return nil
	}
	exp := rec.GetDateTime("einladung_expires")
	if exp.IsZero() || exp.Time().Before(time.Now()) {
		return nil
	}
	return rec
}

func sendEinladungsMail(app core.App, toAddr, link string) {
	html := `<p>Guten Tag,</p>
<p>Sie wurden eingeladen, im Buchungssystem der Gedenkstätte Deutscher Widerstand mitzuarbeiten.</p>
<p>Bitte legen Sie über den folgenden Link Ihren Namen und ein Passwort fest:</p>
<p><a href="` + link + `">Einladung annehmen</a></p>
<p>Der Link ist 7 Tage gültig. Falls Sie diese Einladung nicht erwartet haben, ignorieren Sie diese E-Mail.</p>
<p>Mit freundlichen Grüßen<br>Gedenkstätte Deutscher Widerstand</p>`
	text := "Guten Tag,\n\nSie wurden eingeladen, im Buchungssystem der Gedenkstätte Deutscher Widerstand mitzuarbeiten.\n" +
		"Bitte legen Sie über den folgenden Link Ihren Namen und ein Passwort fest:\n" + link +
		"\n\nDer Link ist 7 Tage gültig.\n\nMit freundlichen Grüßen\nGedenkstätte Deutscher Widerstand"
	sendMail(app, toAddr, "", "Einladung ins Buchungssystem der Gedenkstätte Deutscher Widerstand", html, text)
}
