// /admin/angebotsarten — Stammdaten-CRUD inkl. Editor für `zeitslots`-Array,
// `benoetigt_raum`, `dauer_minuten`, `min/max_teilnehmer`, `min_referenten`,
// `betreuungsschluessel` (SPEC §2.3/§5.2).

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Angebotsart } from '@/lib/types'
import { formatDauer } from '@/lib/admin-format'
import { getDeleteErrorMessage, getErrorMessage } from '@/lib/admin-errors'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog'

export const Route = createFileRoute('/admin/_authenticated/angebotsarten')({
  component: AngebotsartenPage,
})

const QUERY_KEY = ['admin', 'angebotsarten']
const ZEITSLOT_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

type Form = {
  name: string
  name_en: string
  slug: string
  beschreibung: string
  beschreibung_en: string
  dauer_minuten: string
  benoetigt_raum: boolean
  min_teilnehmer: string
  max_teilnehmer: string
  min_referenten: string
  betreuungsschluessel: string
  zeitslots: string[]
  max_gruppen_parallel_pro_tag: string
  sort_order: string
  aktiv: boolean
}

function emptyForm(): Form {
  return {
    name: '',
    name_en: '',
    slug: '',
    beschreibung: '',
    beschreibung_en: '',
    dauer_minuten: '60',
    benoetigt_raum: false,
    min_teilnehmer: '',
    max_teilnehmer: '30',
    min_referenten: '1',
    betreuungsschluessel: '',
    zeitslots: [],
    max_gruppen_parallel_pro_tag: '',
    sort_order: '0',
    aktiv: true,
  }
}

