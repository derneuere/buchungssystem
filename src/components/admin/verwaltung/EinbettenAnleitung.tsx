// Verwaltungs-Tab „Einbetten" — Hinweise + kopierbare Snippets, um das
// öffentliche Buchungsformular in die TYPO3-Webseite einzubinden.

import { Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

function origin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return 'https://buchung.niaz.omg.lol'
}

async function kopieren(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('In die Zwischenablage kopiert.')
  } catch {
    toast.error('Kopieren nicht möglich – bitte manuell markieren.')
  }
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border bg-muted/50 p-3 pr-12 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1.5 top-1.5"
        aria-label="Kopieren"
        onClick={() => kopieren(code)}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function EinbettenAnleitung() {
  const base = origin()
  const loaderSnippet = `<div data-gdw-buchung></div>\n<script src="${base}/embed.js" async></script>`
  const loaderSnippetEn = `<div data-gdw-buchung data-lang="en"></div>\n<script src="${base}/embed.js" async></script>`
  const iframeSnippet = `<iframe id="gdw-buchung-iframe"\n  src="${base}/embed"\n  title="Führung oder Seminar buchen – Gedenkstätte Deutscher Widerstand"\n  style="width:100%;border:0;min-height:900px;display:block;"\n  loading="lazy"></iframe>\n<script>\n  window.addEventListener("message", function (e) {\n    if (e.origin !== "${base}") return;\n    if (e.data && e.data.type === "gdw-buchung:resize") {\n      var f = document.getElementById("gdw-buchung-iframe");\n      if (f) f.style.height = e.data.height + "px";\n    }\n  });\n</script>`
  const iframeSnippetEn = `<iframe id="gdw-buchung-iframe"\n  src="${base}/embed?lang=en"\n  title="Book a guided tour or seminar – German Resistance Memorial Center"\n  style="width:100%;border:0;min-height:900px;display:block;"\n  loading="lazy"></iframe>\n<script>\n  window.addEventListener("message", function (e) {\n    if (e.origin !== "${base}") return;\n    if (e.data && e.data.type === "gdw-buchung:resize") {\n      var f = document.getElementById("gdw-buchung-iframe");\n      if (f) f.style.height = e.data.height + "px";\n    }\n  });\n</script>`

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">
        So binden Sie das öffentliche Buchungsformular in die TYPO3-Seite der Gedenkstätte ein.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Empfohlen: Lade-Skript (Auto-Höhe)</CardTitle>
          <CardDescription>
            Zwei Zeilen in ein HTML-Inhaltselement einfügen. Das Skript erzeugt ein passendes iframe und passt die Höhe
            automatisch an. Änderungen erfolgen serverseitig – das Snippet bleibt gleich.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Deutsch (Standard)</p>
            <CodeBlock code={loaderSnippet} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Englisch (English)</p>
            <CodeBlock code={loaderSnippetEn} />
            <p className="text-xs text-muted-foreground">
              Über <code>data-lang="en"</code> lädt das Formular auf Englisch.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alternative: reines iframe</CardTitle>
          <CardDescription>
            Ohne externes Skript – volle Style-Isolation. Die Höhe wird per <code>postMessage</code> angepasst
            (Empfänger prüft den Origin).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Deutsch (Standard)</p>
            <CodeBlock code={iframeSnippet} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Englisch (English)</p>
            <CodeBlock code={iframeSnippetEn} />
            <p className="text-xs text-muted-foreground">
              Englische Variante über <code>?lang=en</code> in der iframe-Adresse.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vorschau &amp; Ziel-Adressen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-1">
            <p className="font-medium">Eingebettetes Formular (chromelos)</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <a
                href={`${base}/embed`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium underline"
              >
                DE: {base}/embed <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={`${base}/embed?lang=en`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium underline"
              >
                EN: {base}/embed?lang=en <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Eigenständige Seite (zum Teilen/QR)</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <a
                href={`${base}/`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium underline"
              >
                DE: {base}/ <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={`${base}/?lang=en`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium underline"
              >
                EN: {base}/?lang=en <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Wichtig: erlaubte Domains freischalten</AlertTitle>
        <AlertDescription>
          Aus Sicherheitsgründen darf das Formular nur von freigeschalteten Domains eingebettet werden. Die
          TYPO3-Domain(s) der Gedenkstätte müssen in der Server-Umgebungsvariable{' '}
          <code>EMBED_FRAME_ANCESTORS</code> (durch Leerzeichen getrennt) hinterlegt sein. Bei Fragen an die technische
          Betreuung wenden.
        </AlertDescription>
      </Alert>
    </div>
  )
}
