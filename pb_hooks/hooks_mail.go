// Package main — hooks_mail.go
//
// Transaktionsmails (SPEC §4.5, E9) are sent EXPLICITLY from the route handlers
// (Eingangsbestätigung/Team im buchungsanfrage-Handler, Zu-/Absage in
// bestaetigen/ablehnen). This file provides those send helpers plus the guard
// hook registerMailHooks: an OnRecordCreateRequest("buchungen") that rejects any
// REST-layer create so createRule=null is doubly enforced (SPEC §4.4).
package main

import (
	"bytes"
	"html/template"
	"log"
	"net/mail"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
)

// registerMailHooks installs the create-guard for buchungen. The legitimate
// write path (app.Save from the custom route) does NOT trigger this
// request-layer hook, so it only ever fires for a forbidden REST create.
func registerMailHooks(app *pocketbase.PocketBase) {
	app.OnRecordCreateRequest("buchungen").BindFunc(func(e *core.RecordRequestEvent) error {
		return apis.NewForbiddenError(
			"Buchungen können nur über /api/public/buchungsanfrage erstellt werden.", nil)
	})
}

// --- low-level send --------------------------------------------------------

func sendMail(app core.App, toAddr, toName, subject, htmlBody, textBody string) {
	if toAddr == "" {
		return
	}
	settings := app.Settings()
	msg := &mailer.Message{
		From:    mail.Address{Address: settings.Meta.SenderAddress, Name: settings.Meta.SenderName},
		To:      []mail.Address{{Address: toAddr, Name: toName}},
		Subject: subject,
		HTML:    htmlBody,
		Text:    textBody,
	}
	if err := app.NewMailClient().Send(msg); err != nil {
		// Mailfehler NIE den Vorgang blockieren — nur loggen (SPEC §4.5).
		log.Printf("[mail] Versand an %q fehlgeschlagen: %v", toAddr, err)
	}
}

// --- helpers ---------------------------------------------------------------

func terminText(app core.App, b *core.Record) string {
	start := b.GetDateTime("start").Time().In(berlinLoc())
	return start.Format("02.01.2006 15:04") + " Uhr"
}

func angebotName(app core.App, b *core.Record) string {
	if r, err := app.FindRecordById("angebotsarten", b.GetString("angebotsart")); err == nil && r != nil {
		return r.GetString("name")
	}
	return "Angebot"
}

func themaName(app core.App, b *core.Record) string {
	if r, err := app.FindRecordById("themen", b.GetString("thema")); err == nil && r != nil {
		return r.GetString("name")
	}
	return ""
}

type mailData struct {
	Name     string
	Angebot  string
	Thema    string
	Termin   string
	Personen int
	Grund    string
}

func renderMail(tmpl string, data mailData) string {
	t, err := template.New("m").Parse(tmpl)
	if err != nil {
		return ""
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return ""
	}
	return buf.String()
}

// --- Eingangsbestätigung (an Kontakt) --------------------------------------

func sendEingangsbestaetigung(app core.App, b *core.Record) {
	data := mailData{
		Name:     b.GetString("kontakt_name"),
		Angebot:  angebotName(app, b),
		Thema:    themaName(app, b),
		Termin:   terminText(app, b),
		Personen: b.GetInt("teilnehmer_geplant"),
	}
	html := renderMail(`<p>Guten Tag {{.Name}},</p>
<p>vielen Dank für Ihre Anfrage bei der Gedenkstätte Deutscher Widerstand. Wir haben folgende Anfrage erhalten:</p>
<ul>
<li><strong>Angebot:</strong> {{.Angebot}}</li>
<li><strong>Thema:</strong> {{.Thema}}</li>
<li><strong>Wunschtermin:</strong> {{.Termin}}</li>
<li><strong>Personen:</strong> {{.Personen}}</li>
</ul>
<p>Dies ist eine Anfrage. Verbindlich wird die Buchung erst nach Bestätigung durch die Gedenkstätte. Sie erhalten in Kürze eine weitere Nachricht von uns.</p>
<p>Mit freundlichen Grüßen<br>Gedenkstätte Deutscher Widerstand</p>`, data)
	text := "Guten Tag " + data.Name + ",\n\nvielen Dank für Ihre Anfrage bei der Gedenkstätte Deutscher Widerstand.\n" +
		"Angebot: " + data.Angebot + "\nThema: " + data.Thema + "\nWunschtermin: " + data.Termin +
		"\nPersonen: " + itoa(data.Personen) + "\n\nDies ist eine Anfrage. Verbindlich wird die Buchung erst nach Bestätigung durch die Gedenkstätte.\n\nMit freundlichen Grüßen\nGedenkstätte Deutscher Widerstand"
	sendMail(app, b.GetString("kontakt_email"), data.Name, "Ihre Anfrage bei der Gedenkstätte Deutscher Widerstand", html, text)
}

