// /admin/einrichtungstypen — Stammdaten-CRUD (SPEC §2.3: Felder identisch zu
// `themen`, ohne `beschreibung`).

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Einrichtungstyp } from '@/lib/types'
import { getDeleteErrorMessage, getErrorMessage } from '@/lib/admin-errors'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog'

export const Route = createFileRoute('/admin/_authenticated/einrichtungstypen')({
  component: EinrichtungstypenPage,
})

const QUERY_KEY = ['admin', 'einrichtungstypen']

type Form = { name: string; sort_order: string; aktiv: boolean }
function emptyForm(): Form {
  return { name: '', sort_order: '0', aktiv: true }
}

function EinrichtungstypenPage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => pb.collection('einrichtungstypen').getFullList<Einrichtungstyp>({ sort: 'sort_order,name' }),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Einrichtungstyp | null>(null)
  const [form, setForm] = useState<Form>(emptyForm())
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(item: Einrichtungstyp) {
    setEditing(item)
    setForm({ name: item.name, sort_order: String(item.sort_order ?? 0), aktiv: item.aktiv })
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
      const body = { name: form.name.trim(), sort_order: Number(form.sort_order) || 0, aktiv: form.aktiv }
      if (editing) {
        await pb.collection('einrichtungstypen').update(editing.id, body)
        toast.success('Einrichtungstyp aktualisiert.')
      } else {
        await pb.collection('einrichtungstypen').create(body)
        toast.success('Einrichtungstyp angelegt.')
      }
      setDialogOpen(false)
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: Einrichtungstyp) {
    try {
      await pb.collection('einrichtungstypen').delete(item.id)
      toast.success('Einrichtungstyp gelöscht.')
      invalidate()
    } catch (err) {
      toast.error(getDeleteErrorMessage(err, 'Einrichtungstyp'))
    }
  }

  async function handleToggleAktiv(item: Einrichtungstyp) {
    try {
      await pb.collection('einrichtungstypen').update(item.id, { aktiv: !item.aktiv })
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Änderung fehlgeschlagen.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Einrichtungstypen</h1>
          <p className="text-sm text-muted-foreground">Herkunfts-Einrichtungstypen (Schule, Universität, …).</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Neuer Einrichtungstyp
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Reihenfolge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!query.isLoading && (query.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    Noch keine Einrichtungstypen angelegt.
                  </TableCell>
                </TableRow>
              )}
              {query.data?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.sort_order ?? 0}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => handleToggleAktiv(item)}>
                      <Badge variant={item.aktiv ? 'default' : 'secondary'} className="cursor-pointer">
                        {item.aktiv ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label="Bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDeleteDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Löschen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      title={`„${item.name}" löschen?`}
                      description="Falls der Einrichtungstyp noch in Buchungen verwendet wird, schlägt das Löschen fehl — dann bitte stattdessen deaktivieren."
                      onConfirm={() => handleDelete(item)}
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
            <DialogTitle>{editing ? 'Einrichtungstyp bearbeiten' : 'Neuer Einrichtungstyp'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="et-name">Name *</Label>
              <Input id="et-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="et-sort">Reihenfolge</Label>
              <Input
                id="et-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="et-aktiv" checked={form.aktiv} onCheckedChange={(v) => setForm((f) => ({ ...f, aktiv: v }))} />
              <Label htmlFor="et-aktiv" className="cursor-pointer font-normal">
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
