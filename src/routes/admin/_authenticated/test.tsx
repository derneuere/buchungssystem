// /admin/test — QA-/Testmodus (nur sichtbar/erreichbar, wenn der Server mit
// TEST_MODE gestartet wurde; die Route selbst existiert im Frontend immer, der
// Zugriff wird durch die 404-liefernden Test-Endpunkte natürlich begrenzt).
//
// Funktionen: simuliertes „Heute" setzen/zurücksetzen, Testdaten erzeugen und
// wieder entfernen, Verfall-Job sofort ausführen. Alle datumsabhängigen
// Ansichten (Verfügbarkeit, Dashboard, Ist-Erfassung) folgen dem simulierten
// Jetzt über useJetzt()/das Backend-jetzt().

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  Clock,
  Database,
  FlaskConical,
  Loader2,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import { testReset, testResetRolle, testSeed, testSetJetzt, testSetRolle, testVerfall } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import { useTestStatus, TEST_STATUS_KEY } from '@/lib/use-test-mode'
import { useRolle } from '@/lib/use-rolle'
import type { Rolle, TestDatenZaehler } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDeleteDialog } from '@/components/admin/shared/ConfirmDeleteDialog'

export const Route = createFileRoute('/admin/_authenticated/test')({
  component: TestModusPage,
})

function offsetText(sekunden: number): string {
  if (sekunden === 0) return 'kein Offset (Echtzeit)'
  const abs = Math.abs(sekunden)
  const tage = Math.floor(abs / 86400)
  const stunden = Math.round((abs % 86400) / 3600)
  const vorzeichen = sekunden > 0 ? '+' : '−'
  const teile: string[] = []
  if (tage) teile.push(`${tage} Tag(e)`)
  if (stunden || !tage) teile.push(`${stunden} Std.`)
  return `${vorzeichen}${teile.join(' ')}`
}

const ROLLEN: { value: Rolle; label: string }[] = [
  { value: 'leitung', label: 'Leitung' },
  { value: 'mitarbeiter', label: 'Mitarbeiter' },
  { value: 'auskunft', label: 'Auskunftsassistenz' },
]