// --- interne Team-Benachrichtigung -----------------------------------------

func sendTeamBenachrichtigung(app core.App, b *core.Record) {
	e, _, err := ladeEinstellungen(app)
	if err != nil || e.TeamEmail == "" {
		return
	}
	data := mailData{
		Name:     b.GetString("kontakt_name"),
		Angebot:  angebotName(app, b),
		Thema:    themaName(app, b),
		Termin:   terminText(app, b),
		Personen: b.GetInt("teilnehmer_geplant"),
	}
	spam := ""
	if b.GetBool("spam_verdacht") {
		spam = " [SPAM-VERDACHT]"
	}
	html := renderMail(`<p>Neue Buchungsanfrage{{if .Grund}} {{.Grund}}{{end}}:</p>
<ul>
<li><strong>Angebot:</strong> {{.Angebot}}</li>
<li><strong>Thema:</strong> {{.Thema}}</li>
<li><strong>Termin:</strong> {{.Termin}}</li>
<li><strong>Personen:</strong> {{.Personen}}</li>
<li><strong>Kontakt:</strong> {{.Name}}</li>
</ul>`, mailData{Angebot: data.Angebot, Thema: data.Thema, Termin: data.Termin, Personen: data.Personen, Name: data.Name, Grund: spam})
	text := "Neue Buchungsanfrage" + spam + ":\nAngebot: " + data.Angebot + "\nThema: " + data.Thema +
		"\nTermin: " + data.Termin + "\nPersonen: " + itoa(data.Personen) + "\nKontakt: " + data.Name
	sendMail(app, e.TeamEmail, "Team", "Neue Buchungsanfrage"+spam, html, text)
}

// --- Zusage / Absage --------------------------------------------------------

func sendZusage(app core.App, b *core.Record) {
	data := mailData{
		Name:    b.GetString("kontakt_name"),
		Angebot: angebotName(app, b),
		Thema:   themaName(app, b),
		Termin:  terminText(app, b),
	}
	html := renderMail(`<p>Guten Tag {{.Name}},</p>
<p>wir freuen uns, Ihre Buchung bestätigen zu können:</p>
<ul>
<li><strong>Angebot:</strong> {{.Angebot}}</li>
<li><strong>Thema:</strong> {{.Thema}}</li>
<li><strong>Termin:</strong> {{.Termin}}</li>
</ul>
<p>Wir freuen uns auf Ihren Besuch.</p>
<p>Mit freundlichen Grüßen<br>Gedenkstätte Deutscher Widerstand</p>`, data)
	text := "Guten Tag " + data.Name + ",\n\nwir freuen uns, Ihre Buchung zu bestätigen:\nAngebot: " +
		data.Angebot + "\nThema: " + data.Thema + "\nTermin: " + data.Termin +
		"\n\nWir freuen uns auf Ihren Besuch.\n\nMit freundlichen Grüßen\nGedenkstätte Deutscher Widerstand"
	sendMail(app, b.GetString("kontakt_email"), data.Name, "Ihre Buchung ist bestätigt", html, text)
}

func sendAbsage(app core.App, b *core.Record, grund string, grundSenden bool) {
	data := mailData{
		Name:    b.GetString("kontakt_name"),
		Angebot: angebotName(app, b),
		Termin:  terminText(app, b),
	}
	if grundSenden {
		data.Grund = grund
	}
	html := renderMail(`<p>Guten Tag {{.Name}},</p>
<p>leider können wir Ihre Anfrage ({{.Angebot}}, {{.Termin}}) nicht bestätigen.</p>
{{if .Grund}}<p>{{.Grund}}</p>{{end}}
<p>Gerne können Sie eine neue Anfrage für einen anderen Termin stellen.</p>
<p>Mit freundlichen Grüßen<br>Gedenkstätte Deutscher Widerstand</p>`, data)
	text := "Guten Tag " + data.Name + ",\n\nleider können wir Ihre Anfrage (" + data.Angebot + ", " +
		data.Termin + ") nicht bestätigen.\n"
	if data.Grund != "" {
		text += data.Grund + "\n"
	}
	text += "\nGerne können Sie eine neue Anfrage stellen.\n\nMit freundlichen Grüßen\nGedenkstätte Deutscher Widerstand"
	sendMail(app, b.GetString("kontakt_email"), data.Name, "Ihre Anfrage bei der Gedenkstätte Deutscher Widerstand", html, text)
}
