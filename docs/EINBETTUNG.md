# Einbettung in die TYPO3-Webseite

Das Buchungstool läuft eigenständig unter **`https://buchung.niaz.omg.lol`** (SPA + API +
Admin in einem Container). Für die öffentliche Webseite der Gedenkstätte gibt es zwei Wege,
das Buchungsformular einzubinden — ein **schneller** (Copy-&-Paste, sofort einsetzbar) und ein
**technisch sauberer** (wartbar, isoliert, auto-resizend). Beide nutzen dieselbe
chromelose Formular-Route der App: **`/embed`** rendert nur das Formular — ohne
App-Navigation, mit transparentem Hintergrund — und meldet seine Höhe per `postMessage` an die
einbettende Seite.

> **Fertige Schnipsel gibt es im Admin-Panel.** Unter **Einbetten** (`/admin/einbetten`) erzeugt
> das System die kopierfertigen Code-Bausteine für **Deutsch und Englisch** – der Redakteur muss
> nichts von Hand zusammenbauen. Dieses Dokument erklärt die Hintergründe und die Optionen.

---

## Option A — Schnell: iframe-Snippet (5 Minuten)

Im TYPO3-Backend ein Inhaltselement vom Typ **„Reiner Text / HTML"** (`text/html`) an der
gewünschten Stelle anlegen und einfügen:

```html
<iframe
  src="https://buchung.niaz.omg.lol/embed"
  title="Buchung – Gedenkstätte Deutscher Widerstand"
  style="width:100%; border:0; min-height:1100px; display:block;"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"></iframe>
```

**Vorteile:** sofort einsatzbereit, vollständige CSS-Isolation (das iframe schottet die
App-Styles komplett von TYPO3 ab, kein Klassen-/Reset-Konflikt).
**Nachteil:** feste Mindesthöhe; bei sehr langen Formularschritten kann innen gescrollt
werden müssen. Das behebt Option B (Auto-Resize).

---

## Option B — Sauber (empfohlen): `embed.js`-Loader mit Auto-Resize

Die App liefert unter `https://buchung.niaz.omg.lol/embed.js` ein kleines Loader-Skript aus.
Der Redakteur fügt **nur diese zwei Zeilen** in ein HTML-Inhaltselement ein:

```html
<div data-gdw-buchung></div>
<script src="https://buchung.niaz.omg.lol/embed.js" async></script>
```

`embed.js` erzeugt in jedem `[data-gdw-buchung]`-Container (alternativ in einem Element mit
`id="gdw-buchung"`) automatisch ein randloses, 100 % breites iframe auf `/embed` und
wächst/schrumpft es per `postMessage` exakt auf die Inhaltshöhe mit (kein Innen-Scrollen, kein
fester Wert). Bleibt das iframe (z. B. durch Adblocker/CSP) aus, zeigt der Loader einen
Fallback-Link „Formular in neuem Tab öffnen".

**Vorteile:**
- **Wartbar:** Änderungen (URL, Verhalten, Styling des Rahmens) passieren im Skript auf dem
  Server — das TYPO3-Snippet bleibt für immer gleich, kein erneutes Einpflegen nötig.
- **Isoliert:** weiterhin iframe-basiert → keine CSS-/JS-Kollision mit dem TYPO3-Theme.
- **Auto-Resize:** dynamische Höhe je Formularschritt.
- **Mehrfach nutzbar:** beliebig viele Container pro Seite möglich.

### Verhalten von `embed.js` (Referenz)

- Sucht das Element mit `id="gdw-buchung"` sowie **alle** Elemente mit Attribut
  `data-gdw-buchung` und montiert in jedes ein iframe.
- **Einziges** unterstütztes Konfigurations-Attribut ist **`data-lang`** (`"en"` schaltet auf
  Englisch, siehe unten). Es gibt **kein** `data-route` und **kein** `data-params` — die
  Ziel-Route ist fest `/embed` (bzw. `/embed?lang=en`).
- Bestimmt den App-Origin **aus dem `src` des eigenen `<script>`-Tags** (nicht hartkodiert).
  Dadurch funktioniert dasselbe Skript unverändert lokal
  (`http://127.0.0.1:8090/embed.js`), auf Staging und auf der Produktions-Domain.
- Hört auf `message`-Events und akzeptiert **nur** solche vom App-Origin **und** vom eigenen
  iframe-Fenster. Erwartet wird die Nachricht
  `{ type: "gdw-buchung:resize", height: <px> }`; darauf setzt es die iframe-Höhe
  (mindestens 300 px). Nachrichten anderer Herkunft werden ignoriert (Sicherheit).
- Der Embed-Modus der App sendet die Höhe bei Mount, bei jedem Schritt-/Größenwechsel
  (ResizeObserver) und nach Fensterresize.

> Vollständiger Quelltext des Loaders: siehe [`public/embed.js`](../public/embed.js) im Repo.
> Er wird beim Build unverändert nach `pb_public/embed.js` kopiert und same-origin ausgeliefert.

---

## Sprache: Deutsch oder Englisch