function TestModusPage() {
  const queryClient = useQueryClient()
  const statusQuery = useTestStatus()
  const status = statusQuery.data
  const rolle = useRolle()

  const [datum, setDatum] = useState('')
  const [busy, setBusy] = useState<null | 'datum' | 'reset-uhr' | 'seed' | 'reset-daten' | 'verfall'>(null)
  const [rolleBusy, setRolleBusy] = useState(false)

  async function nachRollenwechsel() {
    // authStore muss die (neue) wirksame Rolle sehen, dann alles neu laden.
    await pb.collection('mitarbeiter').authRefresh()
    queryClient.invalidateQueries({ queryKey: TEST_STATUS_KEY })
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  async function handleSetRolle(ziel: Rolle) {
    setRolleBusy(true)
    try {
      await testSetRolle(ziel)
      await nachRollenwechsel()
      toast.success(`Simulierte Rolle: ${ROLLEN.find((r) => r.value === ziel)?.label ?? ziel}.`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Rolle konnte nicht gesetzt werden.'))
    } finally {
      setRolleBusy(false)
    }
  }

  async function handleResetRolle() {
    setRolleBusy(true)
    try {
      await testResetRolle()
      await nachRollenwechsel()
      toast.success('Auf echte Rolle zurückgesetzt.')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Zurücksetzen fehlgeschlagen.'))
    } finally {
      setRolleBusy(false)
    }
  }

  // Eingabe initial auf das simulierte Jetzt setzen (datetime-local: "YYYY-MM-DDTHH:MM").
  useEffect(() => {
    if (status?.jetzt_berlin) setDatum(status.jetzt_berlin.replace(' ', 'T'))
  }, [status?.jetzt_berlin])

  function invalidateStatus() {
    queryClient.invalidateQueries({ queryKey: TEST_STATUS_KEY })
  }
  function invalidateAdmin() {
    // Alle datumsabhängigen Admin-Ansichten neu laden.
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  async function handleDatumSetzen() {
    if (!datum) {
      toast.error('Bitte ein Datum wählen.')
      return
    }
    setBusy('datum')
    try {
      const res = await testSetJetzt({ iso: new Date(datum).toISOString() })
      toast.success(`Simuliertes Jetzt gesetzt: ${res.jetzt_berlin} Uhr (${offsetText(res.offset_sekunden)}).`)
      invalidateStatus()
      invalidateAdmin()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Datum konnte nicht gesetzt werden.'))
    } finally {
      setBusy(null)
    }
  }

  async function handleEchtzeit() {
    setBusy('reset-uhr')
    try {
      const res = await testSetJetzt({ reset: true })
      toast.success('Uhr auf Echtzeit zurückgesetzt.')
      if (res.jetzt_berlin) setDatum(res.jetzt_berlin.replace(' ', 'T'))
      invalidateStatus()
      invalidateAdmin()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Zurücksetzen fehlgeschlagen.'))
    } finally {
      setBusy(null)
    }
  }

  function zaehlerText(z: TestDatenZaehler): string {
    const teile: string[] = []
    if (z.referenten) teile.push(`${z.referenten} Referent:innen`)
    if (z.verfuegbarkeiten) teile.push(`${z.verfuegbarkeiten} Verfügbarkeiten`)
    if (z.raeume) teile.push(`${z.raeume} Räume`)
    if (z.buchungen) teile.push(`${z.buchungen} Buchungen`)
    if (z.buchung_referenten) teile.push(`${z.buchung_referenten} Zuordnungen`)
    if (z.themen) teile.push(`${z.themen} Themen`)
    return teile.join(', ') || 'keine'
  }

  async function handleSeed() {
    setBusy('seed')
    try {
      const res = await testSeed()
      if (res.bereits_vorhanden) {
        toast.info(`Testdaten bereits vorhanden (${zaehlerText(res)}). Zum Neuaufbau erst „Testdaten löschen".`)
      } else {
        toast.success(`Testdaten erzeugt: ${zaehlerText(res)}.`)
      }
      invalidateAdmin()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Testdaten konnten nicht erzeugt werden.'))
    } finally {
      setBusy(null)
    }
  }

  async function handleResetDaten() {
    setBusy('reset-daten')
    try {
      const res = await testReset()
      toast.success(`Testdaten gelöscht: ${zaehlerText(res)}.`)
      invalidateAdmin()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Testdaten konnten nicht gelöscht werden.'))
    } finally {
      setBusy(null)
    }
  }

  async function handleVerfall() {
    setBusy('verfall')
    try {
      const res = await testVerfall()
      toast.success(
        res.verfallen > 0
          ? `${res.verfallen} offene Anfrage(n) auf „verfallen" gesetzt.`
          : 'Keine Anfrage war verfallen (Cutoff nicht erreicht).',
      )
      invalidateAdmin()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Verfall-Job fehlgeschlagen.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">QA / Testmodus</h1>
          <p className="text-sm text-muted-foreground">
            Simuliertes Datum &amp; Uhrzeit steuern und Testdaten verwalten. Nur für die Erprobung — echte Daten bleiben unberührt.
          </p>
        </div>
      </div>

      {statusQuery.isLoading && <Skeleton className="h-32 w-full" />}

      {!statusQuery.isLoading && !status?.test_mode && (
        <Alert>
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Testmodus ist nicht aktiv</AlertTitle>
          <AlertDescription>
            Der Server wurde ohne <code>TEST_MODE</code> gestartet. Die Test-Endpunkte liefern 404 und die Uhr läuft in
            Echtzeit. Setzen Sie beim Start die Umgebungsvariable <code>TEST_MODE=true</code>, um diesen Bereich zu nutzen.
          </AlertDescription>
        </Alert>
      )}

      {status?.test_mode && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" /> Rolle simulieren
              </CardTitle>
              <CardDescription>
                Wirksame Rolle temporär umschalten, um alle Aktionen jeder Rolle zu testen. Der Override wirkt in
                Frontend UND Backend (Collection-Rules + Route-Guards). Zurücksetzen ist jederzeit über den violetten
                Balken oben erreichbar — auch als Auskunftsassistenz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                Aktuell wirksame Rolle:{' '}
                <span className="font-medium">{ROLLEN.find((r) => r.value === rolle)?.label ?? '—'}</span>
                {status.rolle_override_aktiv && status.qa_rolle_original && (
                  <span className="text-muted-foreground">
                    {' '}
                    (echt: {ROLLEN.find((r) => r.value === status.qa_rolle_original)?.label ?? status.qa_rolle_original})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLLEN.map((r) => (
                  <Button
                    key={r.value}
                    variant={rolle === r.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSetRolle(r.value)}
                    disabled={rolleBusy || rolle === r.value}
                  >
                    {rolleBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {r.label}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={handleResetRolle} disabled={rolleBusy || !status.rolle_override_aktiv}>
                  <RotateCcw className="h-4 w-4" />
                  Auf echte Rolle zurücksetzen
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" /> Server-Uhr
              </CardTitle>
              <CardDescription>Das „Geschäfts-Heute", auf das sich Verfügbarkeit, Verfall und Dashboard beziehen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Simuliertes Jetzt</dt>
                <dd className="font-medium">{status.jetzt_berlin} Uhr</dd>
                <dt className="text-muted-foreground">Echtzeit</dt>
                <dd>{status.echt_jetzt.replace('T', ' ').replace('Z', '').slice(0, 16)} (UTC)</dd>
                <dt className="text-muted-foreground">Offset</dt>
                <dd>
                  {status.aktiv ? (
                    <span className="font-medium text-amber-700 dark:text-amber-300">{offsetText(status.offset_sekunden)}</span>
                  ) : (
                    <span className="text-muted-foreground">{offsetText(status.offset_sekunden)}</span>
                  )}
                </dd>
              </dl>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="test-datum">Simuliertes Datum &amp; Uhrzeit</Label>
                  <Input
                    id="test-datum"
                    type="datetime-local"
                    value={datum}
                    onChange={(e) => setDatum(e.target.value)}
                    className="w-60"
                  />
                </div>
                <Button onClick={handleDatumSetzen} disabled={busy !== null}>
                  {busy === 'datum' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                  Übernehmen
                </Button>
                <Button variant="outline" onClick={handleEchtzeit} disabled={busy !== null}>
                  {busy === 'reset-uhr' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Auf Echtzeit zurücksetzen
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Datum und Uhrzeit werden exakt übernommen; die Uhr läuft ab dem gesetzten Zeitpunkt normal weiter.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4" /> Testdaten
              </CardTitle>
              <CardDescription>
                Erzeugt Referent:innen (mit Verfügbarkeiten), Räume und Buchungen über alle Status — relativ zum simulierten
                Jetzt. Alle sind als <code>[Test]</code> / <code>[TESTDATA]</code> markiert; „Löschen" entfernt ausschließlich diese.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={handleSeed} disabled={busy !== null}>
                {busy === 'seed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Testdaten erzeugen
              </Button>
              <ConfirmDeleteDialog
                trigger={
                  <Button variant="outline" disabled={busy !== null}>
                    {busy === 'reset-daten' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Testdaten löschen
                  </Button>
                }
                title="Alle Testdaten löschen?"
                description="Entfernt nur die markierten [Test]-/[TESTDATA]-Datensätze. Echte Daten bleiben erhalten."
                onConfirm={handleResetDaten}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4" /> Cron: Verfall
              </CardTitle>
              <CardDescription>
                Führt den Verfall-Job sofort mit dem simulierten Jetzt aus. Tipp: Datum weit genug vorstellen (mehr als
                <code> anfrage_verfall_stunden</code>), dann verfallen offene Anfragen prüfbar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleVerfall} disabled={busy !== null}>
                {busy === 'verfall' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                Verfall jetzt ausführen
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
