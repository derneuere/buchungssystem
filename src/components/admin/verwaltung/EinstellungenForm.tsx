// Verwaltungs-Tab „Einstellungen" — Singleton-Formular (SPEC §2.3/§5.2).

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Einstellungen, Wochentag } from '@/lib/types'
import { WOCHENTAGE } from '@/lib/types'
import { getErrorMessage } from '@/lib/admin-errors'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type Form = {
  puffer_minuten: string
  vorlaufzeit_tage_min: string
  vorlaufzeit_tage_max: string
  anfrage_verfall_stunden: string
  oeffnungstage: Wochentag[]
  betriebsende: string
  max_gruppen_parallel_pro_tag_default: string
  max_gruppengroesse_absolut: string
  team_benachrichtigung_email: string
}

function toForm(e: Einstellungen): Form {
  return {
    puffer_minuten: String(e.puffer_minuten),
    vorlaufzeit_tage_min: String(e.vorlaufzeit_tage_min),
    vorlaufzeit_tage_max: String(e.vorlaufzeit_tage_max),
    anfrage_verfall_stunden: String(e.anfrage_verfall_stunden),
    oeffnungstage: [...(e.oeffnungstage ?? [])],
    betriebsende: e.betriebsende,
    max_gruppen_parallel_pro_tag_default: String(e.max_gruppen_parallel_pro_tag_default),
    max_gruppengroesse_absolut: String(e.max_gruppengroesse_absolut),
    team_benachrichtigung_email: e.team_benachrichtigung_email ?? '',
  }
}

export function EinstellungenForm() {
  const queryClient = useQueryClient()
  const queryKey = ['admin', 'einstellungen']

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const list = await pb.collection('einstellungen').getFullList<Einstellungen>()
      return list[0] ?? null
    },
  })

  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (query.data) setForm(toForm(query.data))
  }, [query.data])

  function toggleTag(tag: Wochentag) {
    setForm((f) =>
      f
        ? {
            ...f,
            oeffnungstage: f.oeffnungstage.includes(tag)
              ? f.oeffnungstage.filter((t) => t !== tag)
              : [...f.oeffnungstage, tag],
          }
        : f,
    )
  }

  async function handleSave() {
    if (!form || !query.data) return
    setSaving(true)
    try {
      await pb.collection('einstellungen').update(query.data.id, {
        puffer_minuten: Number(form.puffer_minuten),
        vorlaufzeit_tage_min: Number(form.vorlaufzeit_tage_min),
        vorlaufzeit_tage_max: Number(form.vorlaufzeit_tage_max),
        anfrage_verfall_stunden: Number(form.anfrage_verfall_stunden),
        oeffnungstage: form.oeffnungstage,
        betriebsende: form.betriebsende,
        max_gruppen_parallel_pro_tag_default: Number(form.max_gruppen_parallel_pro_tag_default),
        max_gruppengroesse_absolut: Number(form.max_gruppengroesse_absolut),
        team_benachrichtigung_email: form.team_benachrichtigung_email.trim(),
      })
      toast.success('Einstellungen gespeichert.')
      queryClient.invalidateQueries({ queryKey })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  if (query.isLoading || (!form && !query.isError)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (query.isError || !query.data || !form) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Einstellungen nicht gefunden</AlertTitle>
        <AlertDescription>
          {getErrorMessage(query.error, 'Der Einstellungen-Singleton-Datensatz konnte nicht geladen werden.')}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-sm text-muted-foreground">Globale Parameter für Buchbarkeit und Kapazität.</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zeitliche Rahmenbedingungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="es-puffer">Puffer zwischen Terminen (Min.)</Label>
              <Input
                id="es-puffer"
                type="number"
                min={0}
                value={form.puffer_minuten}
                onChange={(e) => setForm({ ...form, puffer_minuten: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="es-betriebsende">Betriebsende (HH:MM)</Label>
              <Input
                id="es-betriebsende"
                type="time"
                value={form.betriebsende}
                onChange={(e) => setForm({ ...form, betriebsende: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="es-vorlauf-min">Vorlaufzeit min. (Tage)</Label>
              <Input
                id="es-vorlauf-min"
                type="number"
                min={0}
                value={form.vorlaufzeit_tage_min}
                onChange={(e) => setForm({ ...form, vorlaufzeit_tage_min: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="es-vorlauf-max">Vorlaufzeit max. (Tage)</Label>
              <Input
                id="es-vorlauf-max"
                type="number"
                min={0}
                value={form.vorlaufzeit_tage_max}
                onChange={(e) => setForm({ ...form, vorlaufzeit_tage_max: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="es-verfall">Verfall offener Anfragen (Stunden)</Label>
            <Input
              id="es-verfall"
              type="number"
              min={1}
              value={form.anfrage_verfall_stunden}
              onChange={(e) => setForm({ ...form, anfrage_verfall_stunden: e.target.value })}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label>Öffnungstage</Label>
            <div className="flex flex-wrap gap-3">
              {WOCHENTAGE.map((w) => (
                <div key={w.value} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`tag-${w.value}`}
                    checked={form.oeffnungstage.includes(w.value)}
                    onCheckedChange={() => toggleTag(w.value)}
                  />
                  <Label htmlFor={`tag-${w.value}`} className="cursor-pointer font-normal">
                    {w.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kapazität</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="es-parallel">Max. parallele Gruppen/Tag (Default)</Label>
              <Input
                id="es-parallel"
                type="number"
                min={1}
                value={form.max_gruppen_parallel_pro_tag_default}
                onChange={(e) => setForm({ ...form, max_gruppen_parallel_pro_tag_default: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="es-absolut">Max. Gruppengröße absolut</Label>
              <Input
                id="es-absolut"
                type="number"
                min={1}
                value={form.max_gruppengroesse_absolut}
                onChange={(e) => setForm({ ...form, max_gruppengroesse_absolut: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Benachrichtigungen</CardTitle>
          <CardDescription>Interne E-Mail-Adresse für neue Anfragen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="es-team-mail">Team-Benachrichtigung E-Mail</Label>
            <Input
              id="es-team-mail"
              type="email"
              value={form.team_benachrichtigung_email}
              onChange={(e) => setForm({ ...form, team_benachrichtigung_email: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Einstellungen speichern
      </Button>
    </div>
  )
}
