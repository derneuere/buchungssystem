// /admin/buchungen/neu — manuelle/telefonische Erfassung einer Buchung durch
// das Personal (z.B. wenn jemand anruft). Nach dem Anlegen geht es direkt zur
// Detailseite zur Referentenplanung.

import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import { adminBuchungAnlegen } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import { BUNDESLAENDER } from '@/lib/types'
import type { Angebotsart, Einrichtungstyp, Thema } from '@/lib/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/admin/_authenticated/buchungen/neu')({
  component: NeueBuchungPage,
})

function isoAusLokal(datum: string, zeit: string): string | null {
  if (!datum || !zeit) return null
  const [y, m, d] = datum.split('-').map(Number)
  const [hh, mm] = zeit.split(':').map(Number)
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null
  // Lokale Zeit (Berlin am Server/Client) -> ISO/UTC.
  return new Date(y, m - 1, d, hh, mm, 0).toISOString()
}

function NeueBuchungPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const angebotsartenQuery = useQuery({
    queryKey: ['admin', 'angebotsarten', 'aktiv'],
    queryFn: () =>
      pb.collection('angebotsarten').getFullList<Angebotsart>({ filter: 'aktiv = true', sort: 'sort_order' }),
  })
  const themenQuery = useQuery({
    queryKey: ['admin', 'themen', 'aktiv'],
    queryFn: () => pb.collection('themen').getFullList<Thema>({ filter: 'aktiv = true', sort: 'sort_order,name' }),
  })
  const einrichtungenQuery = useQuery({
    queryKey: ['admin', 'einrichtungstypen', 'aktiv'],
    queryFn: () =>
      pb.collection('einrichtungstypen').getFullList<Einrichtungstyp>({ filter: 'aktiv = true', sort: 'sort_order,name' }),
  })

  const [angebotsartId, setAngebotsartId] = useState('')
  const [themaId, setThemaId] = useState('')
  const [datum, setDatum] = useState('')
  const [zeit, setZeit] = useState('')
  const [gruppe, setGruppe] = useState('')
  const [land, setLand] = useState('Deutschland')
  const [bundesland, setBundesland] = useState('')
  const [einrichtungstyp, setEinrichtungstyp] = useState('')
  const [einrichtungsname, setEinrichtungsname] = useState('')
  const [ort, setOrt] = useState('')
  const [kontaktName, setKontaktName] = useState('')
  const [kontaktEmail, setKontaktEmail] = useState('')
  const [kontaktTelefon, setKontaktTelefon] = useState('')
  const [nachricht, setNachricht] = useState('')
  const [interneNotiz, setInterneNotiz] = useState('')
  const [saving, setSaving] = useState(false)

  const gewaehlteAngebotsart = useMemo(
    () => angebotsartenQuery.data?.find((a) => a.id === angebotsartId),
    [angebotsartenQuery.data, angebotsartId],
  )
  const slots = gewaehlteAngebotsart?.zeitslots ?? []
  const istDeutschland = land.trim().toLowerCase() === 'deutschland'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!angebotsartId || !themaId) {
      toast.error('Bitte Angebotsart und Thema wählen.')
      return
    }
    const start = isoAusLokal(datum, zeit)
    if (!start) {
      toast.error('Bitte Datum und Uhrzeit angeben.')
      return
    }
    const gz = Number(gruppe)
    if (!gz || gz < 1) {
      toast.error('Bitte eine gültige Gruppengröße angeben.')
      return
    }
    if (!kontaktName.trim() || !kontaktEmail.trim()) {
      toast.error('Bitte Name und E-Mail der Kontaktperson angeben.')
      return
    }
    setSaving(true)
    try {
      const res = await adminBuchungAnlegen({
        angebotsart_id: angebotsartId,
        thema_id: themaId,
        start,
        teilnehmer_geplant: gz,
        herkunft_land: land.trim() || 'Deutschland',
        herkunft_bundesland: istDeutschland ? (bundesland as never) : '',
        herkunft_einrichtungstyp_id: einrichtungstyp || undefined,
        herkunft_einrichtungsname: einrichtungsname.trim() || undefined,
        herkunft_ort: ort.trim() || undefined,
        kontakt_name: kontaktName.trim(),
        kontakt_email: kontaktEmail.trim(),
        kontakt_telefon: kontaktTelefon.trim() || undefined,
        nachricht: nachricht.trim() || undefined,
        interne_notiz: interneNotiz.trim() || undefined,
      })
      toast.success('Buchung angelegt. Bitte jetzt Referent:innen einplanen.')
      // Liste + Dashboard spiegeln die neue Buchung sofort wider.
      queryClient.invalidateQueries({ queryKey: ['admin', 'buchungen', 'liste'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] })
      await navigate({ to: '/admin/buchungen/$id', params: { id: res.id } })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Anlegen fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Neue Buchung erfassen</h1>
        <p className="text-sm text-muted-foreground">
          Für telefonische oder persönliche Anfragen. Danach wie üblich Referent:innen einplanen und bestätigen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Angebot &amp; Termin</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Angebotsart *</Label>
              <Select value={angebotsartId} onValueChange={setAngebotsartId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {angebotsartenQuery.data?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.dauer_minuten} Min{a.benoetigt_raum ? ', Raum' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Thema *</Label>
              <Select value={themaId} onValueChange={setThemaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {themenQuery.data?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="datum">Datum *</Label>
              <Input id="datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zeit">Uhrzeit *</Label>
              <Input id="zeit" type="time" value={zeit} onChange={(e) => setZeit(e.target.value)} list="slot-liste" />
              {slots.length > 0 && (
                <>
                  <datalist id="slot-liste">
                    {slots.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <p className="text-xs text-muted-foreground">Übliche Startzeiten: {slots.join(', ')}</p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gruppe">Gruppengröße *</Label>
              <Input
                id="gruppe"
                type="number"
                min={1}
                value={gruppe}
                onChange={(e) => setGruppe(e.target.value)}
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Herkunft</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="land">Land</Label>
              <Input id="land" value={land} onChange={(e) => setLand(e.target.value)} />
            </div>
            {istDeutschland && (
              <div className="space-y-2">
                <Label>Bundesland</Label>
                <Select value={bundesland} onValueChange={setBundesland}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wählen …" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUNDESLAENDER.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Einrichtungstyp</Label>
              <Select value={einrichtungstyp} onValueChange={setEinrichtungstyp}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {einrichtungenQuery.data?.map((et) => (
                    <SelectItem key={et.id} value={et.id}>
                      {et.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="einrichtungsname">Einrichtung / Schule</Label>
              <Input
                id="einrichtungsname"
                value={einrichtungsname}
                onChange={(e) => setEinrichtungsname(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ort">Ort</Label>
              <Input id="ort" value={ort} onChange={(e) => setOrt(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kontakt</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kn">Name *</Label>
              <Input id="kn" value={kontaktName} onChange={(e) => setKontaktName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ke">E-Mail *</Label>
              <Input id="ke" type="email" value={kontaktEmail} onChange={(e) => setKontaktEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kt">Telefon</Label>
              <Input id="kt" value={kontaktTelefon} onChange={(e) => setKontaktTelefon(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nachricht">Anmerkung der anfragenden Person</Label>
              <Textarea id="nachricht" rows={2} value={nachricht} onChange={(e) => setNachricht(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notiz">Interne Notiz</Label>
              <Textarea id="notiz" rows={2} value={interneNotiz} onChange={(e) => setInterneNotiz(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: '/admin/buchungen' })}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Buchung anlegen
          </Button>
        </div>
      </form>
    </div>
  )
}
