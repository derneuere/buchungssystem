// Package main — service_verfuegbarkeit.go
//
// Shared availability / collision / room logic (SPEC §3.1–§3.4). All slot math
// works in "minutes since midnight, Europe/Berlin local time"; the DB stores
// UTC datetimes (SPEC §2.1). The pure functions (parseHHMM, overlaps,
// mergeIntervals, subtractInterval, BenoetigteReferenten) are unit-tested.
package main

import (
	"math"
	"sort"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Interval is a half-open time window within a single day, expressed in
// minutes since local midnight (Europe/Berlin).
type Interval struct {
	Von int
	Bis int
}

// SlotResult is the anti-scraping public shape: no names, ids or counts.
type SlotResult struct {
	Start   string `json:"start"`
	Ende    string `json:"ende"`
	Buchbar bool   `json:"buchbar"`
}

var berlinLocation *time.Location

// berlinLoc returns the Europe/Berlin location. The tzdata is embedded via the
// `time/tzdata` import in main.go, so this succeeds regardless of the host OS.
func berlinLoc() *time.Location {
	if berlinLocation != nil {
		return berlinLocation
	}
	loc, err := time.LoadLocation("Europe/Berlin")
	if err != nil {
		loc = time.UTC
	}
	berlinLocation = loc
	return loc
}

// parseHHMM converts "HH:MM" to minutes since midnight. ok=false on malformed.
func parseHHMM(s string) (int, bool) {
	if len(s) != 5 || s[2] != ':' {
		return 0, false
	}
	h := int(s[0]-'0')*10 + int(s[1]-'0')
	m := int(s[3]-'0')*10 + int(s[4]-'0')
	if s[0] < '0' || s[1] < '0' || s[3] < '0' || s[4] < '0' {
		return 0, false
	}
	if h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, false
	}
	return h*60 + m, true
}

// minutesToHHMM formats minutes-since-midnight back to "HH:MM".
func minutesToHHMM(total int) string {
	if total < 0 {
		total = 0
	}
	h := (total / 60) % 24
	m := total % 60
	buf := []byte{'0' + byte(h/10), '0' + byte(h%10), ':', '0' + byte(m/10), '0' + byte(m%10)}
	return string(buf)
}

// overlaps reports whether [aVon,aBis) and [bVon,bBis) intersect. Touching
// boundaries (back-to-back slots) do NOT overlap.
func overlaps(aVon, aBis, bVon, bBis int) bool {
	return aVon < bBis && bVon < aBis
}

// mergeIntervals returns the union of the input intervals as a sorted, disjoint
// set. Adjacent/overlapping intervals are merged; empty/inverted are dropped.
func mergeIntervals(in []Interval) []Interval {
	cleaned := make([]Interval, 0, len(in))
	for _, iv := range in {
		if iv.Bis > iv.Von {
			cleaned = append(cleaned, iv)
		}
	}
	if len(cleaned) == 0 {
		return nil
	}
	sort.Slice(cleaned, func(i, j int) bool { return cleaned[i].Von < cleaned[j].Von })
	out := []Interval{cleaned[0]}
	for _, iv := range cleaned[1:] {
		last := &out[len(out)-1]
		if iv.Von <= last.Bis { // overlapping or touching -> merge
			if iv.Bis > last.Bis {
				last.Bis = iv.Bis
			}
		} else {
			out = append(out, iv)
		}
	}
	return out
}

// subtractInterval removes `cut` from every interval in `base`, returning the
// remaining disjoint pieces.
func subtractInterval(base []Interval, cut Interval) []Interval {
	if cut.Bis <= cut.Von {
		return base
	}
	out := make([]Interval, 0, len(base))
	for _, iv := range base {
		// no overlap -> keep as is
		if cut.Bis <= iv.Von || cut.Von >= iv.Bis {
			out = append(out, iv)
			continue
		}
		// left remainder
		if cut.Von > iv.Von {
			out = append(out, Interval{Von: iv.Von, Bis: cut.Von})
		}
		// right remainder
		if cut.Bis < iv.Bis {
			out = append(out, Interval{Von: cut.Bis, Bis: iv.Bis})
		}
	}
	return out
}

// wochentagCode maps a time to the "mo".."so" domain codes used in the schema.
func wochentagCode(t time.Time) string {
	switch t.Weekday() {
	case time.Monday:
		return "mo"
	case time.Tuesday:
		return "di"
	case time.Wednesday:
		return "mi"
	case time.Thursday:
		return "do"
	case time.Friday:
		return "fr"
	case time.Saturday:
		return "sa"
	default:
		return "so"
	}
}

