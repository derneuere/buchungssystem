// /admin/themen — Stammdaten-CRUD: Table + Dialog-Formular + AlertDialog fürs
// Löschen; „aktiv" statt Löschen bei referenzierten Datensätzen (SPEC §5.2).

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Thema } from '@/lib/types'
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog'

export const Route = createFileRoute('/admin/_authenticated/themen')({
  component: ThemenPage,
})

const QUERY_KEY = ['admin', 'themen']

type ThemaForm = {
  name: string
  name_en: string
  beschreibung: string
  beschreibung_en: string
  sort_order: string
  aktiv: boolean
}

function emptyForm(): ThemaForm {
  return { name: '', name_en: '', beschreibung: '', beschreibung_en: '', sort_order: '0', aktiv: true }
}

function ThemenPage() {
  const queryClient = useQueryClient()
  const themenQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => pb.collection('themen').getFullList<Thema>({ sort: 'sort_order,name' }),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Thema | null>(null)
  const [form, setForm] = useState<ThemaForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(thema: Thema) {
    setEditing(thema)
    setForm({
      name: thema.name,
      name_en: thema.name_en ?? '',
      beschreibung: thema.beschreibung ?? '',
      beschreibung_en: thema.beschreibung_en ?? '',
      sort_order: String(thema.sort_order ?? 0),
      aktiv: thema.aktiv,
    })
    setDialogOpen(true)
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('Bitte einen Namen angeben.')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        name_en: form.name_en.trim(),
        beschreibung: form.beschreibung.trim() || undefined,
        beschreibung_en: form.beschreibung_en.trim(),
        sort_order: Number(form.sort_order) || 0,
        aktiv: form.aktiv,
      }
      if (editing) {
        await pb.collection('themen').update(editing.id, body)
        toast.success('Thema aktualisiert.')
      } else {
        await pb.collection('themen').create(body)
        toast.success('Thema angelegt.')
      }
      setDialogOpen(false)
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(thema: Thema) {
    try {
      await pb.collection('themen').delete(thema.id)
      toast.success('Thema gelöscht.')
      invalidate()
    } catch (err) {
      toast.error(getDeleteErrorMessage(err, 'Thema'))
    }
  }

  async function handleToggleAktiv(thema: Thema) {
    try {
      await pb.collection('themen').update(thema.id, { aktiv: !thema.aktiv })
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Änderung fehlgeschlagen.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Themen</h1>
          <p className="text-sm text-muted-foreground">Konfigurierbare Themen für Führungen und Seminare.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Neues Thema
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Reihenfolge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {themenQuery.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!themenQuery.isLoading && (themenQuery.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Noch keine Themen angelegt.
                  </TableCell>
                </TableRow>
              )}
              {themenQuery.data?.map((thema) => (
                <TableRow key={thema.id}>
                  <TableCell className="font-medium">{thema.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {thema.beschreibung || '–'}
                  </TableCell>
                  <TableCell>{thema.sort_order ?? 0}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => handleToggleAktiv(thema)}>
                      <Badge variant={thema.aktiv ? 'default' : 'secondary'} className="cursor-pointer">
                        {thema.aktiv ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(thema)} aria-label="Bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDeleteDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Löschen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      title={`„${thema.name}" löschen?`}
                      description="Falls das Thema noch in Buchungen oder bei Referent:innen verwendet wird, schlägt das Löschen fehl — dann bitte stattdessen deaktivieren."
                      onConfirm={() => handleDelete(thema)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Thema bearbeiten' : 'Neues Thema'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="thema-name">Name *</Label>
              <Input
                id="thema-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thema-name-en">Name (Englisch) — optional</Label>
              <Input
                id="thema-name-en"
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Wird in der englischen Buchungsansicht (?lang=en) angezeigt. Leer = deutscher Name.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="thema-beschreibung">Beschreibung</Label>
              <Textarea
                id="thema-beschreibung"
                rows={3}
                value={form.beschreibung}
                onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Wird öffentlich im Buchungsformular angezeigt.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="thema-beschreibung-en">Beschreibung (Englisch) — optional</Label>
              <Textarea
                id="thema-beschreibung-en"
                rows={3}
                value={form.beschreibung_en}
                onChange={(e) => setForm((f) => ({ ...f, beschreibung_en: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thema-sort">Reihenfolge</Label>
              <Input
                id="thema-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="thema-aktiv"
                checked={form.aktiv}
                onCheckedChange={(v) => setForm((f) => ({ ...f, aktiv: v }))}
              />
              <Label htmlFor="thema-aktiv" className="cursor-pointer font-normal">
                Aktiv (im öffentlichen Formular sichtbar)
              </Label>
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
