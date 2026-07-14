// Verwaltung der Verfügbarkeits-/Sperrzeiträume EINES Referenten (SPEC §2.3).
// Wird sowohl im Referenten-Detail (`/admin/referenten/$id`) als auch —
// referentenübergreifend mit Auswahl — unter `/admin/verfuegbarkeiten`
// eingebettet.

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Verfuegbarkeit, VerfuegbarkeitArt, Wiederholung } from '@/lib/types'
import { WOCHENTAGE } from '@/lib/types'
import { dateInputToIso, datetimeLocalToIso, formatDate, formatDateTime, toDateInputValue, wochentagLabel } from '@/lib/admin-format'
import { getErrorMessage } from '@/lib/admin-errors'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog'

type Form = {
  art: VerfuegbarkeitArt
  wiederholung: Wiederholung
  start: string
  ende: string
  wochentag: string
  zeit_von: string
  zeit_bis: string
  gueltig_ab: string
  gueltig_bis: string
  notiz: string
}

function emptyForm(): Form {
  return {
    art: 'verfuegbar',
    wiederholung: 'einmalig',
    start: '',
    ende: '',
    wochentag: 'mo',
    zeit_von: '09:00',
    zeit_bis: '17:00',
    gueltig_ab: toDateInputValue(new Date().toISOString()),
    gueltig_bis: '',
    notiz: '',
  }
}

function zeitraumLabel(v: Verfuegbarkeit): string {
  if (v.wiederholung === 'einmalig') {
    return `${formatDateTime(v.start)} – ${formatDateTime(v.ende)}`
  }
  const gueltig = v.gueltig_bis ? `bis ${formatDate(v.gueltig_bis)}` : 'unbefristet'
  return `${wochentagLabel(v.wochentag)}, ${v.zeit_von}–${v.zeit_bis} Uhr (ab ${formatDate(v.gueltig_ab)}, ${gueltig})`
}

export function VerfuegbarkeitenManager({ referentId }: { referentId: string }) {
  const queryClient = useQueryClient()
  const queryKey = ['admin', 'verfuegbarkeiten', referentId]

  const query = useQuery({
    queryKey,
    queryFn: () =>
      pb.collection('verfuegbarkeiten').getFullList<Verfuegbarkeit>({
        filter: `referent = "${referentId}"`,
        sort: 'wiederholung,wochentag,start',
      }),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Form>(emptyForm())
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey })
  }

  async function handleSubmit() {
    if (form.wiederholung === 'einmalig' && (!form.start || !form.ende)) {
      toast.error('Bitte Start und Ende angeben.')
      return
    }
    if (form.wiederholung === 'woechentlich' && (!form.wochentag || !form.zeit_von || !form.zeit_bis || !form.gueltig_ab)) {
      toast.error('Bitte Wochentag, Uhrzeiten und Gültig-ab-Datum angeben.')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        referent: referentId,
        art: form.art,
        wiederholung: form.wiederholung,
        notiz: form.notiz.trim() || undefined,
      }
      if (form.wiederholung === 'einmalig') {
        body.start = datetimeLocalToIso(form.start)
        body.ende = datetimeLocalToIso(form.ende)
      } else {
        body.wochentag = form.wochentag
        body.zeit_von = form.zeit_von
        body.zeit_bis = form.zeit_bis
        body.gueltig_ab = dateInputToIso(form.gueltig_ab)
        body.gueltig_bis = form.gueltig_bis ? dateInputToIso(form.gueltig_bis) : undefined
      }
      await pb.collection('verfuegbarkeiten').create(body)
      toast.success('Verfügbarkeit angelegt.')
      setDialogOpen(false)
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(v: Verfuegbarkeit) {
    try {
      await pb.collection('verfuegbarkeiten').delete(v.id)
      toast.success('Verfügbarkeit gelöscht.')
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Löschen fehlgeschlagen.'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Wochenmuster + Ausnahmen. „Gesperrt" hat Vorrang vor „Verfügbar".
        </p>
        <Button type="button" size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Neu
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Art</TableHead>
            <TableHead>Zeitraum</TableHead>
            <TableHead>Notiz</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading && (
            <TableRow>
              <TableCell colSpan={4}>
                <Skeleton className="h-6 w-full" />
              </TableCell>
            </TableRow>
          )}
          {!query.isLoading && (query.data?.length ?? 0) === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                Noch keine Einträge.
              </TableCell>
            </TableRow>
          )}
          {query.data?.map((v) => (
            <TableRow key={v.id}>
              <TableCell>
                <Badge variant={v.art === 'gesperrt' ? 'destructive' : 'default'}>
                  {v.art === 'gesperrt' ? 'Gesperrt' : 'Verfügbar'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{zeitraumLabel(v)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{v.notiz || '–'}</TableCell>
              <TableCell className="text-right">
                <ConfirmDeleteDialog
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Löschen">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                  title="Eintrag löschen?"
                  onConfirm={() => handleDelete(v)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Verfügbarkeit / Sperre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Art</Label>
                <Select value={form.art} onValueChange={(v) => setForm((f) => ({ ...f, art: v as VerfuegbarkeitArt }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verfuegbar">Verfügbar</SelectItem>
                    <SelectItem value="gesperrt">Gesperrt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Wiederholung</Label>
                <Select
                  value={form.wiederholung}
                  onValueChange={(v) => setForm((f) => ({ ...f, wiederholung: v as Wiederholung }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="einmalig">Einmalig</SelectItem>
                    <SelectItem value="woechentlich">Wöchentlich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.wiederholung === 'einmalig' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="verf-start">Start *</Label>
                  <Input
                    id="verf-start"
                    type="datetime-local"
                    value={form.start}
                    onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verf-ende">Ende *</Label>
                  <Input
                    id="verf-ende"
                    type="datetime-local"
                    value={form.ende}
                    onChange={(e) => setForm((f) => ({ ...f, ende: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Wochentag *</Label>
                  <Select value={form.wochentag} onValueChange={(v) => setForm((f) => ({ ...f, wochentag: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WOCHENTAGE.map((w) => (
                        <SelectItem key={w.value} value={w.value}>
                          {w.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="verf-von">Von *</Label>
                    <Input
                      id="verf-von"
                      type="time"
                      value={form.zeit_von}
                      onChange={(e) => setForm((f) => ({ ...f, zeit_von: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verf-bis">Bis *</Label>
                    <Input
                      id="verf-bis"
                      type="time"
                      value={form.zeit_bis}
                      onChange={(e) => setForm((f) => ({ ...f, zeit_bis: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="verf-gueltig-ab">Gültig ab *</Label>
                    <Input
                      id="verf-gueltig-ab"
                      type="date"
                      value={form.gueltig_ab}
                      onChange={(e) => setForm((f) => ({ ...f, gueltig_ab: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="verf-gueltig-bis">Gültig bis</Label>
                    <Input
                      id="verf-gueltig-bis"
                      type="date"
                      value={form.gueltig_bis}
                      onChange={(e) => setForm((f) => ({ ...f, gueltig_bis: e.target.value }))}
                      placeholder="unbefristet"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="verf-notiz">Notiz</Label>
              <Textarea
                id="verf-notiz"
                rows={2}
                value={form.notiz}
                onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))}
                placeholder="z.B. Urlaub, Fortbildung"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
