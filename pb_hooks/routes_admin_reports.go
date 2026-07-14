// Package main — routes_admin_reports.go
//
// Authenticated aggregation reports (SPEC §4.1), behind
// apis.RequireAuth("mitarbeiter"). These use app.DB().NewQuery(...) because the
// PB standard list API cannot GROUP BY over relations (SPEC §4.1 note).
package main

import (
	"net/http"
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

func registerAdminReportRoutes(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		auth := apis.RequireAuth("mitarbeiter")

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

			statusFilter := ""
			if s := q.Get("status"); s != "" {
				statusFilter = " AND b.status = {:status}"
				params["status"] = s
			}

			sql := "SELECT " + selectExpr + ", COUNT(*) AS anzahl, " +
				"COALESCE(SUM(b.teilnehmer_geplant),0) AS teilnehmer " +
				"FROM buchungen b " + joinExpr +
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
		}).Bind(auth)

		// ---- Soll/Ist --------------------------------------------------
		se.Router.GET("/api/admin/reports/soll-ist", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query()
			von, bis, ok := zeitbereichUTC(q.Get("von"), q.Get("bis"))
			if !ok {
				return apis.NewBadRequestError("Ungültiger Zeitraum (von/bis als YYYY-MM-DD).", nil)
			}
			params := dbx.Params{"von": von, "bis": bis}

			var teilnehmer []struct {
				Monat    string `db:"monat" json:"monat"`
				Geplant  int    `db:"geplant" json:"teilnehmer_geplant"`
				Ist      int    `db:"ist" json:"teilnehmer_ist"`
				Buchungen int   `db:"buchungen" json:"buchungen"`
			}
			tnSQL := `
				SELECT strftime('%Y-%m', b.start) AS monat,
				       COALESCE(SUM(b.teilnehmer_geplant),0) AS geplant,
				       COALESCE(SUM(b.teilnehmer_ist),0) AS ist,
				       COUNT(*) AS buchungen
				FROM buchungen b
				WHERE b.start >= {:von} AND b.start < {:bis}
				  AND b.status IN ('bestaetigt','durchgefuehrt')
				GROUP BY monat ORDER BY monat`
			if err := app.DB().NewQuery(tnSQL).Bind(params).All(&teilnehmer); err != nil {
				return apis.NewApiError(http.StatusInternalServerError, "Auswertung fehlgeschlagen.", nil)
			}

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
		}).Bind(auth)

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
		}).Bind(auth)

		return se.Next()
	})
}
