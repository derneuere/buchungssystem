// /admin/buchungen/$id — Buchungsdetail (SPEC §5.3, Kernscreen):
// (a) read-only Buchungsdaten, (b) Referenten-Planung, (c) Ist-Erfassung.

import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Buchung } from '@/lib/types'
import { bundeslandLabel, formatDate, formatZeitraum, tagKey } from '@/lib/admin-format'
import { getErrorMessage } from '@/lib/admin-errors'
import { useJetzt } from '@/lib/use-test-mode'
import { istAuskunft, useRolle } from '@/lib/use-rolle'
import { AuskunftBuchungDetail } from '@/components/admin/buchungen/AuskunftBuchungDetail'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { StatusBadge } from '@/components/admin/shared/StatusBadge'
import { BestaetigenDialog } from '@/components/admin/buchungen/BestaetigenDialog'
import { AblehnenDialog } from '@/components/admin/buchungen/AblehnenDialog'
import { StornierenDialog } from '@/components/admin/buchungen/StornierenDialog'
import { BuchungReferentenPlanung } from '@/components/admin/buchungen/BuchungReferentenPlanung'
import { BuchungIstErfassung } from '@/components/admin/buchungen/BuchungIstErfassung'

export const Route = createFileRoute('/admin/_authenticated/buchungen/$id')({
  component: BuchungDetailPage,
})

function BuchungDetailPage() {
  const { id } = Route.useParams()
  const rolle = useRolle()
  if (istAuskunft(rolle)) {
    return <AuskunftBuchungDetail id={id} />
  }
  return <PersonalBuchungDetail id={id} />
}