// sameLocalDate reports whether two instants fall on the same Berlin-local day.
func sameLocalDate(a, b time.Time) bool {
	loc := berlinLoc()
	ay, am, ad := a.In(loc).Date()
	by, bm, bd := b.In(loc).Date()
	return ay == by && am == bm && ad == bd
}

// localMinutes returns the minutes-since-midnight of t in Berlin local time.
func localMinutes(t time.Time) int {
	lt := t.In(berlinLoc())
	return lt.Hour()*60 + lt.Minute()
}

// EffektiveFenster computes the disjoint availability windows of one referent on
// a given Berlin-local day (SPEC §3.1): merge of all 'verfuegbar' windows minus
// all 'gesperrt' windows.
func EffektiveFenster(app core.App, referentID string, datum time.Time) ([]Interval, error) {
	recs, err := app.FindRecordsByFilter(
		"verfuegbarkeiten",
		"referent = {:ref}",
		"", 0, 0,
		dbx.Params{"ref": referentID},
	)
	if err != nil {
		return nil, err
	}

	wt := wochentagCode(datum.In(berlinLoc()))

	var verfuegbar []Interval
	var gesperrt []Interval

	for _, r := range recs {
		art := r.GetString("art")
		wdh := r.GetString("wiederholung")

		if wdh == "woechentlich" {
			if r.GetString("wochentag") != wt {
				continue
			}
			gab := r.GetDateTime("gueltig_ab")
			gbis := r.GetDateTime("gueltig_bis")
			if !gab.IsZero() && datumVorTag(datum, gab.Time()) {
				continue
			}
			if !gbis.IsZero() && datumNachTag(datum, gbis.Time()) {
				continue
			}
			von, okv := parseHHMM(r.GetString("zeit_von"))
			bis, okb := parseHHMM(r.GetString("zeit_bis"))
			if art == "verfuegbar" {
				if okv && okb {
					verfuegbar = append(verfuegbar, Interval{Von: von, Bis: bis})
				}
			} else { // gesperrt
				if !okv {
					von = 0
				}
				if !okb {
					bis = 23*60 + 59
				}
				gesperrt = append(gesperrt, Interval{Von: von, Bis: bis})
			}
			continue
		}

		// einmalig
		start := r.GetDateTime("start")
		ende := r.GetDateTime("ende")
		if start.IsZero() || ende.IsZero() {
			continue
		}
		if datumVorTag(datum, start.Time()) || datumNachTag(datum, ende.Time()) {
			continue // this day is not covered
		}
		von := 0
		bis := 23*60 + 59
		if sameLocalDate(datum, start.Time()) {
			von = localMinutes(start.Time())
		}
		if sameLocalDate(datum, ende.Time()) {
			bis = localMinutes(ende.Time())
		}
		if art == "verfuegbar" {
			verfuegbar = append(verfuegbar, Interval{Von: von, Bis: bis})
		} else {
			gesperrt = append(gesperrt, Interval{Von: von, Bis: bis})
		}
	}

	fenster := mergeIntervals(verfuegbar)
	for _, g := range gesperrt {
		fenster = subtractInterval(fenster, g)
	}
	return fenster, nil
}

// datumVorTag reports whether `datum` (a day) lies strictly before the calendar
// day of `other` (Berlin-local). Used for gueltig_ab / start range checks.
func datumVorTag(datum, other time.Time) bool {
	loc := berlinLoc()
	dy, dm, dd := datum.In(loc).Date()
	oy, om, od := other.In(loc).Date()
	d := dy*10000 + int(dm)*100 + dd
	o := oy*10000 + int(om)*100 + od
	return d < o
}

// datumNachTag reports whether `datum` lies strictly after the calendar day of
// `other` (Berlin-local).
func datumNachTag(datum, other time.Time) bool {
	loc := berlinLoc()
	dy, dm, dd := datum.In(loc).Date()
	oy, om, od := other.In(loc).Date()
	d := dy*10000 + int(dm)*100 + dd
	o := oy*10000 + int(om)*100 + od
	return d > o
}

// IstVerfuegbar reports whether the referent has a single window covering
// [von,bis] on the given day.
func IstVerfuegbar(app core.App, referentID string, datum time.Time, von, bis int) (bool, error) {
	fenster, err := EffektiveFenster(app, referentID, datum)
	if err != nil {
		return false, err
	}
	for _, f := range fenster {
		if f.Von <= von && f.Bis >= bis {
			return true, nil
		}
	}
	return false, nil
}

// zeitRow is used to scan booking start/ende datetimes from raw SQL.
type zeitRow struct {
	Start string `db:"start"`
	Ende  string `db:"ende"`
}

