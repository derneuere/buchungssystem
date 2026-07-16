// Package main — routes_admin_reports.go
//
// Authenticated aggregation reports (SPEC §4.1), behind
// apis.RequireAuth("mitarbeiter"). These use app.DB().NewQuery(...) because the
// PB standard list API cannot GROUP BY over relations (SPEC §4.1 note).
package main

import (
	"net/http"
	"sort"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

const pbTimeLayout = "2006-01-02 15:04:05.000Z"

// zeitbereichUTC converts von/bis (YYYY-MM-DD, Berlin-local, inclusive) into UTC
// datetime bounds where the end is exclusive (bis + 1 day).
func zeitbereichUTC(vonStr, bisStr string) (string, string, bool) {
	loc := berlinLoc()
	von, err1 := time.ParseInLocation("2006-01-02", vonStr, loc)
	bis, err2 := time.ParseInLocation("2006-01-02", bisStr, loc)
	if err1 != nil || err2 != nil {
		return "", "", false
	}
	return von.UTC().Format(pbTimeLayout), bis.AddDate(0, 0, 1).UTC().Format(pbTimeLayout), true
}

// monatBerlin buckets a UTC datetime string (as stored/scanned from PB) into a
// "YYYY-MM" key in Berlin-local time. SQLite has no timezone DB, so month
// bucketing on the raw UTC start would misplace bookings around midnight at the
// month boundary (and shift by the Berlin offset); we therefore fetch the raw
// per-row starts and bucket them here (DST-safe via berlinLoc()).
func monatBerlin(startRaw string) string {
	for _, layout := range []string{pbTimeLayout, "2006-01-02 15:04:05Z", "2006-01-02 15:04:05.000", "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, startRaw); err == nil {
			return t.In(berlinLoc()).Format("2006-01")
		}
	}
	if len(startRaw) >= 7 {
		return startRaw[:7]
	}
	return startRaw
}

