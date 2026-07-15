# Benutzerhandbuch – Buchungssystem der Gedenkstätte Deutscher Widerstand

Dieses Handbuch beschreibt die tägliche Arbeit mit dem Buchungssystem der Gedenkstätte Deutscher Widerstand. Es richtet sich an Mitarbeitende, die Anfragen für Führungen und Seminare entgegennehmen, einplanen und bestätigen, sowie an technisch Verantwortliche, die das System einrichten und betreiben.

Sie finden hier Schritt-für-Schritt-Anleitungen für alle Bereiche: das öffentliche Buchungsformular, den Admin-Bereich, die Pflege der Stammdaten, die Auswertungen sowie die Einrichtung des Systems. Am Ende steht eine kurze FAQ mit den häufigsten Fragen aus dem Alltag.

> **Zu dieser Hilfe:** Dies ist die **In-App-Hilfe** (aufgabenorientiert, direkt im Admin-Bereich unter `/admin/hilfe`). Eine ausführlichere Fassung mit vertieften Betriebs- und Hintergrundinformationen ist das **Benutzerhandbuch** (`docs/BENUTZERHANDBUCH.md`). Beide Dokumente behandeln dieselben Themen; werden gemeinsame Inhalte (Rollen, Kapazität, Einbettung) geändert, sind sie **in beiden Dateien** zu pflegen.

> **Wichtiger Grundsatz für alle Anfragen:** Eine über das Formular eingegangene Buchung ist zunächst nur eine **unverbindliche Anfrage**. Verbindlich wird ein Termin erst, wenn Sie ihn im Admin-Bereich **bestätigen**.

---

## Inhaltsverzeichnis

