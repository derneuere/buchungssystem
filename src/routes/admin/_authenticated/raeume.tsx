// /admin/raeume — Stammdaten-CRUD (SPEC §2.3).

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Raum } from '@/lib/types'
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

export const Route = createFileRoute('/admin/_authenticated/raeume')({
  component: RaeumePage,
})

const QUERY_KEY = ['admin', 'raeume']

type Form = { name: string; kapazitaet: string; notizen: string; aktiv: boolean }
function emptyForm(): Form {
  return { name: '', kapazitaet: '1', notizen: '', aktiv: true }
}

function RaeumePage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => pb.collection('raeume').getFullList<Raum>({ sort: 'name' }),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Raum | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(raum: Raum) {
    setEditing(raum)
    setForm({
      name: raum.name,
      kapazitaet: String(raum.kapazitaet),
      notizen: raum.notizen ?? '',
      aktiv: raum.aktiv,
    })
    setDialogOpen(true)
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }

  async function handleSubmit() {
    const kapazitaet = Number(form.kapazitaet)
    if (!form.name.trim()) {
      toast.error('Bitte einen Namen angeben.')
      return
    }
    if (!Number.isFinite(kapazitaet) || kapazitaet < 1) {
      toast.error('Bitte eine gültige Kapazität (mind. 1) angeben.')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        kapazitaet,
        notizen: form.notizen.trim() || undefined,
        aktiv: form.aktiv,
      }
      if (editing) {
        await pb.collection('raeume').update(editing.id, body)
        toast.success('Raum aktualisiert.')
      } else {
        await pb.collection('raeume').create(body)
        toast.success('Raum angelegt.')
      }
      setDialogOpen(false)
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(raum: Raum) {
    try {
      await pb.collection('raeume').delete(raum.id)
      toast.success('Raum gelöscht.')
      invalidate()
    } catch (err) {
      toast.error(getDeleteErrorMessage(err, 'Raum'))
    }
  }

  async function handleToggleAktiv(raum: Raum) {
    try {
      await pb.collection('raeume').update(raum.id, { aktiv: !raum.aktiv })
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Änderung fehlgeschlagen.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Räume</h1>
          <p className="text-sm text-muted-foreground">Räume für Seminare inkl. Kapazität.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Neuer Raum
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kapazität</TableHead>
                <TableHead>Notizen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!query.isLoading && (query.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Noch keine Räume angelegt.
                  </TableCell>
                </TableRow>
              )}
              {query.data?.map((raum) => (
                <TableRow key={raum.id}>
                  <TableCell className="font-medium">{raum.name}</TableCell>
                  <TableCell>{raum.kapazitaet}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{raum.notizen || '–'}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => handleToggleAktiv(raum)}>
                      <Badge variant={raum.aktiv ? 'default' : 'secondary'} className="cursor-pointer">
                        {raum.aktiv ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(raum)} aria-label="Bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDeleteDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Löschen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      title={`„${raum.name}" löschen?`}
                      description="Falls der Raum noch in Buchungen verwendet wird, schlägt das Löschen fehl — dann bitte stattdessen deaktivieren."
                      onConfirm={() => handleDelete(raum)}
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
            <DialogTitle>{editing ? 'Raum bearbeiten' : 'Neuer Raum'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="raum-name">Name *</Label>
              <Input
                id="raum-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="raum-kapazitaet">Kapazität *</Label>
              <Input
                id="raum-kapazitaet"
                type="number"
                min={1}
                value={form.kapazitaet}
                onChange={(e) => setForm((f) => ({ ...f, kapazitaet: e.target.value }))}
                className="w-32"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="raum-notizen">Notizen</Label>
              <Textarea
                id="raum-notizen"
                rows={3}
                value={form.notizen}
                onChange={(e) => setForm((f) => ({ ...f, notizen: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="raum-aktiv"
                checked={form.aktiv}
                onCheckedChange={(v) => setForm((f) => ({ ...f, aktiv: v }))}
              />
              <Label htmlFor="raum-aktiv" className="cursor-pointer font-normal">
                Aktiv (für Raumvergabe verfügbar)
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
