/*
 * GDW Buchung — Mount-Skript für die TYPO3-Einbettung (docs/SPEC.md §7.2).
 * Kein React, keine Abhängigkeiten. Wird per <script src=".../embed.js" defer>
 * eingebunden und erzeugt in einem Zielelement ein randloses iFrame auf
 * "<origin-des-scripts>/embed", verdrahtet postMessage-Autoresize und bietet
 * einen Fallback-Link, falls das iFrame durch Adblocker/CSP blockiert wird.
 *
 * Zielelement: <div id="gdw-buchung"></div> ODER <div data-gdw-buchung></div>
 * (auch mehrfach auf einer Seite möglich).
 *
 * Origin-Bestimmung: aus `document.currentScript.src` (bzw. Fallback-Suche im
 * DOM), NICHT hartkodiert — funktioniert dadurch unverändert lokal
 * (http://127.0.0.1:8090/embed.js), auf Staging und auf der Produktions-Domain
 * buchung.niaz.omg.lol.
 */
(function () {
  'use strict'

  function getScriptOrigin() {
    var scriptEl = document.currentScript
    if (!scriptEl) {
      // Fallback für Browser/Ladepfade ohne document.currentScript
      // (z.B. asynchrones Nachladen): letztes <script> mit "embed.js" im src.
      var scripts = document.getElementsByTagName('script')
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf('embed.js') !== -1) {
          scriptEl = scripts[i]
          break
        }
      }
    }
    if (!scriptEl || !scriptEl.src) return null
    try {
      return new URL(scriptEl.src, window.location.href).origin
    } catch (e) {
      return null
    }
  }

  // Sichtbare Chrome-Strings des Einbett-Wrappers in beiden Sprachen. Das
  // Formular im iFrame lädt seine eigene Sprache über ?lang; diese Texte
  // umgeben es nur (Ladehinweis, iFrame-Titel, Adblock-Fallback-Link).
  var TEXTS = {
    de: {
      loading: 'Formular wird geladen …',
      title: 'Führung oder Seminar buchen – Gedenkstätte Deutscher Widerstand',
      fallback: 'Formular in neuem Tab öffnen',
    },
    en: {
      loading: 'Loading form …',
      title: 'Book a guided tour or seminar – German Resistance Memorial Center',
      fallback: 'Open the form in a new tab',
    },
  }

  function langOf(target) {
    return target && target.getAttribute('data-lang') === 'en' ? 'en' : 'de'
  }

  // Baut die /embed-URL, hängt bei englischer Sprache ?lang=en an. Sprache aus
  // data-lang des Zielelements (Fallback: Standard = Deutsch, kein Param).
  function embedUrl(origin, target) {
    var url = origin + '/embed'
    if (langOf(target) === 'en') url += '?lang=en'
    return url
  }

  function mount(target, origin) {
    if (!target || target.getAttribute('data-gdw-buchung-mounted') === '1') return
    target.setAttribute('data-gdw-buchung-mounted', '1')

    var texts = TEXTS[langOf(target)]
    var src = embedUrl(origin, target)

    var wrap = document.createElement('div')
    wrap.style.position = 'relative'
    wrap.style.width = '100%'

    var loading = document.createElement('div')
    loading.textContent = texts.loading
    loading.setAttribute('role', 'status')
    loading.style.padding = '2.5rem 1rem'
    loading.style.textAlign = 'center'
    loading.style.fontFamily =
      'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    loading.style.color = '#555'
    wrap.appendChild(loading)

    var iframe = document.createElement('iframe')
    iframe.src = src
    iframe.title = texts.title
    iframe.style.width = '100%'
    iframe.style.border = '0'
    iframe.style.display = 'none'
    iframe.style.minHeight = '900px'
    iframe.setAttribute('loading', 'lazy')

    var fallbackShown = false
    var fallbackTimer = window.setTimeout(showFallback, 8000)

    iframe.addEventListener('load', function () {
      window.clearTimeout(fallbackTimer)
      loading.style.display = 'none'
      iframe.style.display = 'block'
    })
    iframe.addEventListener('error', showFallback)

    wrap.appendChild(iframe)
    target.appendChild(wrap)

    function showFallback() {
      if (fallbackShown) return
      fallbackShown = true
      window.clearTimeout(fallbackTimer)
      loading.style.display = 'none'
      iframe.style.display = 'none'

      var fallback = document.createElement('p')
      fallback.style.textAlign = 'center'
      fallback.style.fontFamily =
        'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
      var link = document.createElement('a')
      link.href = src
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = texts.fallback
      fallback.appendChild(link)
      wrap.appendChild(fallback)
    }

    // Empfänger für das Resize-postMessage aus /embed (SPEC §7.3). Der
    // Origin-Check ist Pflicht, damit nicht jede beliebige Seite die Höhe
    // dieses iFrames fernsteuern kann.
    window.addEventListener('message', function (event) {
      if (event.origin !== origin) return
      if (event.source !== iframe.contentWindow) return
      var data = event.data
      if (data && data.type === 'gdw-buchung:resize' && typeof data.height === 'number') {
        iframe.style.height = Math.max(data.height, 300) + 'px'
      }
    })
  }

  function init() {
    var origin = getScriptOrigin()
    if (!origin) return

    var targets = []
    var byId = document.getElementById('gdw-buchung')
    if (byId) targets.push(byId)
    var byAttr = document.querySelectorAll('[data-gdw-buchung]')
    for (var i = 0; i < byAttr.length; i++) {
      if (targets.indexOf(byAttr[i]) === -1) targets.push(byAttr[i])
    }

    for (var j = 0; j < targets.length; j++) {
      mount(targets[j], origin)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