1. [Überblick über das System](#1-überblick-über-das-system)
2. [Für Besucher:innen: online anfragen](#2-für-besucherinnen-online-anfragen)
3. [Erste Schritte: Anmeldung im Admin-Bereich](#3-erste-schritte-anmeldung-im-admin-bereich)
4. [Buchungen bearbeiten](#4-buchungen-bearbeiten)
5. [Stammdaten pflegen](#5-stammdaten-pflegen)
6. [Auswertungen verstehen](#6-auswertungen-verstehen)
7. [Mitarbeiter & Rollen](#7-mitarbeiter--rollen)
8. [Das Formular in die Webseite einbetten (TYPO3)](#8-das-formular-in-die-webseite-einbetten-typo3)
9. [Betrieb](#9-betrieb)
10. [Häufige Fragen (FAQ)](#10-häufige-fragen-faq)
11. [QA-/Testmodus (nur Test-/Schulungsumgebung)](#11-qa-testmodus-nur-test-schulungsumgebung)

---

## 1. Überblick über das System

Das Buchungssystem verwaltet Anfragen und Termine für die pädagogischen Angebote der Gedenkstätte. Es besteht aus zwei Teilen:

- **Öffentliches Buchungsformular** – erreichbar unter **https://buchung.niaz.omg.lol** (bzw. eingebettet auf der Gedenkstätten-Website). Hier stellen Interessierte ihre Anfragen selbst.
- **Admin-Bereich** – erreichbar unter **/admin**. Hier bearbeiten Sie als Mitarbeitende die Anfragen, planen Referent:innen ein, pflegen Stammdaten und sehen Auswertungen.

### Angebotsarten

Es gibt zwei Arten von Angeboten, die beide von denselben Referent:innen durchgeführt werden:

- **Führung** – kürzeres Format, benötigt **keinen** Raum.
- **Seminar** – längeres Format, **blockiert einen Raum** in der Gedenkstätte.

### Referent:innen, Themen und Verfügbarkeiten

Jede:r Referent:in hat:

- zugeordnete **Themen** (die inhaltlichen Kompetenzen, zu denen die Person führen darf) und
- **Verfügbarkeiten** (Zeiten, zu denen die Person einsetzbar oder ausdrücklich gesperrt ist – wöchentlich wiederkehrend oder einmalig).

Aus diesen Angaben berechnet das System automatisch, welche Referent:innen zu einer Anfrage passen und frei sind.

### Benötigte Referent:innen je Buchung

Wie viele Referent:innen eine Buchung braucht, ergibt sich automatisch aus der gewählten Angebotsart und der Gruppengröße:

> **Benötigte Referent:innen = Maximum aus „Min. Referenten“ und „Gruppengröße ÷ Betreuungsschlüssel“ (aufgerundet)**

Beide Werte (Mindestanzahl und Betreuungsschlüssel) sind je Angebotsart konfigurierbar. Die berechnete Zahl sehen Sie im Buchungsdetail als „x von y“-Anzeige.

### Statusübersicht einer Buchung

Eine Buchung durchläuft im System verschiedene Status:

| Status | Bedeutung |
|---|---|
| **Angefragt** | Neu eingegangene, noch unbearbeitete Anfrage. |
| **Warteliste** | Anfrage wird offen gehalten, ohne automatisch zu verfallen. |
| **Bestätigt** | Termin ist verbindlich zugesagt. |
| **Abgelehnt** | Anfrage wurde mit Grund abgelehnt. |
| **Storniert** | Eine zuvor bestätigte Buchung wurde nachträglich storniert. |
| **Verfallen** | Eine offene Anfrage ist nach Ablauf der Verfallszeit automatisch verfallen. |
| **Durchgeführt** | Der Termin hat stattgefunden (Ist-Erfassung möglich/erfolgt). |

---

## 2. Für Besucher:innen: online anfragen

Interessierte erreichen das öffentliche Buchungsformular direkt unter **https://buchung.niaz.omg.lol** oder eingebettet auf der Gedenkstätten-Website (siehe [Abschnitt 8](#8-das-formular-in-die-webseite-einbetten-typo3)). In beiden Fällen handelt es sich um denselben mehrstufigen Assistenten, der Schritt für Schritt durch die Anfrage führt.

Auf jeder Seite des Formulars wird deutlich darauf hingewiesen, dass es sich um eine **unverbindliche Anfrage** handelt. Verbindlich wird der Termin erst mit Ihrer Bestätigung im Admin-Bereich.

### Die sieben Schritte des Assistenten

1. **Angebotsart wählen** – **Führung** (kürzer, kein Raum) oder **Seminar** (länger, mit Raum).
2. **Thema auswählen** – angezeigt werden nur Themen, die für die gewählte Angebotsart angeboten werden.
3. **Gruppengröße angeben** – nur Werte innerhalb der zulässigen Mindest- und Höchstgruppengröße sind möglich.
4. **Wunschtermin wählen** – der Kalender zeigt **ausschließlich tatsächlich buchbare Tage und Uhrzeiten** an (siehe Hinweis unten).
5. **Herkunft angeben** – Land, Bundesland, Einrichtungstyp (z. B. Schule), Name der Einrichtung und Ort.
6. **Kontaktdaten eingeben** – Name, E-Mail-Adresse, Telefonnummer, Nachricht (Freitext) sowie ein **Pflicht-Häkchen zur Datenschutzerklärung**. Ohne dieses Häkchen kann die Anfrage nicht abgeschickt werden.
7. **Zusammenfassung prüfen und absenden** – alle Angaben werden noch einmal übersichtlich angezeigt und erst dann über den Absenden-Button verschickt.

### Warum im Kalender nur bestimmte Termine erscheinen

Der Kalender berücksichtigt im Hintergrund automatisch:

- ob genügend Referent:innen mit passendem Thema an diesem Termin verfügbar sind,
- bei Seminaren zusätzlich, ob ein Raum frei ist,
- die Öffnungstage der Gedenkstätte,
- die hinterlegten Vorlauffristen (minimale und maximale Vorlaufzeit),
- bereits ausgebuchte Tage – diese sind gesperrt und nicht anklickbar.

Interessierte müssen also keinen Termin „auf Verdacht“ anfragen: Jede wählbare Uhrzeit ist zum Zeitpunkt der Anfrage grundsätzlich realisierbar.

### Nach dem Absenden

- Es erscheint eine **Bestätigungsseite**, die den Eingang der Anfrage bestätigt.
- Sofern SMTP eingerichtet ist (siehe [Abschnitt 9](#9-betrieb)), erhält die anfragende Person zusätzlich eine **Eingangsbestätigungs-E-Mail**.
- Die Anfrage muss anschließend von Ihnen im Admin-Bereich geprüft und bestätigt werden, bevor der Termin verbindlich ist.

> **Hinweis:** Das Formular ist im Hintergrund durch unsichtbaren Spam- und Missbrauchsschutz (Honeypot-Feld, Rate-Limit) abgesichert. Besucher:innen bemerken davon nichts – es ist kein Captcha oder Ähnliches nötig.

### Sprache: Deutsch oder Englisch

Das öffentliche Buchungsformular ist **zweisprachig (Deutsch/Englisch)**. Voreingestellt ist **Deutsch**.

- Besucher:innen wechseln die Sprache über den **Sprachumschalter (DE/EN-Buttons)** im Formular.
- Alternativ lässt sich die Sprache über den URL-Parameter **`?lang=en`** vorwählen (z. B. für die englische Einbettung, siehe [Abschnitt 8](#8-das-formular-in-die-webseite-einbetten-typo3)). Ohne Parameter bzw. bei unbekanntem Wert bleibt es bei Deutsch.
- Für **Themen**, **Angebotsarten** und **Einrichtungstypen** können Sie optional englische Namen (und Beschreibungen) hinterlegen. Ist kein englischer Text gepflegt, wird automatisch der deutsche Text angezeigt (Fallback). Details in [Abschnitt 5](#5-stammdaten-pflegen).

> **Hinweis:** Der Admin-Bereich selbst ist ausschließlich auf Deutsch; die Sprachwahl betrifft nur die öffentliche Buchungsstrecke.

---

## 3. Erste Schritte: Anmeldung im Admin-Bereich

1. Rufen Sie in Ihrem Browser **https://buchung.niaz.omg.lol/admin/login** auf.
2. Geben Sie die **E-Mail-Adresse** und das **Passwort** Ihres Mitarbeiter-Kontos ein.
3. Klicken Sie auf **Anmelden**.

Nach erfolgreicher Anmeldung gelangen Sie zum **Dashboard**. Die Navigation finden Sie als **Seitenleiste** am linken Bildschirmrand; auf mobilen Geräten öffnen Sie sie über den **Menü-Button** oben.

> **Hinweis:** Dies ist der Login für den täglichen Gebrauch. Der technische Zugang unter `/_/` (PocketBase-Superuser) ist **nicht** für die Alltagsarbeit gedacht – siehe [Abschnitt 7](#7-mitarbeiter--rollen).

### Das Dashboard

Das Dashboard gibt Ihnen einen schnellen Überblick über den aktuellen Stand:

- **Kennzahlen (KPIs):** Anzahl offener Anfragen, kommende Termine der nächsten 7 Tage, Auslastung der laufenden Woche sowie **offene Ist-Erfassungen**.
- **Neue Anfragen:** Liste der zuletzt eingegangenen Buchungsanfragen mit Schnellaktionen, damit Sie direkt reagieren können, ohne erst in die Detailansicht zu wechseln.
- **Nächste Termine:** Übersicht der anstehenden bestätigten Termine.
- **Offene Ist-Erfassungen:** Liste der **bestätigten** Termine, deren Termintag bereits erreicht oder vorüber ist, die aber noch **nicht als „durchgeführt" erfasst** wurden. Diese Kachel ist Ihr **Arbeitsvorrat** für die Nacherfassung: Jeder Eintrag verlinkt direkt in die Buchungsdetailansicht, wo Sie die Ist-Daten nachtragen. Sind alle fälligen Termine erfasst, ist die Liste leer.

---

## 4. Buchungen bearbeiten

### 4.1 Die Buchungsliste

Über den Menüpunkt **Buchungen** gelangen Sie zur vollständigen Liste aller Anfragen und Termine.

**Filtermöglichkeiten:**

| Filter | Optionen |
|---|---|
| Status | Angefragt, Warteliste, Bestätigt, Abgelehnt, Storniert, Verfallen, Durchgeführt |
| Zeitraum | frei wählbarer Datumsbereich |
| Angebotsart | Führung, Seminar |

Die Liste ist paginiert – über die Seitennavigation am unteren Rand blättern Sie durch weitere Ergebnisse. Klicken Sie auf einen Listeneintrag, um die **Buchungsdetailansicht** zu öffnen.

### 4.2 Eine telefonische oder persönliche Anfrage selbst erfassen

Geht eine Anfrage nicht über das öffentliche Formular, sondern telefonisch oder persönlich bei Ihnen ein, erfassen Sie diese selbst:

1. Klicken Sie in der Seitenleiste auf **Buchungen → Neue Buchung** (bzw. rufen Sie `/admin/buchungen/neu` auf).
2. Füllen Sie die Felder aus:
   - Angebotsart (Führung/Seminar)
   - Thema
   - Datum und Uhrzeit
   - Gruppengröße
   - Herkunft (Land, Bundesland, Einrichtungstyp, Einrichtungsname, Ort)
   - Kontaktdaten (Name, E-Mail, Telefon)
   - eine **interne Notiz**, z. B. mit Hinweisen zum Telefonat
3. Speichern Sie die Buchung.

Die so erfasste Buchung erscheint anschließend ganz normal in der Buchungsliste und wird wie jede andere Anfrage weiter eingeplant und bestätigt.

### 4.3 Die Buchungsdetailansicht

Die Detailansicht gliedert sich in drei Bereiche:

**a) Buchungsdaten** – zeigt alle erfassten Angaben zur Anfrage **schreibgeschützt** an: Angebotsart, Thema, Termin, Gruppengröße, Herkunft und Kontaktdaten.

**b) Referenten-Planung** – hier planen Sie, welche Referent:innen den Termin durchführen:

1. Klicken Sie auf **Vorschlag berechnen**. Das System schlägt automatisch passende, freie Referent:innen vor – basierend auf Thema, Verfügbarkeit und aktueller Auslastung.
2. Prüfen Sie den Vorschlag und klicken Sie auf **Übernehmen**, um die vorgeschlagenen Referent:innen zuzuweisen.
3. Sie können Referent:innen auch **manuell hinzufügen** oder **entfernen**. Beim manuellen Hinzufügen prüft das System **live auf Konflikte** (z. B. Terminüberschneidungen). Liegt eine **harte Doppelbelegung** vor, müssen Sie dies ausdrücklich bestätigen, bevor die Zuweisung übernommen wird.
4. Die **Bedarfs-Anzeige** zeigt jederzeit den Planungsstand im Format **„x von y“** (zugewiesene von benötigten Referent:innen).

**c) Ist-Erfassung** – hier halten Sie fest, wie der Termin tatsächlich abgelaufen ist.

Die Ist-Erfassung ist **immer sichtbar**, vor dem Termin aber **ausgegraut und gesperrt** (mit dem Hinweis, ab wann sie freigeschaltet wird). Die Freischaltung ist **tagesbasiert**: Sie können ab dem **Termintag** erfassen – nicht erst ab der Uhrzeit des Termins. Technisch gilt: die Erfassung ist frei, sobald die Buchung bereits `durchgeführt` ist **oder** der heutige Tag den Termintag erreicht bzw. überschritten hat.

Sobald freigeschaltet, stehen folgende Aktionen zur Verfügung:

- **Häkchen „eingesetzt"** je Referent:in – kreuzen Sie an, wer **tatsächlich im Einsatz** war.
- **Spontane Vertretung erfassen** – eine nicht geplante Person nachträglich als eingesetzt hinzufügen.
- **Teilnehmer:innen (Ist)** – die **tatsächliche Teilnehmerzahl** eintragen und **Speichern**.
- **Als durchgeführt markieren** – schließt den Termin ab (Status wird `durchgeführt`) und übernimmt die eingetragene Ist-Teilnehmerzahl.
- **Niemand erschienen** – Kurzweg für No-Show: setzt die Ist-Teilnehmerzahl auf 0, alle Zuordnungen auf „nicht eingesetzt" und markiert den Termin als durchgeführt.

### 4.4 Buchungs-Aktionen

Je nach Status stehen Ihnen folgende Aktionen zur Verfügung:

- **Bestätigen:** Die Anfrage wird verbindlich zugesagt (siehe Kapazitätshandling in [Abschnitt 4.5](#45-kapazitätshandling-unterbesetzung-raum-offen-und-trotzdem-bestätigen)).
- **Ablehnen:** Erfordert die Angabe eines Grundes; optional kann dieser Grund an die anfragende Person mitgeteilt werden.
- **Stornieren:** Für bereits bestätigte Buchungen, die nachträglich storniert werden müssen.
- **Auf Warteliste setzen:** Hält die Anfrage offen, ohne dass sie automatisch verfällt – nützlich, wenn eine Entscheidung noch aussteht. Über **Wieder als Anfrage** versetzen Sie die Buchung zurück in den Status „Angefragt“.

### 4.5 Kapazitätshandling: Unterbesetzung, „Raum offen“ und „Trotzdem bestätigen“

Dies ist der wichtigste Punkt beim Bestätigen einer Buchung. Die zugrunde liegenden Entscheidungen sind in **`docs/KAPAZITAET.md`** dokumentiert. Bestätigen (inkl. „Trotzdem bestätigen") ist eine **Personal-Aktion** – die Rolle **Auskunftsassistenz** kann Buchungen nicht bestätigen.

**Grundprinzip:** Das System blockiert die Bestätigung **nur dann hart**, wenn ein konkret **gewählter Raum** zum gewünschten Termin bereits belegt ist. In allen anderen kritischen Fällen erhalten Sie lediglich eine **Warnung** und können die Buchung trotzdem bestätigen.

**Wann erscheint eine Warnung?** Beim Klick auf **Bestätigen** prüft das System automatisch:

1. **Unterbesetzung** – es sind weniger Referent:innen zugewiesen als benötigt (siehe „x von y“-Anzeige).
2. **Fehlender Raum** – bei Seminaren ist noch kein Raum zugewiesen.
3. **Terminüberschneidung** – es gibt eine zeitliche Überlappung mit einem anderen Termin.

In jedem dieser Fälle zeigt das System eine Warnung mit der Option **„Trotzdem bestätigen“**.

**Vorgehen beim „Trotzdem bestätigen“:**

1. Sie erhalten die Warnung mit dem konkreten Problem.
2. Klicken Sie auf **Trotzdem bestätigen**.
3. Es öffnet sich ein Feld für einen **Pflicht-Grund** – begründen Sie, warum die Buchung trotz der Warnung bestätigt wird (z. B. „Zusage der Referentin liegt bereits telefonisch vor“).
4. Nach Eingabe des Grundes bestätigen Sie die Buchung endgültig.

**Was passiert danach?**

- Die Buchung wird bestätigt, aber sichtbar gekennzeichnet: **„Unterbesetzt“** bzw. **„Raum offen“**.
- Ihr eingegebener Grund wird automatisch in die **interne Notiz** übernommen, sodass alle Kolleg:innen nachvollziehen können, warum trotz Warnung bestätigt wurde.

**Praxisbeispiel:** Eine Referentin hat Ihnen telefonisch zugesagt, ist aber im System noch nicht als verfügbar hinterlegt, sodass der automatische Vorschlag sie nicht anzeigt. Sie weisen sie dennoch manuell zu, klicken auf **Bestätigen**, erhalten die Unterbesetzungs-Warnung, klicken auf **Trotzdem bestätigen** und tragen als Grund „telefonische Zusage der Referentin, Verfügbarkeit wird nachgepflegt“ ein. Die Buchung erscheint danach als bestätigt und mit dem Hinweis „Unterbesetzt“, der Grund steht in der internen Notiz.

> **Wichtig:** Ein gewählter, tatsächlich belegter Raum lässt sich **nicht** über „Trotzdem bestätigen“ umgehen. Hier müssen Sie entweder einen anderen Raum wählen oder Termin bzw. Buchung entsprechend anpassen.

---

## 5. Stammdaten pflegen

Alle Stammdaten erreichen Sie über die Seitenleiste im Admin-Bereich (auf dem Smartphone über den Menü-Button oben). Stammdaten sind die Grundbausteine, mit denen das System automatisch passende Referent:innen vorschlägt und den Buchungskalender korrekt befüllt.

> **Hinweis:** Änderungen an Stammdaten wirken sich erst auf **neue** Anfragen bzw. Berechnungen aus. Bestehende Buchungen bleiben unverändert.

### 5.1 Referenten

Hier verwalten Sie alle Referent:innen, die Führungen und Seminare durchführen.

1. Öffnen Sie in der Seitenleiste **Referenten**.
2. Über **Neuer Referent** (bzw. **+**) legen Sie eine Person neu an.
3. Ordnen Sie unter **Themen** per Mehrfachauswahl alle Themen zu, zu denen die Person führen bzw. Seminare geben darf. Nur zugeordnete Themen führen dazu, dass die Person bei einer passenden Anfrage vorgeschlagen wird.
4. Pflegen Sie unter **Verfügbarkeiten** die Zeiten der Person (siehe [Abschnitt 5.2](#52-verfügbarkeiten-der-referentinnen)).
5. Über den Schalter **Aktiv** deaktivieren Sie eine Person, die vorübergehend oder dauerhaft nicht mehr eingeplant werden soll (z. B. Elternzeit, Ausscheiden). **Löschen Sie Referent:innen bitte nicht, sondern deaktivieren Sie sie** – so bleiben vergangene Buchungen und Auswertungen korrekt zugeordnet.
6. Speichern Sie Ihre Änderungen.

> **Wichtig:** Die Namen der Referent:innen erscheinen **nie** im öffentlichen Formular oder in Bestätigungen an Kund:innen – sie sind ausschließlich intern sichtbar.

### 5.2 Verfügbarkeiten der Referent:innen

Verfügbarkeiten legen fest, wann eine Person grundsätzlich einsetzbar ist. Sie pflegen sie direkt am jeweiligen Referenten-Datensatz.

1. Öffnen Sie den gewünschten Referenten und wechseln Sie zum Bereich **Verfügbarkeiten**.
2. Klicken Sie auf **Neuer Eintrag** und wählen Sie die **Art**:
   - **Verfügbar** – die Person kann in diesem Zeitraum eingeplant werden.
   - **Gesperrt** – die Person ist in diesem Zeitraum ausdrücklich nicht einsetzbar (z. B. Urlaub, Fortbildung).
3. Wählen Sie die **Wiederholung**:
   - **Wöchentlich:** Wochentag sowie Uhrzeit von–bis angeben, dazu optional den Gültigkeitszeitraum (ab wann/bis wann die Regel gilt).
   - **Einmalig:** konkretes Start- und Enddatum/-uhrzeit angeben (z. B. für einen einzelnen Urlaubstag oder eine einmalige Zusatzverfügbarkeit).
4. Speichern. Sie können beliebig viele Einträge je Person anlegen; das System berücksichtigt alle hinterlegten Regeln gemeinsam.

> **Tipp:** Für Ausnahmen legen Sie einfach einen einmaligen **„Gesperrt“**-Eintrag an – etwa einen Urlaubstag innerhalb einer sonst wöchentlichen Verfügbarkeit.

### 5.3 Themen

Themen sind die inhaltlichen Angebote (Kompetenzen), die Referent:innen zugeordnet werden und die Besucher:innen im öffentlichen Formular als Schritt 2 auswählen.

1. Seitenleiste → **Themen**.
2. **Neues Thema** anlegen, benennen und speichern.
3. Optional können Sie einen **englischen Namen (`name_en`)** und eine **englische Beschreibung (`beschreibung_en`)** hinterlegen. Diese erscheinen im öffentlichen Formular, wenn Besucher:innen Englisch wählen. Bleiben die Felder leer, wird automatisch der deutsche Text angezeigt (Fallback).
4. Bestehende Themen können Sie bearbeiten oder löschen. Ein gelöschtes Thema steht im öffentlichen Formular nicht mehr zur Auswahl und muss bei betroffenen Referent:innen ggf. neu zugeordnet werden.

### 5.4 Räume

Räume werden nur für Seminare benötigt (Führungen blockieren keinen Raum).

1. Seitenleiste → **Räume**.
2. **Neuer Raum:** Namen und **Kapazität** (maximale Personenzahl) eintragen.
3. Speichern. Die Kapazität wird bei der Kalenderprüfung im öffentlichen Formular sowie bei der Kapazitätswarnung im Buchungsdetail berücksichtigt.

### 5.5 Angebotsarten

Angebotsarten definieren die Rahmenbedingungen von Führung und Seminar:

| Feld | Bedeutung |
|---|---|
| Dauer (Min.) | Länge der Veranstaltung in Minuten |
| Benötigt Raum | Ja/Nein – bei „Ja“ muss im Kalender ein freier Raum vorhanden sein |
| Min./Max. Teilnehmer | erlaubte Gruppengröße im öffentlichen Formular |
| Min. Referenten | Mindestanzahl an Referent:innen, unabhängig von der Gruppengröße |
| Betreuungsschlüssel | Anzahl Teilnehmender, die eine Referentin/ein Referent betreut |
| Zeitslots | mögliche Startzeiten, die im Kalender angeboten werden |
| Aktiv | Schalter, ob die Angebotsart im öffentlichen Formular wählbar ist |

**Vorgehen:**

1. Seitenleiste → **Angebotsarten**.
2. **Neue Angebotsart** anlegen oder eine bestehende (Führung/Seminar) öffnen.
3. Alle Felder aus der Tabelle ausfüllen bzw. anpassen.
4. Zeitslots als Liste möglicher Startzeiten hinterlegen (z. B. 09:00, 11:00, 14:00).
5. Optional einen **englischen Namen (`name_en`)** und eine **englische Beschreibung (`beschreibung_en`)** hinterlegen; leer ⇒ Fallback auf den deutschen Text.
6. Über **Aktiv** eine Angebotsart vorübergehend aus dem öffentlichen Formular nehmen, ohne sie zu löschen.
7. Speichern.

Aus „Min. Referenten“ und „Betreuungsschlüssel“ errechnet das System die **benötigte Anzahl Referent:innen** je Buchung (siehe Formel in [Abschnitt 1](#1-überblick-über-das-system)).

### 5.6 Einrichtungstypen

Einrichtungstypen (z. B. Schule, Universität, Verein) stehen Besucher:innen im öffentlichen Formular bei Schritt 5 „Herkunft“ zur Auswahl.

1. Seitenleiste → **Einrichtungstypen**.
2. **Neuer Einrichtungstyp** anlegen, benennen, speichern.
3. Optional einen **englischen Namen (`name_en`)** hinterlegen (leer ⇒ Fallback auf Deutsch). Einrichtungstypen haben – anders als Themen und Angebotsarten – **keine** englische Beschreibung, nur einen englischen Namen.
4. Bearbeiten/Löschen wie bei den anderen Stammdatenlisten.

> **Hinweis:** Englische Bezeichner gibt es ausschließlich für diese drei Stammdaten-Collections (**Themen**, **Angebotsarten**, **Einrichtungstypen**). Alle übrigen Stammdaten sind einsprachig deutsch.

### 5.7 Schließtage

Schließtage sind Tage, an denen grundsätzlich keine Führungen/Seminare stattfinden (z. B. Feiertage, Betriebsurlaub). An diesen Tagen zeigt der öffentliche Kalender keine buchbaren Zeiten an.

1. Seitenleiste → **Schließtage**.
2. **Neuer Schließtag:** Datum (bzw. Zeitraum) und optional eine Bezeichnung eintragen.
3. Speichern. Der Tag ist ab sofort für neue Anfragen gesperrt.

### 5.8 Einstellungen (global)

Unter **Einstellungen** legen Sie die grundsätzlichen Rahmenbedingungen für den gesamten Buchungsprozess fest:

| Einstellung | Bedeutung |
|---|---|
| Puffer zwischen Terminen | Mindestabstand (Minuten) zwischen zwei Terminen desselben Referenten/Raums |
| Vorlaufzeit min./max. (Tage) | wie kurzfristig frühestens bzw. wie weit im Voraus höchstens gebucht werden darf |
| Verfall offener Anfragen (Std.) | nach wie vielen Stunden eine unbestätigte Anfrage automatisch verfällt |
| Öffnungstage | Wochentage, an denen grundsätzlich gebucht werden kann |
| Betriebsende | Uhrzeit, bis zu der am Betriebstag spätestens Termine liegen dürfen |
| Max. parallele Gruppen/Tag | Obergrenze gleichzeitig stattfindender Gruppen an einem Tag |
| Absolute Max-Gruppengröße | Obergrenze der Gruppengröße über alle Angebotsarten hinweg |
| Team-Benachrichtigungs-E-Mail | Adresse, an die interne Benachrichtigungen (z. B. neue Anfragen) gehen |

1. Seitenleiste → **Einstellungen**.
2. Gewünschte Werte anpassen.
3. **Speichern** – die neuen Werte gelten ab sofort für den öffentlichen Buchungskalender und alle neuen Anfragen.

---

## 6. Auswertungen verstehen

Unter **Auswertungen** finden Sie mehrere Diagramme zum Betrieb und zur Auslastung. Oben auf der Seite wählen Sie zunächst den gewünschten **Datumsbereich** – alle Diagramme beziehen sich auf diesen Zeitraum und aktualisieren sich automatisch, wenn Sie ihn ändern.

- **Besucher nach Herkunft:** Zeigt, aus welchem Bundesland, Land bzw. Einrichtungstyp die angefragten/gebuchten Gruppen kommen. Nützlich, um z. B. zu sehen, aus welchen Regionen oder Schularten die meisten Anfragen stammen.
- **Geplant vs. Ist:** Vergleicht je Monat die geplanten Werte (bei der Buchung angegebene Teilnehmerzahl bzw. eingeplante Referent:innen) mit den tatsächlichen Werten aus der Ist-Erfassung (tatsächliche Teilnehmerzahl, tatsächlich eingesetzte Referent:innen). So erkennen Sie z. B., ob Gruppen regelmäßig kleiner ausfallen als angemeldet.
- **Referenten-Auslastung:** Zeigt, wie stark einzelne Referent:innen im gewählten Zeitraum eingeplant bzw. eingesetzt waren – hilfreich für eine gleichmäßige Verteilung der Einsätze.
- **Buchungen je Monat:** Zeigt die Anzahl der Buchungen über die Zeit, gegliedert nach Monat, und macht saisonale Schwankungen sichtbar.

Die Auswertungen dienen der internen Planung; sie werden nicht veröffentlicht und geben keine Namen von Referent:innen gegenüber Dritten weiter.

---

## 7. Mitarbeiter & Rollen

### 7.1 Die zwei Zugangsebenen

Das System unterscheidet strikt zwischen zwei Zugängen:

| Ebene | Adresse | Zweck | Für wen |
|---|---|---|---|
| **Admin-Bereich** | `/admin` | Tägliche Arbeit: Buchungen bearbeiten, Referent:innen planen, Stammdaten pflegen, Auswertungen ansehen | Alle Mitarbeitenden |
| **PocketBase-Superuser** | `/_/` | Technischer Zugang für Ersteinrichtung, Datenbank-/Schema-Verwaltung und Notfälle | Nur technisch Verantwortliche |

Der Superuser-Zugang unter `/_/` ist **nicht für den Alltag gedacht**. Für die normale Büroarbeit melden Sie sich immer unter `/admin/login` mit Ihrem Mitarbeiter-Konto an.

### 7.2 Rollen: Leitung, Mitarbeiter und Auskunftsassistenz

Jedes Mitarbeiter-Konto besitzt genau **eine** von **drei** Rollen. Sie steuert, welche Bereiche und Aktionen im Admin-Bereich verfügbar sind:

- **Leitung** (`leitung`) – voller Zugriff auf alle Funktionen inklusive der Verwaltung von Referent:innen, Verfügbarkeiten und Mitarbeitenden.
- **Mitarbeiter** (`mitarbeiter`) – der tägliche Arbeitsbereich: Buchungen bearbeiten, planen, bestätigen, Stammdaten und Auswertungen. Referent:innen und Verfügbarkeiten kann diese Rolle **einsehen, aber nicht ändern**; Mitarbeitende einladen kann sie nicht.
- **Auskunftsassistenz** (`auskunft`) – bewusst stark eingeschränkte Rolle für den **Empfang/Schalter**. Sieht ausschließlich eine **schlanke Ansicht** der relevanten Termine und trägt den **Ist-Zustand** ein (siehe unten).

#### Rechte-Übersicht

| Bereich | Leitung | Mitarbeiter | Auskunftsassistenz |
|---|:---:|:---:|:---:|
| Dashboard, Auswertungen | ✓ | ✓ | – |
| Buchungen sehen/bearbeiten (volle Detailsicht) | ✓ | ✓ | – (nur schlanke Sicht) |
| Neue Buchung manuell erfassen | ✓ | ✓ | – |
| Ist-Erfassung eintragen | ✓ | ✓ | ✓ (nur bestätigte/durchgeführte) |
| Stammdaten Themen/Räume/Angebotsarten/Einrichtungstypen/Schließtage | ✓ | ✓ | – |
| **Referenten anlegen/ändern/löschen** | ✓ | nur lesen | – |
| **Verfügbarkeiten anlegen/ändern/löschen** | ✓ | nur lesen | – |
| **Mitarbeitende einladen/verwalten** | ✓ | – | – |
| Einstellungen, Einbetten | ✓ | ✓ | – |

#### Die Rolle „Auskunftsassistenz" im Detail

Diese Rolle ist für Personen am Empfang gedacht, die Gruppen begrüßen und den Verlauf dokumentieren, ohne Zugriff auf sensible Daten zu erhalten. Konkret:

- Sie sieht **nur** Buchungen mit Status **bestätigt** oder **durchgeführt** – in einer **schlanken Detailansicht** mit: Angebotsart, Thema, Termin, Raum, Gruppengröße, **Kontakt-Name + Telefon** sowie den zugewiesenen **Referent:innen mit Name + Telefon**.
- Sie trägt den **Ist-Zustand** ein (wer war eingesetzt, tatsächliche Teilnehmerzahl, „durchgeführt").
- Sie hat **keinen** Zugriff auf E-Mail-Adressen, Herkunft, die Nachricht der Anfrage, interne Notizen, das Dashboard, die Auswertungen, die Stammdaten oder die Verwaltung.

> **Wichtig:** Diese Einschränkung ist **serverseitig** durchgesetzt – nicht nur durch ausgeblendete Menüpunkte. Die schlanke Sicht wird über eine eigene, projizierende Schnittstelle geliefert, die sensible Felder gar nicht erst herausgibt. Ein Umgehen über den Browser oder direkte API-Aufrufe ist damit nicht möglich.

### 7.3 Ersteinrichtung des Systems

Bei der ersten Inbetriebnahme ist noch kein Mitarbeiter-Konto vorhanden. Gehen Sie in dieser Reihenfolge vor:

1. Rufen Sie `/_/` auf und legen Sie dort den **ersten Superuser** an.
2. Melden Sie sich mit diesem Superuser unter `/_/` an und legen Sie in der Collection **„mitarbeiter“** das erste Mitarbeiter-Konto an – alternativ nutzen Sie, sobald ein Superuser existiert, den regulären Einladungs-Flow (siehe unten).
3. Ab jetzt läuft die tägliche Arbeit ausschließlich über `/admin/login`. Der Superuser-Zugang wird nur noch bei technischem Bedarf benötigt.

### 7.4 Weitere Mitarbeitende einladen

Sobald mindestens ein Mitarbeiter-Konto existiert, laden Sie neue Kolleg:innen bequem über den Admin-Bereich ein – ein Superuser-Zugriff ist dafür nicht mehr nötig.

> **Nur die Leitung darf einladen und verwalten.** Der Menüpunkt **„Mitarbeiter"** ist ausschließlich für die Rolle **Leitung** sichtbar und die Einladung serverseitig auf diese Rolle beschränkt.

1. Öffnen Sie in der Seitenleiste den Menüpunkt **„Mitarbeiter“** (`/admin/mitarbeiter`).
2. Klicken Sie auf die Funktion zum Einladen eines neuen Mitarbeiters / einer neuen Mitarbeiterin.
3. Geben Sie die **E-Mail-Adresse** ein und wählen Sie die gewünschte **Rolle**. Zur Auswahl stehen **Mitarbeiter**, **Leitung** und **Auskunftsassistenz (nur Schalter)**.

> **Hinweis zur Anmeldung:** E-Mail-Adressen werden **ohne Rücksicht auf Groß-/Kleinschreibung** behandelt (intern in Kleinbuchstaben gespeichert). Beim Login ist es also egal, ob die Adresse groß oder klein eingegeben wird.
4. Bestätigen Sie die Einladung. Das System legt daraufhin ein **inaktives Konto** an.
5. Ist SMTP konfiguriert (siehe [Abschnitt 9](#9-betrieb)), verschickt das System automatisch eine Einladungs-E-Mail. Zusätzlich wird Ihnen der **Einladungslink direkt im Admin-Bereich angezeigt** – so können Sie ihn auch manuell weitergeben (z. B. wenn noch kein SMTP eingerichtet ist). Der Link ist **7 Tage** gültig.

**So schließt die eingeladene Person die Registrierung ab:**

1. Sie öffnet den erhaltenen Link bzw. ruft `/admin/einladung` mit dem Einladungscode auf.
2. Sie vergibt dort selbst ihren **Namen** und ein **Passwort**.
3. Nach dem Absenden ist das Konto **aktiv** und die Person kann sich unter `/admin/login` anmelden.

**Konten verwalten:** In der Liste unter „Mitarbeiter“ sehen Sie zu jedem Konto den Status **„Eingeladen“** oder **„Aktiv“**. Für noch nicht aktivierte Einladungen können Sie die Einladung **erneut senden** (z. B. bei abgelaufener Gültigkeit oder nicht angekommener E-Mail) oder **widerrufen**. Aus Sicherheitsgründen können Sie Ihr **eigenes Konto nicht selbst löschen**.

---

## 8. Das Formular in die Webseite einbetten (TYPO3)

Damit Interessierte das Buchungsformular direkt auf einer Seite der Gedenkstätten-Website nutzen können, lässt es sich in TYPO3 einbetten. Die passenden, kopierbaren Code-Bausteine finden technisch Verantwortliche im Admin-Bereich unter **Einbetten** (`/admin/einbetten`). Dort werden beide Varianten – jeweils für **Deutsch und Englisch** – angezeigt, sodass Sie nichts von Hand zusammenbauen müssen.

> Eine ausführliche technische Anleitung mit allen Optionen und Voraussetzungen steht in **`docs/EINBETTUNG.md`**.

Beide Varianten binden dieselbe chromelose Formular-Route **`/embed`** ein (für Englisch **`/embed?lang=en`**).

### Variante 1 (empfohlen): Lade-Skript

Diese Variante passt die Höhe des eingebetteten Formulars **automatisch** an den Inhalt an, sodass keine Scrollbalken oder abgeschnittenen Inhalte entstehen.

1. Im Admin-Bereich unter **Einbetten** den bereitgestellten Code kopieren. Er besteht aus zwei Zeilen:
   - einem `<div>`-Element mit dem Attribut `data-gdw-buchung`,
   - einem `<script>`-Tag, dessen `src` auf `.../embed.js` verweist.
   - Für die **englische** Seite ergänzt der Schnipsel am `<div>` zusätzlich `data-lang="en"` – der Loader bindet dann automatisch `/embed?lang=en` ein.
2. In TYPO3 auf der gewünschten Seite ein Inhaltselement vom Typ **HTML** (bzw. „Allgemein: HTML“) anlegen.
3. Den kopierten Code einfügen und speichern.
4. Seite im Frontend aufrufen und prüfen, ob das Formular korrekt angezeigt wird und sich die Höhe beim Durchklicken der Schritte automatisch anpasst.

### Variante 2 (Alternative): iframe

Falls kein Skript eingebunden werden kann, steht alternativ ein reines **iframe** zur Verfügung, das auf `/embed` verweist. Auch hier passt sich die Höhe automatisch an (über postMessage-Kommunikation zwischen eingebettetem Formular und TYPO3-Seite).

1. Im Admin-Bereich unter **Einbetten** den iframe-Code kopieren.
2. In TYPO3 ein HTML-Inhaltselement anlegen und den iframe-Code einfügen.
3. Speichern und im Frontend testen.

### Sicherheitshinweis für technisch Verantwortliche

Aus Sicherheitsgründen darf das Formular nicht von beliebigen Websites eingebettet werden. Nur Domains, die serverseitig in der Umgebungsvariable **`EMBED_FRAME_ANCESTORS`** freigegeben sind, dürfen es einbinden. Soll das Formular auf einer neuen Domain oder Subdomain eingebettet werden, muss diese zuerst in dieser Variable ergänzt werden – ansonsten blockiert der Browser die Einbettung.

---

## 9. Betrieb

### 9.1 E-Mail-Versand (SMTP) einrichten

Damit das System automatisch E-Mails verschickt, muss der Mailversand einmalig technisch eingerichtet werden. Ohne diese Einrichtung funktioniert das System für die Buchungsplanung normal weiter, es werden aber **keine E-Mails verschickt** – dazu gehören:

- die Eingangsbestätigung an Anfragende nach dem Absenden des öffentlichen Formulars,
- die Zu- oder Absage-E-Mail bei Bestätigung bzw. Ablehnung einer Buchung,
- die Einladungs-E-Mail an neue Mitarbeitende.

Die Einrichtung erfolgt **nicht** im Admin-Bereich, sondern im technischen Superuser-Bereich:

1. Rufen Sie `/_/` auf und melden Sie sich mit dem Superuser-Konto an.
2. Gehen Sie zu **Settings → Mail**.
3. Tragen Sie die SMTP-Zugangsdaten (Server, Port, Benutzername, Passwort, Absenderadresse) ein und speichern Sie.

Solange SMTP nicht konfiguriert ist, wird bei Einladungen ersatzweise der **Einladungslink direkt im Admin-Bereich** angezeigt, damit Sie ihn manuell weitergeben können (siehe [Abschnitt 7.4](#74-weitere-mitarbeitende-einladen)).

### 9.2 Backup

Die Daten des Systems liegen in einem **persistenten Volume** der Coolify-Umgebung, in der das System betrieben wird (SQLite-Datenbank). Eine Datensicherung erfolgt über die **Backup-Funktionen von Coolify** bzw. direkt über die Sicherung der SQLite-Datenbankdatei. Wenden Sie sich für die Einrichtung regelmäßiger Backups sowie für Wiederherstellungen an die technisch verantwortliche Person mit Zugriff auf die Coolify-Verwaltung.

### 9.3 Erststart-Checkliste

Die wichtigsten Schritte für die Inbetriebnahme in der richtigen Reihenfolge:

1. ☐ Unter `/_/` ersten Superuser anlegen.
2. ☐ Erstes Mitarbeiter-Konto anlegen (Collection „mitarbeiter“ unter `/_/` oder per Einladung).
3. ☐ SMTP unter `/_/` → **Settings → Mail** einrichten, damit Bestätigungs-, Zu-/Absage- und Einladungs-E-Mails verschickt werden.
4. ☐ Über `/admin/mitarbeiter` weitere Kolleg:innen einladen (E-Mail + Rolle wählen, Einladung senden bzw. Link weitergeben).
5. ☐ Stammdaten pflegen: Referent:innen, Themen, Einrichtungstypen, Schließtage, Räume, Angebotsarten und globale Einstellungen (Puffer, Vorlaufzeit, Verfallszeit, Öffnungstage, Team-Benachrichtigungs-E-Mail).
6. ☐ Einbettung im TYPO3 gemäß `/admin/einbetten` einrichten und die einbettende Domain in `EMBED_FRAME_ANCESTORS` freischalten.
7. ☐ Regelmäßige Backups über Coolify sicherstellen.

---

## 10. Häufige Fragen (FAQ)

**Warum kann ich eine Buchung nicht bestätigen?**
Das System blockiert die Bestätigung **hart nur dann**, wenn ein konkret **gewählter Raum** zum gewünschten Termin bereits belegt ist. In diesem Fall müssen Sie einen anderen Raum wählen oder den Termin anpassen. Bei **Unterbesetzung**, **fehlendem Raum** oder **Terminüberschneidung** werden Sie hingegen nur gewarnt und können über **„Trotzdem bestätigen“** (mit Pflicht-Grund) fortfahren. Die Buchung wird dann als „Unterbesetzt“ bzw. „Raum offen“ gekennzeichnet. Details in [Abschnitt 4.5](#45-kapazitätshandling-unterbesetzung-raum-offen-und-trotzdem-bestätigen).

**Wie lade ich Kolleg:innen ein?**
Öffnen Sie im Admin-Bereich **Mitarbeiter** (`/admin/mitarbeiter`), geben Sie E-Mail-Adresse und Rolle ein und bestätigen Sie die Einladung. Das System legt ein inaktives Konto an und zeigt den 7 Tage gültigen Einladungslink an (bei eingerichtetem SMTP zusätzlich per E-Mail). Die eingeladene Person setzt über `/admin/einladung` selbst Name und Passwort. Details in [Abschnitt 7.4](#74-weitere-mitarbeitende-einladen).

**Warum werden im Kalender keine (oder kaum) Termine angezeigt?**
Der Kalender zeigt nur tatsächlich buchbare Zeiten. Fehlen Termine, liegt das meist an einer dieser Ursachen: keine passenden Referent:innen mit dem gewählten Thema verfügbar, bei Seminaren kein freier Raum, der Tag ist ein Schließtag oder liegt außerhalb der Öffnungstage, der Termin liegt innerhalb der minimalen oder jenseits der maximalen Vorlauffrist, oder der Tag ist bereits ausgebucht. Prüfen Sie entsprechend die Verfügbarkeiten, Räume, Schließtage und die globalen Einstellungen (siehe [Abschnitt 5](#5-stammdaten-pflegen)).

**Wie binde ich das Formular in unsere Webseite ein?**
Nutzen Sie die fertigen Code-Bausteine unter **Einbetten** (`/admin/einbetten`) – empfohlen ist das Lade-Skript mit automatischer Höhenanpassung, alternativ ein iframe auf `/embed`. Fügen Sie den Code in TYPO3 als HTML-Inhaltselement ein. Für die englische Seite gibt es denselben Schnipsel mit `data-lang="en"` bzw. `/embed?lang=en`. Die einbettende Domain muss zuvor in der Umgebungsvariable `EMBED_FRAME_ANCESTORS` freigeschaltet sein. Details in [Abschnitt 8](#8-das-formular-in-die-webseite-einbetten-typo3).

---

## 11. QA-/Testmodus (nur Test-/Schulungsumgebung)

> **Achtung:** Dieses Kapitel gilt **ausschließlich** für eine Test-, Abnahme- oder Schulungsumgebung, in der der Server mit der Umgebungsvariable **`TEST_MODE`** gestartet wurde. In der **Produktivumgebung ist der Testmodus aus** – die zugehörige Seite und alle Testfunktionen sind dann gar nicht vorhanden.

Ist der Testmodus aktiv, erscheint für die Rollen **Leitung** und **Mitarbeiter** in der Seitenleiste unter „System" der zusätzliche Menüpunkt **„QA / Testmodus"** (`/admin/test`). Er bündelt Werkzeuge, mit denen sich Abläufe gefahrlos durchspielen lassen, ohne auf echte Termine warten zu müssen.

### Simuliertes „Geschäfts-Heute" (Datum & Uhrzeit)

Sie können dem System vorübergehend ein **anderes „Jetzt"** vorgeben – etwa um zu prüfen, wie sich der Kalender, der Verfall offener Anfragen oder die Freischaltung der Ist-Erfassung an einem künftigen Datum verhält.

- Ist ein Simulationsdatum aktiv, zeigt ein **amberfarbener Balken** oben das aktive Datum samt Uhrzeit an, mit einem Link **„verwalten"** zur QA-Seite.
- Auf der QA-Seite setzen Sie ein Datum bzw. eine Uhrzeit oder wählen **„Auf Echtzeit zurücksetzen"**.

### Rollen-Override (temporär eine andere Rolle testen)

Sie können vorübergehend **als Leitung, Mitarbeiter oder Auskunftsassistenz agieren**, um die jeweiligen Sichten und Rechte zu prüfen. Der Wechsel wirkt **durchgängig** – sowohl im Frontend (Menü/Sichten) als auch serverseitig (Rechteprüfungen), weil die wirksame Rolle Ihres Kontos umgeschaltet wird.

- Solange ein Override aktiv ist, erscheint ein **persistenter violetter Balken**: „Simulierte Rolle: X (echt: Y)" mit der Schaltfläche **„Zurücksetzen"**.
- Dieser Balken ist **immer erreichbar** – auch wenn Sie sich gerade als **Auskunftsassistenz** ausgeben (die den QA-Menüpunkt nicht sieht). So kommen Sie jederzeit auf Ihre echte Rolle zurück.

### Testdaten und Verfall

- **Testdaten seeden** – legt klar als Test markierte Beispieldaten (Präfix `[Test]` / `[TESTDATA]`) an.
- **Testdaten zurücksetzen** – entfernt **nur** die so markierten Testdaten; echte Daten bleiben unberührt.
- **Cron: Verfall auslösen** – stößt den Verfall abgelaufener offener Anfragen manuell an (nutzt das simulierte „Jetzt"), statt auf den nächtlichen Automatiklauf zu warten.

> **Warnung:** Diese Funktionen sind nur für Test-/Schulungszwecke gedacht. In einer produktiven Umgebung dürfen sie nicht verfügbar sein (`TEST_MODE` bleibt dort aus).