Das öffentliche Formular ist zweisprachig. Standard ist **Deutsch**; für die englische Seite der
Gedenkstätte (`/en/`) lässt sich **Englisch pro Einbettung** wählen — dann bekommt die englische
Webseite ihren eigenen Einbett-Schnipsel:

- **Loader (Option B/C):** am Container `data-lang="en"` ergänzen:
  ```html
  <div data-gdw-buchung data-lang="en"></div>
  <script src="https://buchung.niaz.omg.lol/embed.js" async></script>
  ```
  Der Loader bindet dann automatisch `/embed?lang=en` ein.
- **iframe (Option A):** `?lang=en` an die iframe-URL anhängen:
  ```html
  <iframe src="https://buchung.niaz.omg.lol/embed?lang=en" …></iframe>
  ```

Ohne Angabe bleibt alles Deutsch (keine Änderung für bestehende Einbettungen). Fertige Snippets
für **beide** Sprachen stehen im Admin-Panel unter **Einbetten** zum Kopieren bereit. Themen-,
Angebots- und Einrichtungstyp-Namen erscheinen englisch, sobald im Admin ein englischer Name
hinterlegt wurde — sonst greift der deutsche Fallback.

---

## Option C — Am integriertesten: eigenes TYPO3-Content-Element (Fluid)

Wer es „first class" in TYPO3 haben will (Redakteure wählen ein Element „Buchung" im
Wizard, statt HTML zu pflegen), legt eine kleine Site-Extension an mit einem Content-Element,
dessen Fluid-Template exakt das Snippet aus Option B rendert. Da `embed.js` nur `data-lang`
kennt, beschränkt sich die Konfiguration auf die Sprachwahl (z. B. über ein Auswahlfeld im
Content-Element, das entweder `de` oder `en` liefert):

```html
<!-- EXT:gdw_buchung/Resources/Private/Templates/ContentElements/Buchung.html -->
<f:comment>data-lang nur setzen, wenn Englisch gewünscht ist.</f:comment>
<div data-gdw-buchung
     data-lang="{data.tx_gdwbuchung_lang}"></div>
<script src="https://buchung.niaz.omg.lol/embed.js" async></script>
```

Registrierung via `TCA`/`PageTSconfig` (neuer CType `gdwbuchung_form`) + `TypoScript` für das
Rendering. **Aufwand:** ~½ Tag Extension-Setup. **Nutzen:** saubere Redaktions-UX, versionierbar
im TYPO3-Repo. Eine Vorbelegung von Angebotsart o. Ä. ist über den Loader **nicht** vorgesehen;
das Formular startet immer beim ersten Schritt.

---

## Empfehlung

| Bedarf | Lösung |
|---|---|
| Sofort live, minimaler Aufwand | **Option A** (iframe auf `/embed`) |
| Dauerhafter, wartbarer Standard | **Option B** (`embed.js`-Loader) — empfohlen |
| Voll integrierte Redaktions-UX | **Option C** (TYPO3-Content-Element), aufbauend auf B |

Start mit **Option B**: einmal die zwei Zeilen einpflegen, danach alles serverseitig steuerbar.
Option A dient als Fallback/Schnellstart, Option C als späterer Ausbau ohne Bruch (dasselbe
`embed.js`). Die passenden DE-/EN-Schnipsel liefert das Admin-Panel unter **Einbetten**.

## Voraussetzungen / Betrieb

- **Framing / CSP:** Die App erlaubt das Einbetten nur für ausdrücklich freigegebene Domains.
  Über die Umgebungsvariable **`EMBED_FRAME_ANCESTORS`** werden die erlaubten Hosts gesetzt; die
  Middleware setzt daraus `Content-Security-Policy: frame-ancestors 'self' <freigegebene
  Domains>`. Ist die einbettende TYPO3-Domain dort nicht eingetragen, blockiert der Browser die
  Einbettung. Der Rest der App (`/admin`, `/_/`) bleibt unabhängig davon geschützt.
- **Kein CORS nötig:** Die API-Aufrufe des Formulars laufen same-origin **innerhalb** des iframes
  (gegen `buchung.niaz.omg.lol`), nicht gegen die TYPO3-Domain.
- **Origin-Sicherheit beim Auto-Resize:** `embed.js` akzeptiert Resize-Nachrichten nur vom
  App-Origin (aus dem eigenen Script-`src` abgeleitet) und nur vom eigenen iframe — keine fremde
  Seite kann die Höhe fernsteuern.
- **Datenschutz:** Der Embed lädt nur das Formular; es werden keine Drittanbieter-Skripte oder
  Tracker eingebettet. Übermittlung ausschließlich an `buchung.niaz.omg.lol` (same-origin zur App).

> **Referenz-Wahrheit:** Die technische Spezifikation der Einbettung (Routen, postMessage-Format
> `gdw-buchung:resize`) steht in `docs/SPEC.md` §7. Bei Abweichungen gilt SPEC §7 zusammen mit dem
> tatsächlichen Quelltext `public/embed.js`.
