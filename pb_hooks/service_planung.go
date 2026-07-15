// Package main — service_planung.go
//
// Referenten planning heuristic (SPEC §3.3 + §3.5). BenoetigteReferenten is a
// pure, unit-tested function; SchlageReferentenVor combines availability,
// collision, fairness-by-load and room suggestion into an admin proposal.
package main

import (
	"math"
	"sort"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// BenoetigteReferenten implements SPEC §3.3 / E5:
//
//	benoetigt = max(min_referenten, ceil(gruppengroesse / betreuungsschluessel))
//
// betreuungsschluessel <= 0 means "leer" -> only min_referenten applies.
func BenoetigteReferenten(minReferenten, betreuungsschluessel, gruppengroesse int) int {
	basis := minReferenten
	if basis < 1 {
		basis = 1
	}
	if betreuungsschluessel <= 0 {
		return basis
	}
	nachSchluessel := int(math.Ceil(float64(gruppengroesse) / float64(betreuungsschluessel)))
	if nachSchluessel > basis {
		return nachSchluessel
	}
	return basis
}

// ReferentVorschlag is a single suggested/alternative referent (admin-facing,
// so names ARE included — this endpoint is behind RequireAuth).
type ReferentVorschlag struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Auslastung int    `json:"auslastung"`
}

// VorschlagErgebnis is the result of SchlageReferentenVor (SPEC §3.5).
type VorschlagErgebnis struct {
	Benoetigt    int                 `json:"benoetigt"`
	Vorschlag    []ReferentVorschlag `json:"vorschlag"`
	Alternativen []ReferentVorschlag `json:"alternativen"`
	RaumVorschlag *raumInfo          `json:"raumVorschlag"`
	Warnungen    []string            `json:"warnungen"`
}

type raumInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Kapazitaet int    `json:"kapazitaet"`
}

// SchlageReferentenVor computes a referent proposal for a booking (SPEC §3.5).
// It does NOT persist assignments; the caller may store planung_snapshot.
// ausschluss holds referent ids to skip (e.g. already assigned when filling a
// gap); zusaetzlicheAusnahmeBuchung excludes bookings from collision checks.
func SchlageReferentenVor(app core.App, buchung *core.Record, ausschluss map[string]bool) (*VorschlagErgebnis, error) {
	a, err := app.FindRecordById("angebotsarten", buchung.GetString("angebotsart"))
	if err != nil {
		return nil, err
	}
	e, _, err := ladeEinstellungen(app)
	if err != nil {
		return nil, err
	}

	gruppe := buchung.GetInt("teilnehmer_geplant")
	benoetigt := BenoetigteReferenten(a.GetInt("min_referenten"), a.GetInt("betreuungsschluessel"), gruppe)

	start := buchung.GetDateTime("start").Time()
	ende := buchung.GetDateTime("ende").Time()
	von := localMinutes(start)
	bis := localMinutes(ende)

	kandidatenRecs, err := aktiveThemenReferenten(app, buchung.GetString("thema"))
	if err != nil {
		return nil, err
	}

	type kandidat struct {
		rec        *core.Record
		auslastung int
	}
	var passend []kandidat
	for _, r := range kandidatenRecs {
		if ausschluss[r.Id] {
			continue
		}
		verf, err := IstVerfuegbar(app, r.Id, start, von, bis)
		if err != nil {
			return nil, err
		}
		if !verf {
			continue
		}
		koll, err := HatKollision(app, r.Id, start, von, bis, e.PufferMinuten, buchung.Id)
		if err != nil {
			return nil, err
		}
		if koll {
			continue
		}
		last, err := referentAuslastung(app, r.Id)
		if err != nil {
			return nil, err
		}
		passend = append(passend, kandidat{rec: r, auslastung: last})
	}

	// Fairness: geringste Auslastung zuerst; Tie-Break Name, dann ID.
	sort.Slice(passend, func(i, j int) bool {
		if passend[i].auslastung != passend[j].auslastung {
			return passend[i].auslastung < passend[j].auslastung
		}
		ni, nj := passend[i].rec.GetString("name"), passend[j].rec.GetString("name")
		if ni != nj {
			return ni < nj
		}
		return passend[i].rec.Id < passend[j].rec.Id
	})

	toVorschlag := func(k kandidat) ReferentVorschlag {
		return ReferentVorschlag{ID: k.rec.Id, Name: k.rec.GetString("name"), Auslastung: k.auslastung}
	}

	res := &VorschlagErgebnis{Benoetigt: benoetigt, Warnungen: []string{}}
	for i, k := range passend {
		if i < benoetigt {
			res.Vorschlag = append(res.Vorschlag, toVorschlag(k))
		} else if i < benoetigt+3 {
			res.Alternativen = append(res.Alternativen, toVorschlag(k))
		}
	}
	if res.Vorschlag == nil {
		res.Vorschlag = []ReferentVorschlag{}
	}
	if res.Alternativen == nil {
		res.Alternativen = []ReferentVorschlag{}
	}

	if len(res.Vorschlag) < benoetigt {
		res.Warnungen = append(res.Warnungen,
			germanWarnVerfuegbar(len(res.Vorschlag), benoetigt))
	}

	if a.GetBool("benoetigt_raum") {
		raum, err := FindFreienRaum(app, start, von, bis, gruppe, e.PufferMinuten, buchung.Id)
		if err != nil {
			return nil, err
		}
		if raum == nil {
			res.Warnungen = append(res.Warnungen, "Kein passender Raum verfügbar.")
		} else {
			res.RaumVorschlag = &raumInfo{ID: raum.Id, Name: raum.GetString("name"), Kapazitaet: raum.GetInt("kapazitaet")}
		}
	}

	return res, nil
}

// referentAuslastung counts geplant assignments in confirmed/executed bookings
// within +/-30 days of today (SPEC §3.5 fairness metric).
func referentAuslastung(app core.App, referentID string) (int, error) {
	loc := berlinLoc()
	now := jetzt().In(loc)
	von := now.AddDate(0, 0, -30).UTC().Format("2006-01-02 15:04:05.000Z")
	bis := now.AddDate(0, 0, 30).UTC().Format("2006-01-02 15:04:05.000Z")
	var n int
	err := app.DB().
		NewQuery(`
			SELECT COUNT(*)
			FROM buchung_referenten br
			JOIN buchungen b ON br.buchung = b.id
			WHERE br.referent = {:ref}
			  AND br.geplant = true
			  AND b.status IN ('bestaetigt','durchgefuehrt')
			  AND b.start >= {:von} AND b.start <= {:bis}
		`).
		Bind(dbx.Params{"ref": referentID, "von": von, "bis": bis}).
		Row(&n)
	if err != nil {
		return 0, err
	}
	return n, nil
}

func germanWarnVerfuegbar(have, need int) string {
	return "Nur " + itoa(have) + " von " + itoa(need) + " Referenten verfügbar."
}

// itoa is a tiny local int->string to avoid importing strconv in this file.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