// HatKollision reports whether the referent already has a planned (geplant=true)
// booking on `datum` whose time window (plus/minus puffer) overlaps [von,bis].
// Only 'angefragt'/'bestaetigt' bookings block (SPEC §3.2). ausgenommenBuchungID
// excludes the booking currently being (re)planned.
func HatKollision(app core.App, referentID string, datum time.Time, von, bis, puffer int, ausgenommenBuchungID string) (bool, error) {
	loc := berlinLoc()
	y, mo, d := datum.In(loc).Date()
	dayStart := time.Date(y, mo, d, 0, 0, 0, 0, loc)
	dayEnd := dayStart.AddDate(0, 0, 1)
	var rows []zeitRow
	err := app.DB().
		NewQuery(`
			SELECT b.start AS start, b.ende AS ende
			FROM buchung_referenten br
			JOIN buchungen b ON br.buchung = b.id
			WHERE br.referent = {:ref}
			  AND br.geplant = true
			  AND b.status IN ('angefragt','bestaetigt')
			  AND b.id != {:excl}
			  AND b.start >= {:from} AND b.start < {:to}
		`).
		Bind(dbx.Params{
			"ref":  referentID,
			"excl": ausgenommenBuchungID,
			"from": dayStart.UTC().Format("2006-01-02 15:04:05.000Z"),
			"to":   dayEnd.UTC().Format("2006-01-02 15:04:05.000Z"),
		}).
		All(&rows)
	if err != nil {
		return false, err
	}

	for _, row := range rows {
		st, e1 := types.ParseDateTime(row.Start)
		en, e2 := types.ParseDateTime(row.Ende)
		if e1 != nil || e2 != nil || st.IsZero() || en.IsZero() {
			continue
		}
		if !sameLocalDate(datum, st.Time()) {
			continue
		}
		bStart := localMinutes(st.Time())
		bEnde := localMinutes(en.Time())
		if overlaps(von-puffer, bis+puffer, bStart, bEnde) {
			return true, nil
		}
	}
	return false, nil
}

// FindFreienRaum returns the smallest active room with sufficient capacity that
// is free (no overlapping angefragt/bestaetigt booking incl. puffer) on the day.
// Returns nil if none is free (SPEC §3.2). ausgenommenBuchungID excludes the
// booking being (re)planned so a move re-check doesn't collide with itself.
func FindFreienRaum(app core.App, datum time.Time, von, bis, gruppengroesse, puffer int, ausgenommenBuchungID string) (*core.Record, error) {
	raeume, err := app.FindRecordsByFilter(
		"raeume",
		"aktiv = true && kapazitaet >= {:g}",
		"kapazitaet", 0, 0,
		dbx.Params{"g": gruppengroesse},
	)
	if err != nil {
		return nil, err
	}
	for _, raum := range raeume {
		belegt, err := raumBelegt(app, raum.Id, datum, von, bis, puffer, ausgenommenBuchungID)
		if err != nil {
			return nil, err
		}
		if !belegt {
			return raum, nil
		}
	}
	return nil, nil
}

// raumBelegt checks whether a room is occupied in the given window (incl. puffer).
func raumBelegt(app core.App, raumID string, datum time.Time, von, bis, puffer int, ausgenommenBuchungID string) (bool, error) {
	loc := berlinLoc()
	y, mo, d := datum.In(loc).Date()
	dayStart := time.Date(y, mo, d, 0, 0, 0, 0, loc)
	dayEnd := dayStart.AddDate(0, 0, 1)
	var rows []zeitRow
	err := app.DB().
		NewQuery(`
			SELECT start, ende FROM buchungen
			WHERE raum = {:raum}
			  AND status IN ('angefragt','bestaetigt')
			  AND id != {:excl}
			  AND start >= {:from} AND start < {:to}
		`).
		Bind(dbx.Params{
			"raum": raumID,
			"excl": ausgenommenBuchungID,
			"from": dayStart.UTC().Format("2006-01-02 15:04:05.000Z"),
			"to":   dayEnd.UTC().Format("2006-01-02 15:04:05.000Z"),
		}).
		All(&rows)
	if err != nil {
		return false, err
	}
	for _, row := range rows {
		st, e1 := types.ParseDateTime(row.Start)
		en, e2 := types.ParseDateTime(row.Ende)
		if e1 != nil || e2 != nil || st.IsZero() || en.IsZero() {
			continue
		}
		if !sameLocalDate(datum, st.Time()) {
			continue
		}
		if overlaps(von-puffer, bis+puffer, localMinutes(st.Time()), localMinutes(en.Time())) {
			return true, nil
		}
	}
	return false, nil
}