func registerAdminReportRoutes(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		auth := apis.RequireAuth("mitarbeiter")
		personal := requireRolle("mitarbeiter", "leitung")

		// ---- Herkunft --------------------------------------------------
		se.Router.GET("/api/admin/reports/herkunft", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query()
			von, bis, ok := zeitbereichUTC(q.Get("von"), q.Get("bis"))
			if !ok {
				return apis.NewBadRequestError("Ungültiger Zeitraum (von/bis als YYYY-MM-DD).", nil)
			}
			params := dbx.Params{"von": von, "bis": bis}

			var groupExpr, selectExpr, joinExpr string
			switch q.Get("gruppieren_nach") {
			case "land":
				groupExpr = "b.herkunft_land"
				selectExpr = "b.herkunft_land AS gruppe"
			case "einrichtungstyp":
				groupExpr = "et.name"
				selectExpr = "COALESCE(et.name, '(ohne Angabe)') AS gruppe"
				joinExpr = "LEFT JOIN einrichtungstypen et ON b.herkunft_einrichtungstyp = et.id"
			default: // bundesland
				groupExpr = "b.herkunft_bundesland"
				selectExpr = "COALESCE(NULLIF(b.herkunft_bundesland,''), '(ohne Angabe)') AS gruppe"
			}

			// Default: nur reale Besuche (bestätigt + durchgeführt), damit
			// angefragte/abgelehnte/stornierte/verfallene Anfragen die
			// Herkunftsstatistik nicht aufblähen. Ein expliziter status-Param
			// überschreibt das (z.B. zur Analyse einzelner Status).
			statusFilter := " AND b.status IN ('bestaetigt','durchgefuehrt')"
			if s := q.Get("status"); s != "" {
				statusFilter = " AND b.status = {:status}"
				params["status"] = s
			}

			// Für durchgeführte Buchungen zählt die tatsächliche Teilnehmerzahl
			// (teilnehmer_ist, Fallback teilnehmer_geplant), sonst die Planung.
			teilnehmerExpr := "COALESCE(SUM(CASE WHEN b.status='durchgefuehrt' " +
				"THEN COALESCE(b.teilnehmer_ist, b.teilnehmer_geplant) " +
				"ELSE b.teilnehmer_geplant END),0) AS teilnehmer"

			sql := "SELECT " + selectExpr + ", COUNT(*) AS anzahl, " + teilnehmerExpr +
				" FROM buchungen b " + joinExpr +
				" WHERE b.start >= {:von} AND b.start < {:bis}" + statusFilter +
				" GROUP BY " + groupExpr + " ORDER BY anzahl DESC"

			var rows []struct {
				Gruppe     string `db:"gruppe" json:"gruppe"`
				Anzahl     int    `db:"anzahl" json:"anzahl"`
				Teilnehmer int    `db:"teilnehmer" json:"teilnehmer"`
			}
			if err := app.DB().NewQuery(sql).Bind(params).All(&rows); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Auswertung fehlgeschlagen.", nil)
			}
			return e.JSON(http.StatusOK, map[string]any{"gruppen": rows})
		}).Bind(auth).BindFunc(personal)

		// ---- Soll/Ist --------------------------------------------------
		se.Router.GET("/api/admin/reports/soll-ist", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query()
			von, bis, ok := zeitbereichUTC(q.Get("von"), q.Get("bis"))
			if !ok {
				return apis.NewBadRequestError("Ungültiger Zeitraum (von/bis als YYYY-MM-DD).", nil)
			}
			params := dbx.Params{"von": von, "bis": bis}

			// Rohzeilen holen und in Go nach Berliner Lokalmonat bucketen
			// (strftime über die UTC-Startzeit würde am Monatsrand danebenliegen).
			var rohzeilen []struct {
				Start   string `db:"start"`
				Geplant int    `db:"geplant"`
				Ist     int    `db:"ist"`
			}
			tnSQL := `
				SELECT b.start AS start,
				       COALESCE(b.teilnehmer_geplant,0) AS geplant,
				       COALESCE(b.teilnehmer_ist,0) AS ist
				FROM buchungen b
				WHERE b.start >= {:von} AND b.start < {:bis}
				  AND b.status IN ('bestaetigt','durchgefuehrt')`
			if err := app.DB().NewQuery(tnSQL).Bind(params).All(&rohzeilen); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Auswertung fehlgeschlagen.", nil)
			}

			type sollIstMonat struct {
				Monat     string `json:"monat"`
				Geplant   int    `json:"teilnehmer_geplant"`
				Ist       int    `json:"teilnehmer_ist"`
				Buchungen int    `json:"buchungen"`
			}
			idx := map[string]int{}
			teilnehmer := make([]sollIstMonat, 0)
			for _, r := range rohzeilen {
				m := monatBerlin(r.Start)
				i, ok := idx[m]
				if !ok {
					i = len(teilnehmer)
					idx[m] = i
					teilnehmer = append(teilnehmer, sollIstMonat{Monat: m})
				}
				teilnehmer[i].Geplant += r.Geplant
				teilnehmer[i].Ist += r.Ist
				teilnehmer[i].Buchungen++
			}
			sort.Slice(teilnehmer, func(a, b int) bool { return teilnehmer[a].Monat < teilnehmer[b].Monat })

			var referenten struct {
				Geplant    int `db:"geplant" json:"referenten_geplant"`
				Eingesetzt int `db:"eingesetzt" json:"referenten_eingesetzt"`
			}
			refSQL := `
				SELECT COALESCE(SUM(CASE WHEN br.geplant THEN 1 ELSE 0 END),0) AS geplant,
				       COALESCE(SUM(CASE WHEN br.eingesetzt THEN 1 ELSE 0 END),0) AS eingesetzt
				FROM buchung_referenten br
				JOIN buchungen b ON br.buchung = b.id
				WHERE b.start >= {:von} AND b.start < {:bis}
				  AND b.status IN ('bestaetigt','durchgefuehrt')`
			if err := app.DB().NewQuery(refSQL).Bind(params).One(&referenten); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Auswertung fehlgeschlagen.", nil)
			}

			return e.JSON(http.StatusOK, map[string]any{
				"teilnehmer_pro_monat": teilnehmer,
				"referenten":           referenten,
			})
		}).Bind(auth).BindFunc(personal)

		// ---- Buchungen je Monat (Zeitreihe) ----------------------------
		// SPEC §5.4: „Zeitreihe Buchungen/Monat (Line, Filter Status/Angebotsart)".
		// Zählt Buchungen pro Berliner Lokalmonat; ohne status/angebotsart-Param
		// über ALLE Status (im Gegensatz zur soll-ist-Reihe, die nur
		// bestätigt/durchgeführt zeigt).
		se.Router.GET("/api/admin/reports/buchungen-zeitreihe", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query()
			von, bis, ok := zeitbereichUTC(q.Get("von"), q.Get("bis"))
			if !ok {
				return apis.NewBadRequestError("Ungültiger Zeitraum (von/bis als YYYY-MM-DD).", nil)
			}
			params := dbx.Params{"von": von, "bis": bis}
			filter := ""
			if s := q.Get("status"); s != "" {
				filter += " AND b.status = {:status}"
				params["status"] = s
			}
			if a := q.Get("angebotsart"); a != "" {
				filter += " AND b.angebotsart = {:angebotsart}"
				params["angebotsart"] = a
			}

			var rohzeilen []struct {
				Start string `db:"start"`
			}
			sql := "SELECT b.start AS start FROM buchungen b" +
				" WHERE b.start >= {:von} AND b.start < {:bis}" + filter
			if err := app.DB().NewQuery(sql).Bind(params).All(&rohzeilen); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Auswertung fehlgeschlagen.", nil)
			}

			type monatZeile struct {
				Monat     string `json:"monat"`
				Buchungen int    `json:"buchungen"`
			}
			idx := map[string]int{}
			monate := make([]monatZeile, 0)
			for _, r := range rohzeilen {
				m := monatBerlin(r.Start)
				i, ok := idx[m]
				if !ok {
					i = len(monate)
					idx[m] = i
					monate = append(monate, monatZeile{Monat: m})
				}
				monate[i].Buchungen++
			}
			sort.Slice(monate, func(a, b int) bool { return monate[a].Monat < monate[b].Monat })

			return e.JSON(http.StatusOK, map[string]any{"monate": monate})
		}).Bind(auth).BindFunc(personal)

		// ---- Referenten-Auslastung -------------------------------------
		se.Router.GET("/api/admin/reports/referenten-auslastung", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query()
			von, bis, ok := zeitbereichUTC(q.Get("von"), q.Get("bis"))
			if !ok {
				return apis.NewBadRequestError("Ungültiger Zeitraum (von/bis als YYYY-MM-DD).", nil)
			}
			params := dbx.Params{"von": von, "bis": bis}
			refFilter := ""
			if r := q.Get("referent_id"); r != "" {
				refFilter = " AND r.id = {:ref}"
				params["ref"] = r
			}

			sql := `
				SELECT r.id AS referent_id, r.name AS name,
				       COALESCE(SUM(CASE WHEN br.eingesetzt THEN 1 ELSE 0 END),0) AS einsaetze,
				       COALESCE(SUM(CASE WHEN br.eingesetzt THEN a.dauer_minuten ELSE 0 END),0) AS minuten
				FROM buchung_referenten br
				JOIN buchungen b ON br.buchung = b.id
				JOIN referenten r ON br.referent = r.id
				JOIN angebotsarten a ON b.angebotsart = a.id
				WHERE b.start >= {:von} AND b.start < {:bis}
				  AND b.status IN ('bestaetigt','durchgefuehrt')` + refFilter + `
				GROUP BY r.id, r.name ORDER BY einsaetze DESC`

			var rows []struct {
				ReferentID string  `db:"referent_id" json:"referent_id"`
				Name       string  `db:"name" json:"name"`
				Einsaetze  int     `db:"einsaetze" json:"einsaetze"`
				Minuten    int     `db:"minuten" json:"minuten"`
			}
			if err := app.DB().NewQuery(sql).Bind(params).All(&rows); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Auswertung fehlgeschlagen.", nil)
			}

			type out struct {
				ReferentID string  `json:"referent_id"`
				Name       string  `json:"name"`
				Einsaetze  int     `json:"einsaetze"`
				Stunden    float64 `json:"stunden"`
			}
			result := make([]out, 0, len(rows))
			for _, r := range rows {
				result = append(result, out{
					ReferentID: r.ReferentID, Name: r.Name, Einsaetze: r.Einsaetze,
					Stunden: float64(r.Minuten) / 60.0,
				})
			}
			return e.JSON(http.StatusOK, map[string]any{"referenten": result})
		}).Bind(auth).BindFunc(personal)

		return se.Next()
	})
}
