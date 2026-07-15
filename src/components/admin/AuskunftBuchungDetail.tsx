// Schlanke Buchungs-Detailansicht für die Auskunftsassistenz (Schalter).
// Datenquelle ausschließlich die projizierende Route GET /api/auskunft/buchungen/{id}
// (keine E-Mail, Herkunft, Nachricht, Notizen, Planung). Erlaubt zusätzlich die
// Ist-Erfassung (eingesetzt-Häkchen, teilnehmer_ist, durchgeführt) über die
// feld-whitelistende Route POST /api/admin/buchungen/{id}/ist.

import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Phone, TriangleAlert, Lock } from 'lucide-react'
import { toast } from 'sonner'

import { auskunftBuchung, adminIstErfassung } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import { formatDate, formatZeitraum, tagKey } from '@/lib/admin-format'
import { useJetzt } from '@/lib/use-test-mode'
import type { AuskunftReferent } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { cn } from '@/lib/utils'

export function AuskunftBuchungDetail({ id }: { id: string }) {
  const jetztDate = useJetzt()
  const queryKey = ['admin', 'auskunft', 'buchung', id]

  const query = useQuery({
    queryKey,
    queryFn: () => auskunftBuchung(id),
  })

  const buchung = query.data
  const [teilnehmerIst, setTeilnehmerIst] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [savingTn, setSavingTn] = useState(false)
  const [markingDf, setMarkingDf] = useState(false)

  useEffect(() => {
    if (buchung) setTeilnehmerIst(String(buchung.teilnehmer_ist || buchung.teilnehmer_geplant))
  }, [buchung])

  function refetch() {
    void query.refetch()
  }

  async function handleToggle(z: AuskunftReferent, next: boolean) {
    setTogglingId(z.zuordnung_id)
    try {
      await adminIstErfassung(id, { eingesetzt: [{ zuordnung_id: z.zuordnung_id, eingesetzt: next }] })
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setTogglingId(null)
    }
  }

  async function handleSaveTn(durchgefuehrt?: boolean) {
    const wert = Number(teilnehmerIst)
    if (!Number.isFinite(wert) || wert < 0) {
      toast.error('Bitte eine gültige Teilnehmerzahl (Ist) angeben.')
      return
    }
    const setBusy = durchgefuehrt ? setMarkingDf : setSavingTn
    setBusy(true)
    try {
      await adminIstErfassung(id, { teilnehmer_ist: wert, ...(durchgefuehrt ? { durchgefuehrt: true } : {}) })
      toast.success(durchgefuehrt ? 'Buchung als durchgeführt markiert.' : 'Ist-Teilnehmerzahl gespeichert.')
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleNiemand() {
    setMarkingDf(true)
    try {
      await adminIstErfassung(id, {
        teilnehmer_ist: 0,
        durchgefuehrt: true,
        eingesetzt: (buchung?.referenten ?? []).map((z) => ({ zuordnung_id: z.zuordnung_id, eingesetzt: false })),
      })
      setTeilnehmerIst('0')
      toast.success('Als „niemand erschienen" erfasst.')
      refetch()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setMarkingDf(false)
    }
  }

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (query.isError || !buchung) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Buchung nicht gefunden</AlertTitle>
        <AlertDescription>{getErrorMessage(query.error, 'Die Buchung konnte nicht geladen werden.')}</AlertDescription>
      </Alert>
    )
  }

  const gesperrt = !(buchung.status === 'durchgefuehrt' || tagKey(jetztDate) >= tagKey(buchung.start))

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/admin/buchungen">
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Liste
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{buchung.kontakt_name}</h1>
          <StatusBadge status={buchung.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {buchung.angebotsart || '–'} · {buchung.thema || '–'} · {formatZeitraum(buchung.start, buchung.ende)}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Termindaten</CardTitle>
            <CardDescription>Angaben für die Auskunft am Schalter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Angebotsart</dt>
              <dd>{buchung.angebotsart || '–'}</dd>
              <dt className="text-muted-foreground">Thema</dt>
              <dd>{buchung.thema || '–'}</dd>
              <dt className="text-muted-foreground">Termin</dt>
              <dd>{formatZeitraum(buchung.start, buchung.ende)}</dd>
              <dt className="text-muted-foreground">Raum</dt>
              <dd>{buchung.raum || '– (noch nicht vergeben)'}</dd>
              <dt className="text-muted-foreground">Gruppengröße</dt>
              <dd>
                {buchung.teilnehmer_geplant} Personen
                {buchung.teilnehmer_ist ? ` (Ist: ${buchung.teilnehmer_ist})` : ''}
              </dd>
            </dl>
            <Separator />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Kontakt</dt>
              <dd>{buchung.kontakt_name}</dd>
              <dt className="text-muted-foreground">Telefon</dt>
              <dd>
                {buchung.kontakt_telefon ? (
                  <a href={`tel:${buchung.kontakt_telefon}`} className="inline-flex items-center gap-1 underline underline-offset-2">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {buchung.kontakt_telefon}
                  </a>
                ) : (
                  '–'
                )}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referent:innen</CardTitle>
            <CardDescription>Zugewiesene Personen mit Telefonnummer</CardDescription>
          </CardHeader>
          <CardContent>
            {buchung.referenten.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Referent:innen zugewiesen.</p>
            ) : (
              <ul className="space-y-2">
                {buchung.referenten.map((z) => (
                  <li key={z.zuordnung_id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{z.referent.name || 'Unbekannt'}</div>
                      <div className="text-xs text-muted-foreground">
                        {z.referent.telefon ? (
                          <a href={`tel:${z.referent.telefon}`} className="inline-flex items-center gap-1 underline underline-offset-2">
                            <Phone className="h-3 w-3" aria-hidden="true" />
                            {z.referent.telefon}
                          </a>
                        ) : (
                          'keine Telefonnummer'
                        )}
                      </div>
                    </div>
                    {z.eingesetzt && <StatusBadge status="durchgefuehrt" />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={cn(gesperrt && 'border-dashed')}>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Ist-Erfassung</CardTitle>
            <CardDescription>
              Wer war tatsächlich im Einsatz? Wie viele Personen sind erschienen? Ab Termindatum ausfüllbar.
            </CardDescription>
          </div>
          {gesperrt && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Gesperrt
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {gesperrt && (
            <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Die Ist-Erfassung wird ab dem Termindatum ({formatDate(buchung.start)}) freigeschaltet.
              </span>
            </div>
          )}
          <fieldset
            disabled={gesperrt}
            className={cn('m-0 min-w-0 space-y-4 border-0 p-0', gesperrt && 'pointer-events-none opacity-60')}
          >
            {buchung.referenten.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine Referent:innen zugewiesen.</p>
            )}
            <ul className="space-y-2">
              {buchung.referenten.map((z) => (
                <li key={z.zuordnung_id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Checkbox
                    id={`eingesetzt-${z.zuordnung_id}`}
                    checked={z.eingesetzt}
                    disabled={togglingId === z.zuordnung_id}
                    onCheckedChange={(v) => handleToggle(z, v === true)}
                  />
                  <Label htmlFor={`eingesetzt-${z.zuordnung_id}`} className="flex-1 cursor-pointer font-normal">
                    {z.referent.name || 'Unbekannt'}
                    {!z.geplant && <span className="ml-2 text-xs text-muted-foreground">(nicht geplant)</span>}
                  </Label>
                  {togglingId === z.zuordnung_id && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-end gap-3 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="teilnehmer-ist">Teilnehmer:innen (Ist)</Label>
                <Input
                  id="teilnehmer-ist"
                  type="number"
                  min={0}
                  value={teilnehmerIst}
                  onChange={(e) => setTeilnehmerIst(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button type="button" variant="outline" onClick={() => handleSaveTn()} disabled={savingTn}>
                {savingTn && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Speichern
              </Button>
              {buchung.status !== 'durchgefuehrt' && (
                <>
                  <Button type="button" onClick={() => handleSaveTn(true)} disabled={markingDf}>
                    {markingDf && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Als durchgeführt markieren
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleNiemand} disabled={markingDf}>
                    Niemand erschienen
                  </Button>
                </>
              )}
            </div>
          </fieldset>
        </CardContent>
      </Card>
    </div>
  )
}