// einstellungenWerte is the parsed global config snapshot (read fresh per
// request, SPEC §8 — no caching).
type einstellungenWerte struct {
	PufferMinuten            int
	VorlaufTageMin           int
	VorlaufTageMax           int
	AnfrageVerfallStunden    int
	Oeffnungstage            []string
	BetriebsendeMin          int
	MaxGruppenParallelDefault int
	MaxGruppengroesseAbsolut int
	TeamEmail                string
}

// ladeEinstellungen reads the singleton einstellungen record fresh and parses it.
func ladeEinstellungen(app core.App) (*einstellungenWerte, *core.Record, error) {
	rec, err := app.FindFirstRecordByFilter("einstellungen", "1=1")
	if err != nil {
		return nil, nil, err
	}
	betriebsende, ok := parseHHMM(rec.GetString("betriebsende"))
	if !ok {
		betriebsende = 18 * 60
	}
	w := &einstellungenWerte{
		PufferMinuten:             rec.GetInt("puffer_minuten"),
		VorlaufTageMin:            rec.GetInt("vorlaufzeit_tage_min"),
		VorlaufTageMax:            rec.GetInt("vorlaufzeit_tage_max"),
		AnfrageVerfallStunden:     rec.GetInt("anfrage_verfall_stunden"),
		Oeffnungstage:             rec.GetStringSlice("oeffnungstage"),
		BetriebsendeMin:           betriebsende,
		MaxGruppenParallelDefault: rec.GetInt("max_gruppen_parallel_pro_tag_default"),
		MaxGruppengroesseAbsolut:  rec.GetInt("max_gruppengroesse_absolut"),
		TeamEmail:                 rec.GetString("team_benachrichtigung_email"),
	}
	return w, rec, nil
}

// aktiveThemenReferenten returns all active referenten competent for themaID.
func aktiveThemenReferenten(app core.App, themaID string) ([]*core.Record, error) {
	all, err := app.FindRecordsByFilter("referenten", "aktiv = true", "name", 0, 0)
	if err != nil {
		return nil, err
	}
	out := make([]*core.Record, 0, len(all))
	for _, r := range all {
		if enthaelt(r.GetStringSlice("themen"), themaID) {
			out = append(out, r)
		}
	}
	return out, nil
}

