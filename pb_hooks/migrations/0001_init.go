package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 0001_init creates all 11 collections of the Buchungssystem exactly per
// SPEC §2.3 (deutsche Bezeichner, Access-Rules, Feld-Typen, Indizes).
//
// IMPORTANT PocketBase semantics note: a BoolField with Required=true forces
// the value to be *true* (not merely "present"). The SPEC marks fields like
// `aktiv`, `spam_verdacht`, `geplant`, `eingesetzt`, `benoetigt_raum` as
// "Req: ja" meaning "always has a boolean value / a default", NOT "must be
// true". Forcing true would make "aktiv=false statt Löschen" impossible.
// Therefore all BoolFields are created with Required=false; the application
// layer supplies the documented defaults.
func init() {
	m.Register(func(app core.App) error {
		// ---- 1. mitarbeiter (Auth) --------------------------------------
		mitarbeiter := core.NewAuthCollection("mitarbeiter", "pbc_mitarbeiter")
		mitarbeiter.ListRule = ptr(staffRule)
		mitarbeiter.ViewRule = ptr(staffRule)
		mitarbeiter.UpdateRule = ptr(staffRule)
		mitarbeiter.CreateRule = nil // only Superuser/Seed — keine Selbstregistrierung
		mitarbeiter.DeleteRule = ptr(`@request.auth.id != "" && @request.auth.id != id`)
		mitarbeiter.Fields.Add(
			&core.TextField{Name: "name", Required: true, Max: 255},
			&core.SelectField{Name: "rolle", Required: true, MaxSelect: 1, Values: []string{"mitarbeiter", "leitung"}},
			&core.BoolField{Name: "aktiv"},
		)
		addTimestamps(mitarbeiter)
		// passwordAuth identityFields=[email] requires a unique email index.
		mitarbeiter.AddIndex("idx_mitarbeiter_email", true, "email", "email != ''")
		if err := app.Save(mitarbeiter); err != nil {
			return err
		}

		// ---- 2. themen ---------------------------------------------------
		themen := core.NewBaseCollection("themen", "pbc_themen")
		themen.ListRule = ptr(publicActiveRule)
		themen.ViewRule = ptr(publicActiveRule)
		themen.CreateRule = ptr(staffRule)
		themen.UpdateRule = ptr(staffRule)
		themen.DeleteRule = ptr(staffRule)
		themen.Fields.Add(
			&core.TextField{Name: "name", Required: true, Max: 255},
			&core.TextField{Name: "beschreibung", Max: 2000},
			&core.NumberField{Name: "sort_order"},
			&core.BoolField{Name: "aktiv"},
		)
		addTimestamps(themen)
		themen.AddIndex("idx_themen_name", true, "name", "")
		if err := app.Save(themen); err != nil {
			return err
		}

		// ---- 3. einrichtungstypen ---------------------------------------
		einrichtungstypen := core.NewBaseCollection("einrichtungstypen", "pbc_einrichtungstypen")
		einrichtungstypen.ListRule = ptr(publicActiveRule)
		einrichtungstypen.ViewRule = ptr(publicActiveRule)
		einrichtungstypen.CreateRule = ptr(staffRule)
		einrichtungstypen.UpdateRule = ptr(staffRule)
		einrichtungstypen.DeleteRule = ptr(staffRule)
		einrichtungstypen.Fields.Add(
			&core.TextField{Name: "name", Required: true, Max: 255},
			&core.NumberField{Name: "sort_order"},
			&core.BoolField{Name: "aktiv"},
		)
		addTimestamps(einrichtungstypen)
		einrichtungstypen.AddIndex("idx_einrichtungstypen_name", true, "name", "")
		if err := app.Save(einrichtungstypen); err != nil {
			return err
		}

		// ---- 4. raeume ---------------------------------------------------
		raeume := core.NewBaseCollection("raeume", "pbc_raeume")
		raeume.ListRule = ptr(staffRule)
		raeume.ViewRule = ptr(staffRule)
		raeume.CreateRule = ptr(staffRule)
		raeume.UpdateRule = ptr(staffRule)
		raeume.DeleteRule = ptr(staffRule)
		raeume.Fields.Add(
			&core.TextField{Name: "name", Required: true, Max: 255},
			&core.NumberField{Name: "kapazitaet", Required: true, OnlyInt: true, Min: ptr(1.0)},
			&core.BoolField{Name: "aktiv"},
			&core.TextField{Name: "notizen", Max: 2000},
		)
		addTimestamps(raeume)
		raeume.AddIndex("idx_raeume_name", true, "name", "")
		if err := app.Save(raeume); err != nil {
			return err
		}

		// ---- 5. angebotsarten -------------------------------------------
		angebotsarten := core.NewBaseCollection("angebotsarten", "pbc_angebotsarten")
		angebotsarten.ListRule = ptr(publicActiveRule)
		angebotsarten.ViewRule = ptr(publicActiveRule)
		angebotsarten.CreateRule = ptr(staffRule)
		angebotsarten.UpdateRule = ptr(staffRule)
		angebotsarten.DeleteRule = ptr(staffRule)
		angebotsarten.Fields.Add(
			&core.TextField{Name: "name", Required: true, Max: 255},
			&core.TextField{Name: "slug", Required: true, Max: 100},
			&core.TextField{Name: "beschreibung", Max: 2000},
			&core.NumberField{Name: "dauer_minuten", Required: true, OnlyInt: true, Min: ptr(15.0)},
			&core.BoolField{Name: "benoetigt_raum"},
			&core.NumberField{Name: "min_teilnehmer", OnlyInt: true, Min: ptr(1.0)},
			&core.NumberField{Name: "max_teilnehmer", Required: true, OnlyInt: true, Min: ptr(1.0)},
			&core.NumberField{Name: "min_referenten", Required: true, OnlyInt: true, Min: ptr(1.0)},
			&core.NumberField{Name: "betreuungsschluessel", OnlyInt: true, Min: ptr(1.0)},
			&core.JSONField{Name: "zeitslots", Required: true, MaxSize: 4000},
			&core.NumberField{Name: "max_gruppen_parallel_pro_tag", OnlyInt: true, Min: ptr(1.0)},
			&core.NumberField{Name: "sort_order"},
			&core.BoolField{Name: "aktiv"},
		)
		addTimestamps(angebotsarten)
		angebotsarten.AddIndex("idx_angebotsarten_slug", true, "slug", "")
		angebotsarten.AddIndex("idx_angebotsarten_name", true, "name", "")
		if err := app.Save(angebotsarten); err != nil {
			return err
		}

		// ---- 6. referenten ----------------------------------------------
		referenten := core.NewBaseCollection("referenten", "pbc_referenten")
		referenten.ListRule = ptr(staffRule)
		referenten.ViewRule = ptr(staffRule)
		referenten.CreateRule = ptr(staffRule)
		referenten.UpdateRule = ptr(staffRule)
		referenten.DeleteRule = ptr(staffRule)
		referenten.Fields.Add(
			&core.TextField{Name: "name", Required: true, Max: 255},
			&core.EmailField{Name: "email"},
			&core.TextField{Name: "telefon", Max: 100},
			&core.RelationField{Name: "themen", CollectionId: "pbc_themen", MaxSelect: 50, CascadeDelete: false},
			&core.BoolField{Name: "aktiv"},
			&core.TextField{Name: "notizen", Max: 5000},
		)
		addTimestamps(referenten)
		referenten.AddIndex("idx_referenten_aktiv", false, "aktiv", "")
		if err := app.Save(referenten); err != nil {
			return err
		}

		// ---- 7. verfuegbarkeiten ----------------------------------------
		verfuegbarkeiten := core.NewBaseCollection("verfuegbarkeiten", "pbc_verfuegbarkeiten")
		verfuegbarkeiten.ListRule = ptr(staffRule)
		verfuegbarkeiten.ViewRule = ptr(staffRule)
		verfuegbarkeiten.CreateRule = ptr(staffRule)
		verfuegbarkeiten.UpdateRule = ptr(staffRule)
		verfuegbarkeiten.DeleteRule = ptr(staffRule)
		verfuegbarkeiten.Fields.Add(
			&core.RelationField{Name: "referent", Required: true, CollectionId: "pbc_referenten", MaxSelect: 1, CascadeDelete: true},
			&core.SelectField{Name: "art", Required: true, MaxSelect: 1, Values: []string{"verfuegbar", "gesperrt"}},
			&core.SelectField{Name: "wiederholung", Required: true, MaxSelect: 1, Values: []string{"einmalig", "woechentlich"}},
			&core.DateField{Name: "start"},
			&core.DateField{Name: "ende"},
			&core.SelectField{Name: "wochentag", MaxSelect: 1, Values: []string{"mo", "di", "mi", "do", "fr", "sa", "so"}},
			&core.TextField{Name: "zeit_von", Max: 5, Pattern: `^([01]\d|2[0-3]):[0-5]\d$`},
			&core.TextField{Name: "zeit_bis", Max: 5, Pattern: `^([01]\d|2[0-3]):[0-5]\d$`},
			&core.DateField{Name: "gueltig_ab"},
			&core.DateField{Name: "gueltig_bis"},
			&core.TextField{Name: "notiz", Max: 500},
		)
		addTimestamps(verfuegbarkeiten)
		verfuegbarkeiten.AddIndex("idx_verfuegbarkeiten_ref_wdh", false, "referent, wiederholung", "")
		verfuegbarkeiten.AddIndex("idx_verfuegbarkeiten_ref_wt", false, "referent, wochentag", "")
		if err := app.Save(verfuegbarkeiten); err != nil {
			return err
		}

		// ---- 8. buchungen -----------------------------------------------
		buchungen := core.NewBaseCollection("buchungen", "pbc_buchungen")
		buchungen.ListRule = ptr(staffRule)
		buchungen.ViewRule = ptr(staffRule)
		buchungen.CreateRule = nil // E3: create ausschließlich via Custom-Route
		buchungen.UpdateRule = ptr(staffRule)
		buchungen.DeleteRule = ptr(staffRule)
		buchungen.Fields.Add(
			&core.SelectField{Name: "status", Required: true, MaxSelect: 1, Values: []string{
				"angefragt", "bestaetigt", "abgelehnt", "storniert", "verfallen", "durchgefuehrt",
			}},
			&core.RelationField{Name: "angebotsart", Required: true, CollectionId: "pbc_angebotsarten", MaxSelect: 1, CascadeDelete: false},
			&core.RelationField{Name: "thema", Required: true, CollectionId: "pbc_themen", MaxSelect: 1, CascadeDelete: false},
			&core.DateField{Name: "start", Required: true},
			&core.DateField{Name: "ende", Required: true},
			&core.RelationField{Name: "raum", CollectionId: "pbc_raeume", MaxSelect: 1, CascadeDelete: false},
			&core.NumberField{Name: "teilnehmer_geplant", Required: true, OnlyInt: true, Min: ptr(1.0)},
			&core.NumberField{Name: "teilnehmer_ist", OnlyInt: true, Min: ptr(0.0)},
			&core.TextField{Name: "herkunft_land", Required: true, Max: 100},
			&core.SelectField{Name: "herkunft_bundesland", MaxSelect: 1, Values: []string{
				"baden_wuerttemberg", "bayern", "berlin", "brandenburg", "bremen", "hamburg",
				"hessen", "mecklenburg_vorpommern", "niedersachsen", "nordrhein_westfalen",
				"rheinland_pfalz", "saarland", "sachsen", "sachsen_anhalt", "schleswig_holstein",
				"thueringen", "ausland_oder_keine_angabe",
			}},
			&core.RelationField{Name: "herkunft_einrichtungstyp", CollectionId: "pbc_einrichtungstypen", MaxSelect: 1, CascadeDelete: false},
			&core.TextField{Name: "herkunft_einrichtungsname", Max: 255},
			&core.TextField{Name: "herkunft_ort", Max: 255},
			&core.TextField{Name: "kontakt_name", Required: true, Max: 255},
			&core.EmailField{Name: "kontakt_email", Required: true},
			&core.TextField{Name: "kontakt_telefon", Max: 100},
			&core.TextField{Name: "nachricht", Max: 5000},
			&core.TextField{Name: "interne_notiz", Max: 5000},
			&core.TextField{Name: "planungs_notiz", Max: 5000},
			&core.JSONField{Name: "planung_snapshot", MaxSize: 20000},
			&core.TextField{Name: "storno_grund", Max: 2000},
			&core.TextField{Name: "ablehnungs_grund", Max: 2000},
			&core.BoolField{Name: "spam_verdacht"},
		)
		addTimestamps(buchungen)
		buchungen.AddIndex("idx_buchungen_status_start", false, "status, start", "")
		buchungen.AddIndex("idx_buchungen_start", false, "start", "")
		buchungen.AddIndex("idx_buchungen_thema", false, "thema", "")
		buchungen.AddIndex("idx_buchungen_angebotsart", false, "angebotsart", "")
		buchungen.AddIndex("idx_buchungen_raum", false, "raum", "")
		if err := app.Save(buchungen); err != nil {
			return err
		}

		// ---- 9. buchung_referenten --------------------------------------
		buchungReferenten := core.NewBaseCollection("buchung_referenten", "pbc_buchung_referenten")
		buchungReferenten.ListRule = ptr(staffRule)
		buchungReferenten.ViewRule = ptr(staffRule)
		buchungReferenten.CreateRule = ptr(staffRule)
		buchungReferenten.UpdateRule = ptr(staffRule)
		buchungReferenten.DeleteRule = ptr(staffRule)
		buchungReferenten.Fields.Add(
			&core.RelationField{Name: "buchung", Required: true, CollectionId: "pbc_buchungen", MaxSelect: 1, CascadeDelete: true},
			&core.RelationField{Name: "referent", Required: true, CollectionId: "pbc_referenten", MaxSelect: 1, CascadeDelete: false},
			&core.BoolField{Name: "geplant"},
			&core.BoolField{Name: "eingesetzt"},
			&core.SelectField{Name: "quelle", Required: true, MaxSelect: 1, Values: []string{"auto", "manuell"}},
			&core.TextField{Name: "notiz", Max: 1000},
		)
		addTimestamps(buchungReferenten)
		buchungReferenten.AddIndex("idx_buchung_referenten_unique", true, "buchung, referent", "")
		if err := app.Save(buchungReferenten); err != nil {
			return err
		}

		// ---- 10. einstellungen (Singleton) ------------------------------
		einstellungen := core.NewBaseCollection("einstellungen", "pbc_einstellungen")
		einstellungen.ListRule = ptr(staffRule)
		einstellungen.ViewRule = ptr(staffRule)
		einstellungen.UpdateRule = ptr(staffRule)
		einstellungen.CreateRule = nil
		einstellungen.DeleteRule = nil
		einstellungen.Fields.Add(
			&core.NumberField{Name: "puffer_minuten", OnlyInt: true, Min: ptr(0.0)},
			&core.NumberField{Name: "vorlaufzeit_tage_min", OnlyInt: true, Min: ptr(0.0)},
			&core.NumberField{Name: "vorlaufzeit_tage_max", OnlyInt: true, Min: ptr(0.0)},
			&core.NumberField{Name: "anfrage_verfall_stunden", OnlyInt: true, Min: ptr(1.0)},
			&core.JSONField{Name: "oeffnungstage", MaxSize: 1000},
			&core.TextField{Name: "betriebsende", Max: 5, Pattern: `^([01]\d|2[0-3]):[0-5]\d$`},
			&core.NumberField{Name: "max_gruppen_parallel_pro_tag_default", OnlyInt: true, Min: ptr(1.0)},
			&core.NumberField{Name: "max_gruppengroesse_absolut", OnlyInt: true, Min: ptr(1.0)},
			&core.TextField{Name: "team_benachrichtigung_email", Max: 255},
		)
		addTimestamps(einstellungen)
		if err := app.Save(einstellungen); err != nil {
			return err
		}

		// ---- 11. schliesstage -------------------------------------------
		schliesstage := core.NewBaseCollection("schliesstage", "pbc_schliesstage")
		schliesstage.ListRule = ptr(staffRule)
		schliesstage.ViewRule = ptr(staffRule)
		schliesstage.CreateRule = ptr(staffRule)
		schliesstage.UpdateRule = ptr(staffRule)
		schliesstage.DeleteRule = ptr(staffRule)
		schliesstage.Fields.Add(
			&core.DateField{Name: "datum", Required: true},
			&core.TextField{Name: "grund", Max: 255},
		)
		addTimestamps(schliesstage)
		schliesstage.AddIndex("idx_schliesstage_datum", true, "datum", "")
		if err := app.Save(schliesstage); err != nil {
			return err
		}

		return nil
	}, func(app core.App) error {
		// down: delete in reverse dependency order.
		names := []string{
			"schliesstage",
			"einstellungen",
			"buchung_referenten",
			"buchungen",
			"verfuegbarkeiten",
			"referenten",
			"angebotsarten",
			"raeume",
			"einrichtungstypen",
			"themen",
			"mitarbeiter",
		}
		for _, n := range names {
			if col, err := app.FindCollectionByNameOrId(n); err == nil && col != nil {
				if err := app.Delete(col); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
