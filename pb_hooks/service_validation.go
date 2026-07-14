// Package main — service_validation.go
//
// Server-side validation of the public Buchungsanfrage (SPEC §4.3.5). This is
// the single source of truth — the client validates identically for UX, but the
// server never trusts it. Returns a field->message error map (empty = valid)
// plus a cleaned/parsed struct ready for the capacity re-check and insert.
package main

import (
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// BuchungsanfrageRequest is the raw public request body. firma_website and
// formular_geladen_ts are transient anti-spam fields (never persisted, E10).
type BuchungsanfrageRequest struct {
	AngebotsartID           string `json:"angebotsart_id"`
	ThemaID                 string `json:"thema_id"`
	Start                   string `json:"start"`
	TeilnehmerGeplant       int    `json:"teilnehmer_geplant"`
	HerkunftLand            string `json:"herkunft_land"`
	HerkunftBundesland      string `json:"herkunft_bundesland"`
	HerkunftEinrichtungstyp string `json:"herkunft_einrichtungstyp_id"`
	HerkunftEinrichtungName string `json:"herkunft_einrichtungsname"`
	HerkunftOrt             string `json:"herkunft_ort"`
	KontaktName             string `json:"kontakt_name"`
	KontaktEmail            string `json:"kontakt_email"`
	KontaktTelefon          string `json:"kontakt_telefon"`
	Nachricht               string `json:"nachricht"`
	DatenschutzEinwilligung bool   `json:"datenschutz_einwilligung"`

	// Anti-Spam (transient)
	FirmaWebsite      string `json:"firma_website"`       // Honeypot
	FormularGeladenTS int64  `json:"formular_geladen_ts"` // epoch millis
}

// ValidierteBuchung carries the sanitized, type-checked values plus the
// resolved angebotsart record and computed start/ende (UTC).
type ValidierteBuchung struct {
	Req         *BuchungsanfrageRequest
	Angebotsart *core.Record
	Start       time.Time
	Ende        time.Time
}

var (
	htmlTagRe = regexp.MustCompile(`<[^>]*>`)
	bundeslandCodes = map[string]bool{
		"baden_wuerttemberg": true, "bayern": true, "berlin": true, "brandenburg": true,
		"bremen": true, "hamburg": true, "hessen": true, "mecklenburg_vorpommern": true,
		"niedersachsen": true, "nordrhein_westfalen": true, "rheinland_pfalz": true,
		"saarland": true, "sachsen": true, "sachsen_anhalt": true, "schleswig_holstein": true,
		"thueringen": true, "ausland_oder_keine_angabe": true,
	}
)

// sanitize strips HTML tags and control characters and trims/caps length —
// protects the admin UI from stored XSS (SPEC §4.3.5).
func sanitize(s string, maxLen int) string {
	s = htmlTagRe.ReplaceAllString(s, "")
	var b strings.Builder
	for _, r := range s {
		if r == '\n' || r == '\t' {
			b.WriteRune(r)
			continue
		}
		if r < 0x20 || r == 0x7f {
			continue
		}
		b.WriteRune(r)
	}
	out := strings.TrimSpace(b.String())
	if maxLen > 0 && len(out) > maxLen {
		out = out[:maxLen]
	}
	return out
}

// ValidateBuchungsanfrage validates and cleans the request in place. A non-empty
// returned map means the request is invalid (HTTP 400).
func ValidateBuchungsanfrage(app core.App, req *BuchungsanfrageRequest) (*ValidierteBuchung, map[string]string) {
	fehler := map[string]string{}

	// --- sanitize free text -------------------------------------------------
	req.KontaktName = sanitize(req.KontaktName, 255)
	req.KontaktEmail = sanitize(req.KontaktEmail, 255)
	req.KontaktTelefon = sanitize(req.KontaktTelefon, 100)
	req.Nachricht = sanitize(req.Nachricht, 1000)
	req.HerkunftLand = sanitize(req.HerkunftLand, 100)
	req.HerkunftBundesland = sanitize(req.HerkunftBundesland, 50)
	req.HerkunftEinrichtungName = sanitize(req.HerkunftEinrichtungName, 255)
	req.HerkunftOrt = sanitize(req.HerkunftOrt, 255)

	// --- Datenschutz --------------------------------------------------------
	if !req.DatenschutzEinwilligung {
		fehler["datenschutz_einwilligung"] = "Bitte stimmen Sie der Datenschutzerklärung zu."
	}

	// --- Kontakt ------------------------------------------------------------
	if req.KontaktName == "" {
		fehler["kontakt_name"] = "Bitte geben Sie einen Namen an."
	}
	if req.KontaktEmail == "" {
		fehler["kontakt_email"] = "Bitte geben Sie eine E-Mail-Adresse an."
	} else if _, err := mail.ParseAddress(req.KontaktEmail); err != nil {
		fehler["kontakt_email"] = "Bitte geben Sie eine gültige E-Mail-Adresse an."
	}

	// --- Angebotsart --------------------------------------------------------
	var angebotsart *core.Record
	if req.AngebotsartID == "" {
		fehler["angebotsart_id"] = "Bitte wählen Sie eine Angebotsart."
	} else {
		a, err := app.FindRecordById("angebotsarten", req.AngebotsartID)
		if err != nil || a == nil || !a.GetBool("aktiv") {
			fehler["angebotsart_id"] = "Ungültige Angebotsart."
		} else {
			angebotsart = a
		}
	}

	// --- Thema (+ Referenten-Abdeckung) ------------------------------------
	if req.ThemaID == "" {
		fehler["thema_id"] = "Bitte wählen Sie ein Thema."
	} else {
		t, err := app.FindRecordById("themen", req.ThemaID)
		if err != nil || t == nil || !t.GetBool("aktiv") {
			fehler["thema_id"] = "Ungültiges Thema."
		} else {
			refs, rerr := aktiveThemenReferenten(app, req.ThemaID)
			if rerr == nil && len(refs) == 0 {
				fehler["thema_id"] = "Für dieses Thema stehen derzeit keine Referent:innen zur Verfügung."
			}
		}
	}

	// --- Einrichtungstyp (optional) ----------------------------------------
	if req.HerkunftEinrichtungstyp != "" {
		et, err := app.FindRecordById("einrichtungstypen", req.HerkunftEinrichtungstyp)
		if err != nil || et == nil || !et.GetBool("aktiv") {
			fehler["herkunft_einrichtungstyp_id"] = "Ungültiger Einrichtungstyp."
		}
	}

	// --- Herkunft-Konsistenz -----------------------------------------------
	if req.HerkunftLand == "" {
		req.HerkunftLand = "Deutschland"
	}
	if strings.EqualFold(req.HerkunftLand, "Deutschland") {
		if req.HerkunftBundesland == "" {
			fehler["herkunft_bundesland"] = "Bitte wählen Sie ein Bundesland."
		} else if !bundeslandCodes[req.HerkunftBundesland] {
			fehler["herkunft_bundesland"] = "Ungültiges Bundesland."
		}
	} else if req.HerkunftBundesland != "" && !bundeslandCodes[req.HerkunftBundesland] {
		fehler["herkunft_bundesland"] = "Ungültiges Bundesland."
	}

	// --- Gruppengröße + Termin (benötigt gültige Angebotsart) --------------
	var startZeit, endeZeit time.Time
	if angebotsart != nil {
		e, _, err := ladeEinstellungen(app)
		if err == nil {
			minTn := angebotsart.GetInt("min_teilnehmer")
			if minTn < 1 {
				minTn = 1
			}
			maxTn := angebotsart.GetInt("max_teilnehmer")
			absolut := e.MaxGruppengroesseAbsolut
			if absolut <= 0 {
				absolut = 200
			}
			if req.TeilnehmerGeplant < minTn {
				fehler["teilnehmer_geplant"] = "Die Gruppe ist zu klein für dieses Angebot."
			} else if maxTn > 0 && req.TeilnehmerGeplant > maxTn {
				fehler["teilnehmer_geplant"] = "Die Gruppe überschreitet die maximale Teilnehmerzahl."
			} else if req.TeilnehmerGeplant > absolut {
				fehler["teilnehmer_geplant"] = "Die Gruppengröße ist unzulässig."
			}

			// Termin parsen + Vorlauffenster + Slot-Zugehörigkeit
			st, perr := parseStart(req.Start)
			if perr != nil {
				fehler["start"] = "Ungültiger Termin."
			} else {
				startZeit = st
				endeZeit = st.Add(time.Duration(angebotsart.GetInt("dauer_minuten")) * time.Minute)
				if !imVorlauffenster(st, e.VorlaufTageMin, e.VorlaufTageMax) {
					fehler["start"] = "Der Termin liegt außerhalb des buchbaren Zeitraums."
				} else if !slotGehoertZuAngebot(angebotsart, st) {
					fehler["start"] = "Ungültige Uhrzeit für dieses Angebot."
				}
			}
		}
	}

	if len(fehler) > 0 {
		return nil, fehler
	}
	return &ValidierteBuchung{
		Req:         req,
		Angebotsart: angebotsart,
		Start:       startZeit,
		Ende:        endeZeit,
	}, nil
}

// parseStart accepts RFC3339 (with Z or offset). Result is normalized to UTC.
func parseStart(s string) (time.Time, error) {
	layouts := []string{time.RFC3339, "2006-01-02T15:04:05Z07:00", "2006-01-02T15:04:05", "2006-01-02 15:04:05Z"}
	var lastErr error
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t.UTC(), nil
		} else {
			lastErr = err
		}
	}
	return time.Time{}, lastErr
}

// slotGehoertZuAngebot verifies the Berlin-local start time matches one of the
// angebotsart's configured zeitslots.
func slotGehoertZuAngebot(angebotsart *core.Record, start time.Time) bool {
	lm := localMinutes(start)
	for _, slot := range angebotsart.GetStringSlice("zeitslots") {
		if m, ok := parseHHMM(slot); ok && m == lm {
			return true
		}
	}
	return false
}