func enthaelt(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// BerechneSlots computes the public bookable slots for one day (SPEC §3.4).
// It returns ONLY {start, ende, buchbar} — never names, ids or counts.
func BerechneSlots(app core.App, angebotsartID, themaID string, datum time.Time, gruppengroesse int) ([]SlotResult, error) {
	a, err := app.FindRecordById("angebotsarten", angebotsartID)
	if err != nil || a == nil || !a.GetBool("aktiv") {
		return []SlotResult{}, nil
	}
	e, _, err := ladeEinstellungen(app)
	if err != nil {
		return nil, err
	}

	minTn := a.GetInt("min_teilnehmer")
	if minTn < 1 {
		minTn = 1
	}
	maxTn := a.GetInt("max_teilnehmer")
	if gruppengroesse < minTn || (maxTn > 0 && gruppengroesse > maxTn) {
		return []SlotResult{}, nil
	}

	// Öffnungstag?
	if !enthaelt(e.Oeffnungstage, wochentagCode(datum.In(berlinLoc()))) {
		return []SlotResult{}, nil
	}
	// Schließtag?
	geschlossen, err := istSchliesstag(app, datum)
	if err != nil {
		return nil, err
	}
	if geschlossen {
		return []SlotResult{}, nil
	}
	// Vorlauffenster
	if !imVorlauffenster(datum, e.VorlaufTageMin, e.VorlaufTageMax) {
		return []SlotResult{}, nil
	}

	// Parallel-Limit pro Tag
	limit := a.GetInt("max_gruppen_parallel_pro_tag")
	if limit <= 0 {
		limit = e.MaxGruppenParallelDefault
	}
	if limit <= 0 {
		limit = 3
	}
	belegung, err := zaehleTagesBuchungen(app, datum)
	if err != nil {
		return nil, err
	}
	if belegung >= limit {
		return []SlotResult{}, nil
	}

	benoetigt := BenoetigteReferenten(a.GetInt("min_referenten"), a.GetInt("betreuungsschluessel"), gruppengroesse)
	dauer := a.GetInt("dauer_minuten")
	benoetigtRaum := a.GetBool("benoetigt_raum")
	kandidaten, err := aktiveThemenReferenten(app, themaID)
	if err != nil {
		return nil, err
	}

	zeitslots := a.GetStringSlice("zeitslots")
	ergebnis := make([]SlotResult, 0, len(zeitslots))
	for _, slotStr := range zeitslots {
		von, ok := parseHHMM(slotStr)
		if !ok {
			continue
		}
		bis := von + dauer
		if bis > e.BetriebsendeMin {
			continue
		}
		freie := 0
		for _, r := range kandidaten {
			verf, err := IstVerfuegbar(app, r.Id, datum, von, bis)
			if err != nil {
				return nil, err
			}
			if !verf {
				continue
			}
			koll, err := HatKollision(app, r.Id, datum, von, bis, e.PufferMinuten, "")
			if err != nil {
				return nil, err
			}
			if !koll {
				freie++
			}
		}
		buchbar := freie >= benoetigt
		if buchbar && benoetigtRaum {
			raum, err := FindFreienRaum(app, datum, von, bis, gruppengroesse, e.PufferMinuten, "")
			if err != nil {
				return nil, err
			}
			buchbar = raum != nil
		}
		ergebnis = append(ergebnis, SlotResult{Start: slotStr, Ende: minutesToHHMM(bis), Buchbar: buchbar})
	}
	return ergebnis, nil
}

// TagesStatus reduces the per-day slots to "frei|knapp|ausgebucht" (SPEC §3.4).
func TagesStatus(app core.App, angebotsartID, themaID string, datum time.Time, gruppengroesse int) (string, error) {
	slots, err := BerechneSlots(app, angebotsartID, themaID, datum, gruppengroesse)
	if err != nil {
		return "", err
	}
	if len(slots) == 0 {
		return "ausgebucht", nil
	}
	frei := 0
	for _, s := range slots {
		if s.Buchbar {
			frei++
		}
	}
	if frei == 0 {
		return "ausgebucht", nil
	}
	haelfte := int(math.Ceil(float64(len(slots)) / 2.0))
	if frei >= haelfte {
		return "frei", nil
	}
	return "knapp", nil
}

// istSchliesstag reports whether the Berlin-local day is a configured Schließtag.
func istSchliesstag(app core.App, datum time.Time) (bool, error) {
	loc := berlinLoc()
	y, mo, d := datum.In(loc).Date()
	// Nächste lokale Mitternacht (AddDate statt +24h — korrekt an 23h/25h-DST-Tagen).
	dayStart := time.Date(y, mo, d, 0, 0, 0, 0, loc)
	dayEnd := dayStart.AddDate(0, 0, 1)
	var n int
	err := app.DB().
		NewQuery(`SELECT COUNT(*) FROM schliesstage WHERE datum >= {:from} AND datum < {:to}`).
		Bind(dbx.Params{
			"from": dayStart.UTC().Format("2006-01-02 15:04:05.000Z"),
			"to":   dayEnd.UTC().Format("2006-01-02 15:04:05.000Z"),
		}).
		Row(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// zaehleTagesBuchungen counts capacity-blocking bookings on the Berlin-local day.
func zaehleTagesBuchungen(app core.App, datum time.Time) (int, error) {
	loc := berlinLoc()
	y, mo, d := datum.In(loc).Date()
	// Nächste lokale Mitternacht (AddDate statt +24h — korrekt an 23h/25h-DST-Tagen).
	dayStart := time.Date(y, mo, d, 0, 0, 0, 0, loc)
	dayEnd := dayStart.AddDate(0, 0, 1)
	var n int
	err := app.DB().
		NewQuery(`
			SELECT COUNT(*) FROM buchungen
			WHERE status IN ('angefragt','bestaetigt')
			  AND start >= {:from} AND start < {:to}
		`).
		Bind(dbx.Params{
			"from": dayStart.UTC().Format("2006-01-02 15:04:05.000Z"),
			"to":   dayEnd.UTC().Format("2006-01-02 15:04:05.000Z"),
		}).
		Row(&n)
	if err != nil {
		return 0, err
	}
	return n, nil
}

// imVorlauffenster checks datum against [heute+min, heute+max] (Berlin-local days).
func imVorlauffenster(datum time.Time, minTage, maxTage int) bool {
	loc := berlinLoc()
	now := jetzt().In(loc)
	y, mo, d := now.Date()
	heute := time.Date(y, mo, d, 0, 0, 0, 0, loc)
	dy, dmo, dd := datum.In(loc).Date()
	tag := time.Date(dy, dmo, dd, 0, 0, 0, 0, loc)

	frueheste := heute.AddDate(0, 0, minTage)
	spaeteste := heute.AddDate(0, 0, maxTage)
	if tag.Before(frueheste) {
		return false
	}
	if tag.After(spaeteste) {
		return false
	}
	return true
}