function PersonalBuchungDetail({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const buchungKey = ['admin', 'buchung', id]
  const [statusBusy, setStatusBusy] = useState(false)
  const jetztDate = useJetzt()

  const buchungQuery = useQuery({
    queryKey: buchungKey,
    queryFn: () =>
      pb.collection('buchungen').getOne<Buchung>(id, {
        expand: 'angebotsart,thema,raum,herkunft_einrichtungstyp',
      }),
  })

  function invalidateAlles() {
    queryClient.invalidateQueries({ queryKey: buchungKey })
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'buchungen', 'liste'] })
  }

  async function setStatus(neu: 'warteliste' | 'angefragt') {
    setStatusBusy(true)
    try {
      await pb.collection('buchungen').update(id, { status: neu })
      toast.success(neu === 'warteliste' ? 'Auf Warteliste gesetzt.' : 'Wieder als Anfrage geführt.')
      invalidateAlles()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Statusänderung fehlgeschlagen.'))
    } finally {
      setStatusBusy(false)
    }
  }

  if (buchungQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (buchungQuery.isError || !buchungQuery.data) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Buchung nicht gefunden</AlertTitle>
        <AlertDescription>{getErrorMessage(buchungQuery.error, 'Die Buchung konnte nicht geladen werden.')}</AlertDescription>
      </Alert>
    )
  }

  const buchung = buchungQuery.data
  const angebotsart = buchung.expand?.angebotsart
  // Ist-Erfassung ab dem Termin-TAG freischalten (nicht erst ab der Uhrzeit),
  // damit auch am selben Tag bequem nachbearbeitet werden kann.
  const istErfassungSichtbar =
    buchung.status === 'durchgefuehrt' || tagKey(jetztDate) >= tagKey(buchung.start)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
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
            {buchung.unterbesetzt && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              >
                Unterbesetzt
              </Badge>
            )}
            {buchung.raum_offen && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
              >
                Raum offen
              </Badge>
            )}
            {buchung.spam_verdacht && (
              <span className="text-xs font-medium text-destructive">Spam-Verdacht</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {angebotsart?.name ?? '–'} · {buchung.expand?.thema?.name ?? '–'} · {formatZeitraum(buchung.start, buchung.ende)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(buchung.status === 'angefragt' || buchung.status === 'warteliste') && (
            <>
              <BestaetigenDialog
                buchungId={buchung.id}
                benoetigtRaum={angebotsart?.benoetigt_raum ?? false}
                trigger={
                  <Button className="bg-emerald-600 text-white hover:bg-emerald-700">Bestätigen</Button>
                }
                onSuccess={invalidateAlles}
              />
              <AblehnenDialog
                buchungId={buchung.id}
                trigger={<Button variant="outline">Ablehnen</Button>}
                onSuccess={invalidateAlles}
              />
              {buchung.status === 'angefragt' ? (
                <Button variant="outline" onClick={() => void setStatus('warteliste')} disabled={statusBusy}>
                  Auf Warteliste
                </Button>
              ) : (
                <Button variant="outline" onClick={() => void setStatus('angefragt')} disabled={statusBusy}>
                  Wieder als Anfrage
                </Button>
              )}
            </>
          )}
          {buchung.status === 'bestaetigt' && (
            <StornierenDialog
              buchungId={buchung.id}
              trigger={<Button variant="destructive">Stornieren</Button>}
              onSuccess={invalidateAlles}
            />
          )}
        </div>
      </div>

      {buchung.ablehnungs_grund && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Ablehnungsgrund</AlertTitle>
          <AlertDescription>{buchung.ablehnungs_grund}</AlertDescription>
        </Alert>
      )}
      {buchung.storno_grund && (
        <Alert>
          <AlertTitle>Stornogrund</AlertTitle>
          <AlertDescription>{buchung.storno_grund}</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buchungsdaten</CardTitle>
            <CardDescription>Angaben aus der Anfrage — schreibgeschützt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Angebotsart</dt>
              <dd>{angebotsart?.name ?? '–'}</dd>
              <dt className="text-muted-foreground">Thema</dt>
              <dd>{buchung.expand?.thema?.name ?? '–'}</dd>
              <dt className="text-muted-foreground">Termin</dt>
              <dd>{formatZeitraum(buchung.start, buchung.ende)}</dd>
              <dt className="text-muted-foreground">Raum</dt>
              <dd>{buchung.expand?.raum?.name ?? '– (noch nicht vergeben)'}</dd>
              <dt className="text-muted-foreground">Gruppengröße</dt>
              <dd>{buchung.teilnehmer_geplant} Personen</dd>
              <dt className="text-muted-foreground">Angefragt am</dt>
              <dd>{formatDate(buchung.created)}</dd>
            </dl>
            <Separator />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Herkunft</dt>
              <dd>
                {buchung.herkunft_ort ? `${buchung.herkunft_ort}, ` : ''}
                {buchung.herkunft_land}
                {buchung.herkunft_bundesland ? ` (${bundeslandLabel(buchung.herkunft_bundesland)})` : ''}
              </dd>
              <dt className="text-muted-foreground">Einrichtung</dt>
              <dd>
                {buchung.herkunft_einrichtungsname || '–'}
                {buchung.expand?.herkunft_einrichtungstyp
                  ? ` (${buchung.expand.herkunft_einrichtungstyp.name})`
                  : ''}
              </dd>
            </dl>
            <Separator />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Kontakt</dt>
              <dd>{buchung.kontakt_name}</dd>
              <dt className="text-muted-foreground">E-Mail</dt>
              <dd>
                <a href={`mailto:${buchung.kontakt_email}`} className="underline underline-offset-2">
                  {buchung.kontakt_email}
                </a>
              </dd>
              <dt className="text-muted-foreground">Telefon</dt>
              <dd>{buchung.kontakt_telefon || '–'}</dd>
            </dl>
            {buchung.nachricht && (
              <>
                <Separator />
                <div>
                  <p className="mb-1 text-muted-foreground">Nachricht</p>
                  <p className="whitespace-pre-wrap">{buchung.nachricht}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <BuchungReferentenPlanung buchung={buchung} />
      </div>

      <BuchungIstErfassung
        buchung={buchung}
        onChanged={invalidateAlles}
        gesperrt={!istErfassungSichtbar}
        terminDatum={formatDate(buchung.start)}
      />

      <NotizenCard buchung={buchung} onSaved={invalidateAlles} />
    </div>
  )
}

function NotizenCard({ buchung, onSaved }: { buchung: Buchung; onSaved: () => void }) {
  const [interneNotiz, setInterneNotiz] = useState(buchung.interne_notiz ?? '')
  const [planungsNotiz, setPlanungsNotiz] = useState(buchung.planungs_notiz ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setInterneNotiz(buchung.interne_notiz ?? '')
    setPlanungsNotiz(buchung.planungs_notiz ?? '')
  }, [buchung.interne_notiz, buchung.planungs_notiz])

  const dirty = interneNotiz !== (buchung.interne_notiz ?? '') || planungsNotiz !== (buchung.planungs_notiz ?? '')

  async function handleSave() {
    setSaving(true)
    try {
      await pb.collection('buchungen').update(buchung.id, {
        interne_notiz: interneNotiz,
        planungs_notiz: planungsNotiz,
      })
      toast.success('Notizen gespeichert.')
      onSaved()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Notizen konnten nicht gespeichert werden.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Interne Notizen</CardTitle>
        <CardDescription>Nur für Personal sichtbar, nicht Teil der Anfrage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="interne-notiz">Interne Notiz</Label>
          <Textarea
            id="interne-notiz"
            rows={3}
            value={interneNotiz}
            onChange={(e) => setInterneNotiz(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="planungs-notiz">Planungsnotiz</Label>
          <Textarea
            id="planungs-notiz"
            rows={3}
            value={planungsNotiz}
            onChange={(e) => setPlanungsNotiz(e.target.value)}
          />
        </div>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving || !dirty}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Notizen speichern
        </Button>
      </CardContent>
    </Card>
  )
}