function AngebotsartenPage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => pb.collection('angebotsarten').getFullList<Angebotsart>({ sort: 'sort_order,name' }),
  })

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Angebotsart | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [neuerSlot, setNeuerSlot] = useState('')
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setNeuerSlot('')
    setSheetOpen(true)
  }

  function openEdit(a: Angebotsart) {
    setEditing(a)
    setForm({
      name: a.name,
      name_en: a.name_en ?? '',
      slug: a.slug,
      beschreibung: a.beschreibung ?? '',
      beschreibung_en: a.beschreibung_en ?? '',
      dauer_minuten: String(a.dauer_minuten),
      benoetigt_raum: a.benoetigt_raum,
      min_teilnehmer: a.min_teilnehmer != null ? String(a.min_teilnehmer) : '',
      max_teilnehmer: String(a.max_teilnehmer),
      min_referenten: String(a.min_referenten),
      betreuungsschluessel: a.betreuungsschluessel != null ? String(a.betreuungsschluessel) : '',
      zeitslots: [...(a.zeitslots ?? [])],
      max_gruppen_parallel_pro_tag:
        a.max_gruppen_parallel_pro_tag != null ? String(a.max_gruppen_parallel_pro_tag) : '',
      sort_order: String(a.sort_order ?? 0),
      aktiv: a.aktiv,
    })
    setNeuerSlot('')
    setSheetOpen(true)
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }

  function handleAddSlot() {
    const trimmed = neuerSlot.trim()
    if (!ZEITSLOT_REGEX.test(trimmed)) {
      toast.error('Bitte eine Uhrzeit im Format HH:MM angeben (z.B. 09:00).')
      return
    }
    if (form.zeitslots.includes(trimmed)) {
      setNeuerSlot('')
      return
    }
    setForm((f) => ({ ...f, zeitslots: [...f.zeitslots, trimmed].sort() }))
    setNeuerSlot('')
  }

  function handleRemoveSlot(slot: string) {
    setForm((f) => ({ ...f, zeitslots: f.zeitslots.filter((s) => s !== slot) }))
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Bitte Name und Slug angeben.')
      return
    }
    const dauer = Number(form.dauer_minuten)
    const maxTeilnehmer = Number(form.max_teilnehmer)
    const minReferenten = Number(form.min_referenten)
    if (!Number.isFinite(dauer) || dauer < 15) {
      toast.error('Dauer muss mindestens 15 Minuten betragen.')
      return
    }
    if (!Number.isFinite(maxTeilnehmer) || maxTeilnehmer < 1) {
      toast.error('Maximale Teilnehmerzahl muss mindestens 1 sein.')
      return
    }
    if (!Number.isFinite(minReferenten) || minReferenten < 1) {
      toast.error('Mindestens 1 Referent:in erforderlich (Basisbedarf).')
      return
    }
    if (form.zeitslots.length === 0) {
      toast.error('Bitte mindestens einen Zeitslot hinzufügen.')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        name_en: form.name_en.trim(),
        slug: form.slug.trim(),
        beschreibung: form.beschreibung.trim() || undefined,
        beschreibung_en: form.beschreibung_en.trim(),
        dauer_minuten: dauer,
        benoetigt_raum: form.benoetigt_raum,
        min_teilnehmer: form.min_teilnehmer ? Number(form.min_teilnehmer) : undefined,
        max_teilnehmer: maxTeilnehmer,
        min_referenten: minReferenten,
        betreuungsschluessel: form.betreuungsschluessel ? Number(form.betreuungsschluessel) : undefined,
        zeitslots: form.zeitslots,
        max_gruppen_parallel_pro_tag: form.max_gruppen_parallel_pro_tag
          ? Number(form.max_gruppen_parallel_pro_tag)
          : undefined,
        sort_order: Number(form.sort_order) || 0,
        aktiv: form.aktiv,
      }
      if (editing) {
        await pb.collection('angebotsarten').update(editing.id, body)
        toast.success('Angebotsart aktualisiert.')
      } else {
        await pb.collection('angebotsarten').create(body)
        toast.success('Angebotsart angelegt.')
      }
      setSheetOpen(false)
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(a: Angebotsart) {
    try {
      await pb.collection('angebotsarten').delete(a.id)
      toast.success('Angebotsart gelöscht.')
      invalidate()
    } catch (err) {
      toast.error(getDeleteErrorMessage(err, 'Angebotsart'))
    }
  }

  async function handleToggleAktiv(a: Angebotsart) {
    try {
      await pb.collection('angebotsarten').update(a.id, { aktiv: !a.aktiv })
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Änderung fehlgeschlagen.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Angebotsarten</h1>
          <p className="text-sm text-muted-foreground">Führung, Seminar & Co.: Dauer, Raumbedarf, Bedarfsformel, Zeitslots.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Neue Angebotsart
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Dauer</TableHead>
                <TableHead>Raum</TableHead>
                <TableHead>Teilnehmer</TableHead>
                <TableHead>Referentenbedarf</TableHead>
                <TableHead>Zeitslots</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!query.isLoading && (query.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Noch keine Angebotsarten angelegt.
                  </TableCell>
                </TableRow>
              )}
              {query.data?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.name}
                    <div className="text-xs text-muted-foreground">{a.slug}</div>
                  </TableCell>
                  <TableCell>{formatDauer(a.dauer_minuten)}</TableCell>
                  <TableCell>{a.benoetigt_raum ? 'ja' : 'nein'}</TableCell>
                  <TableCell>
                    {a.min_teilnehmer ?? 1}–{a.max_teilnehmer}
                  </TableCell>
                  <TableCell>
                    min. {a.min_referenten}
                    {a.betreuungsschluessel ? `, 1 je ${a.betreuungsschluessel} Teiln.` : ''}
                  </TableCell>
                  <TableCell className="max-w-[12rem]">
                    <div className="flex flex-wrap gap-1">
                      {a.zeitslots?.slice(0, 4).map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                      {a.zeitslots && a.zeitslots.length > 4 && (
                        <span className="text-xs text-muted-foreground">+{a.zeitslots.length - 4}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => handleToggleAktiv(a)}>
                      <Badge variant={a.aktiv ? 'default' : 'secondary'} className="cursor-pointer">
                        {a.aktiv ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)} aria-label="Bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDeleteDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Löschen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      title={`„${a.name}" löschen?`}
                      description="Falls die Angebotsart noch in Buchungen verwendet wird, schlägt das Löschen fehl — dann bitte stattdessen deaktivieren."
                      onConfirm={() => handleDelete(a)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? 'Angebotsart bearbeiten' : 'Neue Angebotsart'}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aa-name">Name *</Label>
                <Input id="aa-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aa-slug">Slug *</Label>
                <Input
                  id="aa-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="z.B. fuehrung"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aa-name-en">Name (Englisch) — optional</Label>
              <Input
                id="aa-name-en"
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Wird in der englischen Buchungsansicht (?lang=en) angezeigt. Leer = deutscher Name.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aa-beschreibung">Beschreibung</Label>
              <Textarea
                id="aa-beschreibung"
                rows={2}
                value={form.beschreibung}
                onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aa-beschreibung-en">Beschreibung (Englisch) — optional</Label>
              <Textarea
                id="aa-beschreibung-en"
                rows={2}
                value={form.beschreibung_en}
                onChange={(e) => setForm((f) => ({ ...f, beschreibung_en: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aa-dauer">Dauer (Minuten) *</Label>
                <Input
                  id="aa-dauer"
                  type="number"
                  min={15}
                  value={form.dauer_minuten}
                  onChange={(e) => setForm((f) => ({ ...f, dauer_minuten: e.target.value }))}
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch
                  id="aa-raum"
                  checked={form.benoetigt_raum}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, benoetigt_raum: v }))}
                />
                <Label htmlFor="aa-raum" className="cursor-pointer font-normal">
                  Benötigt Raum
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aa-min-teilnehmer">Min. Teilnehmer</Label>
                <Input
                  id="aa-min-teilnehmer"
                  type="number"
                  min={1}
                  value={form.min_teilnehmer}
                  onChange={(e) => setForm((f) => ({ ...f, min_teilnehmer: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aa-max-teilnehmer">Max. Teilnehmer *</Label>
                <Input
                  id="aa-max-teilnehmer"
                  type="number"
                  min={1}
                  value={form.max_teilnehmer}
                  onChange={(e) => setForm((f) => ({ ...f, max_teilnehmer: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aa-min-referenten">Min. Referenten (Basisbedarf) *</Label>
                <Input
                  id="aa-min-referenten"
                  type="number"
                  min={1}
                  value={form.min_referenten}
                  onChange={(e) => setForm((f) => ({ ...f, min_referenten: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aa-betreuungsschluessel">Betreuungsschlüssel</Label>
                <Input
                  id="aa-betreuungsschluessel"
                  type="number"
                  min={1}
                  value={form.betreuungsschluessel}
                  onChange={(e) => setForm((f) => ({ ...f, betreuungsschluessel: e.target.value }))}
                  placeholder="Teilnehmer je Referent:in"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Benötigte Referent:innen = max(Basisbedarf, Gruppengröße ÷ Betreuungsschlüssel, aufgerundet). Leer =
              nur Basisbedarf.
            </p>

            <div className="space-y-2">
              <Label>Zeitslots (Startzeiten, Berliner Lokalzeit) *</Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
                {form.zeitslots.length === 0 && (
                  <span className="text-sm text-muted-foreground">Noch keine Zeitslots.</span>
                )}
                {form.zeitslots.map((slot) => (
                  <Badge key={slot} variant="secondary" className="gap-1 pr-1">
                    {slot}
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(slot)}
                      aria-label={`Zeitslot ${slot} entfernen`}
                      className="rounded-full hover:bg-background/50"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={neuerSlot}
                  onChange={(e) => setNeuerSlot(e.target.value)}
                  className="w-32"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddSlot}>
                  <Plus className="h-4 w-4" />
                  Hinzufügen
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aa-parallel">Max. parallele Gruppen/Tag</Label>
                <Input
                  id="aa-parallel"
                  type="number"
                  min={1}
                  value={form.max_gruppen_parallel_pro_tag}
                  onChange={(e) => setForm((f) => ({ ...f, max_gruppen_parallel_pro_tag: e.target.value }))}
                  placeholder="leer = globaler Default"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aa-sort">Reihenfolge</Label>
                <Input
                  id="aa-sort"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="aa-aktiv"
                checked={form.aktiv}
                onCheckedChange={(v) => setForm((f) => ({ ...f, aktiv: v }))}
              />
              <Label htmlFor="aa-aktiv" className="cursor-pointer font-normal">
                Aktiv (im öffentlichen Formular buchbar)
              </Label>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Speichern
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
