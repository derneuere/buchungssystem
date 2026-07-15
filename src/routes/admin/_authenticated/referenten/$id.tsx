// /admin/referenten/$id — Detail: Stammdaten, Themen-Mehrfachauswahl,
// Verwaltung der Verfügbarkeiten (SPEC §5.2).

import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Referent, Thema } from '@/lib/types'
import { getErrorMessage } from '@/lib/admin-errors'
import { istLeitung, useRolle } from '@/lib/use-rolle'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { VerfuegbarkeitenManager } from '@/components/admin/VerfuegbarkeitenManager'

export const Route = createFileRoute('/admin/_authenticated/referenten/$id')({
  component: ReferentDetailPage,
})

type Form = { name: string; email: string; telefon: string; notizen: string; aktiv: boolean; themen: string[] }

function ReferentDetailPage() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const queryKey = ['admin', 'referent', id]
  const darfBearbeiten = istLeitung(useRolle())

  const referentQuery = useQuery({
    queryKey,
    queryFn: () => pb.collection('referenten').getOne<Referent>(id),
  })

  const themenQuery = useQuery({
    queryKey: ['admin', 'themen', 'alle'],
    queryFn: () => pb.collection('themen').getFullList<Thema>({ sort: 'sort_order,name' }),
  })

  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (referentQuery.data) {
      setForm({
        name: referentQuery.data.name,
        email: referentQuery.data.email ?? '',
        telefon: referentQuery.data.telefon ?? '',
        notizen: referentQuery.data.notizen ?? '',
        aktiv: referentQuery.data.aktiv,
        themen: [...(referentQuery.data.themen ?? [])],
      })
    }
  }, [referentQuery.data])

  function toggleThema(themaId: string) {
    setForm((f) =>
      f
        ? {
            ...f,
            themen: f.themen.includes(themaId) ? f.themen.filter((t) => t !== themaId) : [...f.themen, themaId],
          }
        : f,
    )
  }

  async function handleSave() {
    if (!form) return
    if (!form.name.trim()) {
      toast.error('Bitte einen Namen angeben.')
      return
    }
    setSaving(true)
    try {
      await pb.collection('referenten').update(id, {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        telefon: form.telefon.trim() || undefined,
        notizen: form.notizen.trim() || undefined,
        aktiv: form.aktiv,
        themen: form.themen,
      })
      toast.success('Referent:in gespeichert.')
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['admin', 'referenten', 'alle'] })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  if (referentQuery.isLoading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (referentQuery.isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Referent:in nicht gefunden</AlertTitle>
        <AlertDescription>{getErrorMessage(referentQuery.error)}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/admin/referenten">
            <ArrowLeft className="h-4 w-4" />
            Zurück zur Liste
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{referentQuery.data?.name}</h1>
      </div>

      {!darfBearbeiten && (
        <Alert>
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Nur-Lese-Ansicht</AlertTitle>
          <AlertDescription>
            Referenten-Stammdaten und Verfügbarkeiten können nur von der Leitung bearbeitet werden.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stammdaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset disabled={!darfBearbeiten} className="m-0 min-w-0 space-y-4 border-0 p-0">
            <div className="space-y-2">
              <Label htmlFor="ref-name">Name *</Label>
              <Input id="ref-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ref-email">E-Mail</Label>
                <Input
                  id="ref-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref-telefon">Telefon</Label>
                <Input
                  id="ref-telefon"
                  value={form.telefon}
                  onChange={(e) => setForm({ ...form, telefon: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref-notizen">Notizen (intern)</Label>
              <Textarea
                id="ref-notizen"
                rows={3}
                value={form.notizen}
                onChange={(e) => setForm({ ...form, notizen: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="ref-aktiv"
                checked={form.aktiv}
                onCheckedChange={(v) => setForm({ ...form, aktiv: v })}
              />
              <Label htmlFor="ref-aktiv" className="cursor-pointer font-normal">
                Aktiv (wird bei Vorschlägen berücksichtigt)
              </Label>
            </div>
            {darfBearbeiten && (
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Speichern
              </Button>
            )}
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Themenkompetenzen</CardTitle>
            <CardDescription>Wird beim automatischen Vorschlag als Filterkriterium genutzt.</CardDescription>
          </CardHeader>
          <CardContent>
            <fieldset disabled={!darfBearbeiten} className="m-0 min-w-0 border-0 p-0">
            {themenQuery.isLoading && <Skeleton className="h-32 w-full" />}
            {!themenQuery.isLoading && (themenQuery.data?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Themen angelegt.</p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {themenQuery.data?.map((thema) => (
                <div key={thema.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`thema-${thema.id}`}
                    checked={form.themen.includes(thema.id)}
                    onCheckedChange={() => toggleThema(thema.id)}
                  />
                  <Label htmlFor={`thema-${thema.id}`} className="cursor-pointer font-normal">
                    {thema.name}
                    {!thema.aktiv && <span className="ml-1 text-xs text-muted-foreground">(inaktiv)</span>}
                  </Label>
                </div>
              ))}
            </div>
            {darfBearbeiten && (
              <Button onClick={handleSave} disabled={saving} className="mt-4">
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Speichern
              </Button>
            )}
            </fieldset>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verfügbarkeiten</CardTitle>
          <CardDescription>Wochenmuster und Ausnahmen (verfügbar/gesperrt) dieser Person.</CardDescription>
        </CardHeader>
        <CardContent>
          <VerfuegbarkeitenManager referentId={id} nurLesen={!darfBearbeiten} />
        </CardContent>
      </Card>
    </div>
  )
}
