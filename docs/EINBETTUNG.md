# Einbettung in die TYPO3-Webseite

Das Buchungstool läuft eigenständig unter **`https://buchung.niaz.omg.lol`** (SPA + API +
Admin in einem Container). Für die öffentliche Webseite der Gedenkstätte gibt es zwei Wege,
das Buchungsformular einzubinden — ein **schneller** (Copy-&-Paste, sofort einsetzbar) und ein
**technisch sauberer** (wartbar, isoliert, auto-resizend). Beide nutzen denselben
Embed-Modus der App: die Route **`/buchen?embed=1`** rendert nur das Formular — ohne
App-Navigation, mit transparentem Hintergrund — und meldet ihre Höhe per `postMessage` an die
einbettende Seite.

---

## Option A — Schnell: iframe-Snippet (5 Minuten)

Im TYPO3-Backend ein Inhaltselement vom Typ **„Reiner Text / HTML"** (`text/html`) an der
gewünschten Stelle anlegen und einfügen:

```html
<iframe
  src="https://buchung.niaz.omg.lol/buchen?embed=1"
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

`embed.js` erzeugt in jedem `[data-gdw-buchung]`-Container automatisch ein randloses,
100 % breites iframe auf `/buchen?embed=1` und wächst/schrumpft es per `postMessage`
exakt auf die Inhaltshöhe mit (kein Innen-Scrollen, kein fester Wert).

**Vorteile:**
- **Wartbar:** Änderungen (URL, Verhalten, Styling des Rahmens) passieren im Skript auf dem
  Server — das TYPO3-Snippet bleibt für immer gleich, kein erneutes Einpflegen nötig.
- **Isoliert:** weiterhin iframe-basiert → keine CSS-/JS-Kollision mit dem TYPO3-Theme.
- **Auto-Resize:** dynamische Höhe je Formularschritt.
- **Mehrfach nutzbar:** beliebig viele Container pro Seite möglich.

### Verhalten von `embed.js` (Referenz)

- Sucht alle Elemente mit Attribut `data-gdw-buchung`.
- Erlaubt Overrides per Data-Attribut: `data-route="/buchen"`, `data-params="angebot=fuehrung"`.
- Hört auf `message`-Events vom App-Origin (`https://buchung.niaz.omg.lol`) mit
  `{ type: "gdw:height", value: <px> }` und setzt die iframe-Höhe. Andere Origins werden
  ignoriert (Sicherheit).
- Der Embed-Modus der App sendet die Höhe bei Mount, bei jedem Schritt-/Größenwechsel
  (ResizeObserver) und nach Fensterresize.

> Vollständiger Quelltext des Loaders: siehe [`public/embed.js`](../public/embed.js) im Repo.
> Er wird beim Build unverändert nach `pb_public/embed.js` kopiert und same-origin ausgeliefert.

---

## Option C — Am integriertesten: eigenes TYPO3-Content-Element (Fluid)

Wer es „first class" in TYPO3 haben will (Redakteure wählen ein Element „Buchung" im
Wizard, statt HTML zu pflegen), legt eine kleine Site-Extension an mit einem Content-Element,
dessen Fluid-Template exakt das Snippet aus Option B rendert:

```html
<!-- EXT:gdw_buchung/Resources/Private/Templates/ContentElements/Buchung.html -->
<div data-gdw-buchung
     data-route="{data.tx_gdwbuchung_route}"
     data-params="{data.tx_gdwbuchung_params}"></div>
<script src="https://buchung.niaz.omg.lol/embed.js" async></script>
```

Registrierung via `TCA`/`PageTSconfig` (neuer CType `gdwbuchung_form`) + `TypoScript` für das
Rendering. **Aufwand:** ~½ Tag Extension-Setup. **Nutzen:** saubere Redaktions-UX, konfigurierbar
pro Seite (z. B. Angebotsart vorbelegen), versionierbar im TYPO3-Repo.

---

## Empfehlung

| Bedarf | Lösung |
|---|---|
| Sofort live, minimaler Aufwand | **Option A** (iframe) |
| Dauerhafter, wartbarer Standard | **Option B** (`embed.js`) — empfohlen |
| Voll integrierte Redaktions-UX | **Option C** (TYPO3-Content-Element), aufbauend auf B |

Start mit **Option B**: einmal die zwei Zeilen einpflegen, danach alles serverseitig steuerbar.
Option A dient als Fallback/Schnellstart, Option C als späterer Ausbau ohne Bruch (dasselbe
`embed.js`).

## Voraussetzungen / Betrieb

- **CORS/Framing:** Die App setzt bewusst *keine* restriktive `X-Frame-Options`/`frame-ancestors`
  auf `/buchen`, damit die Gedenkstätten-Domain framen darf. Der Rest der App (`/admin`, `/_/`)
  bleibt geschützt. Konkret wird `Content-Security-Policy: frame-ancestors` auf die
  TYPO3-Produktionsdomain(s) + `self` beschränkt (in der PocketBase-Middleware konfigurierbar).
- **Datenschutz:** Der Embed lädt nur das Formular; es werden keine Drittanbieter-Skripte oder
  Tracker eingebettet. Übermittlung ausschließlich an `buchung.niaz.omg.lol` (same-origin zur App).
